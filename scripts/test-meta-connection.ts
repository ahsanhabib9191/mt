/**
 * Test Meta Graph API Connection
 * 
 * This script verifies that Meta API credentials are properly configured
 * and can successfully connect to the Meta Graph API.
 * 
 * Usage: npm run test:meta
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const { META_APP_ID, META_APP_SECRET, META_API_VERSION = 'v21.0' } = process.env;

async function testMetaAPIConnection() {
  console.log('🔍 Testing Meta Graph API Connection');
  console.log('====================================\n');

  // Step 1: Validate environment variables
  console.log('1️⃣  Validating environment variables...');
  
  if (!META_APP_ID) {
    console.error('❌ FAIL: META_APP_ID is not configured in .env');
    console.log('\n💡 To fix: Add META_APP_ID to your .env file');
    console.log('   See docs/META_API_SETUP.md for instructions\n');
    process.exit(1);
  }
  
  if (!META_APP_SECRET) {
    console.error('❌ FAIL: META_APP_SECRET is not configured in .env');
    console.log('\n💡 To fix: Add META_APP_SECRET to your .env file');
    console.log('   See docs/META_API_SETUP.md for instructions\n');
    process.exit(1);
  }
  
  console.log(`✅ PASS: META_APP_ID is configured (${META_APP_ID.slice(0, 8)}...)`);
  console.log(`✅ PASS: META_APP_SECRET is configured (${META_APP_SECRET.slice(0, 8)}...)`);
  console.log(`✅ PASS: Using API version ${META_API_VERSION}\n`);

  // Step 2: Get app access token
  console.log('2️⃣  Requesting app access token...');
  
  try {
    const tokenUrl = new URL(`https://graph.facebook.com/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', META_APP_ID);
    tokenUrl.searchParams.set('client_secret', META_APP_SECRET);
    tokenUrl.searchParams.set('grant_type', 'client_credentials');

    const tokenResponse = await fetch(tokenUrl.toString());
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ FAIL: Could not get access token');
      console.error(`   Status: ${tokenResponse.status} ${tokenResponse.statusText}`);
      console.error(`   Response: ${errorText}\n`);
      
      console.log('💡 Possible reasons:');
      console.log('   - Invalid APP_ID or APP_SECRET');
      console.log('   - App is not active on Meta Developer Portal');
      console.log('   - Network connectivity issues\n');
      process.exit(1);
    }

    const tokenData = await tokenResponse.json() as { access_token?: string; error?: any };
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('❌ FAIL: No access token in response');
      console.error(`   Response: ${JSON.stringify(tokenData, null, 2)}\n`);
      process.exit(1);
    }

    console.log(`✅ PASS: Access token received (${accessToken.slice(0, 20)}...)\n`);

    // Step 3: Test API call - Get app info
    console.log('3️⃣  Testing Graph API call (app details)...');
    
    const apiUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/${META_APP_ID}`);
    apiUrl.searchParams.set('fields', 'name,category,company,link');
    apiUrl.searchParams.set('access_token', accessToken);

    const apiResponse = await fetch(apiUrl.toString());
    
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error('❌ FAIL: Graph API call failed');
      console.error(`   Status: ${apiResponse.status} ${apiResponse.statusText}`);
      console.error(`   Response: ${errorText}\n`);
      process.exit(1);
    }

    const appData = await apiResponse.json() as { id?: string; name?: string; category?: string; company?: string; link?: string };
    
    console.log('✅ PASS: Graph API call successful');
    console.log('\n📱 App Details:');
    console.log(`   Name: ${appData.name || 'N/A'}`);
    console.log(`   ID: ${appData.id || META_APP_ID}`);
    console.log(`   Category: ${appData.category || 'N/A'}`);
    console.log(`   Company: ${appData.company || 'N/A'}`);
    if (appData.link) {
      console.log(`   Link: ${appData.link}`);
    }

    // Step 4: Test debug token endpoint
    console.log('\n4️⃣  Testing debug token endpoint...');
    
    const debugUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/debug_token`);
    debugUrl.searchParams.set('input_token', accessToken);
    debugUrl.searchParams.set('access_token', accessToken);

    const debugResponse = await fetch(debugUrl.toString());
    
    if (!debugResponse.ok) {
      console.warn('⚠️  WARN: Could not debug token (this is optional)');
    } else {
      const debugData = await debugResponse.json() as { data?: { app_id?: string; type?: string; is_valid?: boolean; expires_at?: number } };
      console.log('✅ PASS: Token debug successful');
      console.log('\n🔑 Token Info:');
      console.log(`   App ID: ${debugData.data?.app_id || 'N/A'}`);
      console.log(`   Type: ${debugData.data?.type || 'N/A'}`);
      console.log(`   Valid: ${debugData.data?.is_valid ? '✅' : '❌'}`);
      if (debugData.data?.expires_at) {
        const expiresAt = new Date(debugData.data.expires_at * 1000);
        console.log(`   Expires: ${expiresAt.toLocaleString()}`);
      } else {
        console.log('   Expires: Never (app token)');
      }
    }

    // Success summary
    console.log('\n====================================');
    console.log('✅ All tests passed!');
    console.log('\n🎉 Your Meta API configuration is working correctly.');
    console.log('\n📚 Next steps:');
    console.log('   1. Implement OAuth flow to get user access tokens');
    console.log('   2. Test syncing campaigns: npm run test:sync');
    console.log('   3. Set up webhooks for real-time updates');
    console.log('   4. See docs/META_API_SETUP.md for details\n');
    
    process.exit(0);

  } catch (error) {
    console.error('\n❌ FAIL: Unexpected error during test');
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('\n💡 Network error - check your internet connection');
    }
    
    console.log('\n📚 For help, see docs/META_API_SETUP.md\n');
    process.exit(1);
  }
}

// Run the test
testMetaAPIConnection().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
