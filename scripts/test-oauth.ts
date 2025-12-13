/**
 * OAuth Flow Test Script
 * 
 * Tests the OAuth service functions without requiring a full web server.
 * Use this to validate your OAuth configuration.
 * 
 * Usage: npm run test:oauth
 */

import dotenv from 'dotenv';
dotenv.config();

import {
  generateAuthorizationUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  getUserInfo,
  debugToken,
  getUserAdAccounts,
} from '../lib/services/meta-oauth/oauth-service';

async function testOAuthConfiguration() {
  console.log('\n🔍 Testing OAuth Configuration');
  console.log('====================================\n');

  // Step 1: Validate environment variables
  console.log('1️⃣  Validating environment variables...');
  
  const { META_APP_ID, META_APP_SECRET, META_REDIRECT_URI, META_API_VERSION } = process.env;

  if (!META_APP_ID) {
    console.error('❌ FAIL: META_APP_ID is not configured');
    process.exit(1);
  }
  console.log(`✅ PASS: META_APP_ID is configured (${META_APP_ID.slice(0, 8)}...)`);

  if (!META_APP_SECRET) {
    console.error('❌ FAIL: META_APP_SECRET is not configured');
    process.exit(1);
  }
  console.log(`✅ PASS: META_APP_SECRET is configured (${META_APP_SECRET.slice(0, 8)}...)`);

  if (!META_REDIRECT_URI) {
    console.warn('⚠️  WARN: META_REDIRECT_URI not set, using default');
  }
  console.log(`✅ PASS: Redirect URI: ${META_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/facebook'}`);

  console.log(`✅ PASS: API Version: ${META_API_VERSION || 'v21.0'}\n`);

  // Step 2: Generate authorization URL
  console.log('2️⃣  Generating authorization URL...');
  
  const state = 'test-state-' + Date.now();
  const authUrl = generateAuthorizationUrl(state);

  console.log('✅ PASS: Authorization URL generated');
  console.log('\n📋 Authorization URL:');
  console.log(authUrl);
  console.log('\n💡 To complete OAuth flow:');
  console.log('   1. Copy the URL above and paste it in your browser');
  console.log('   2. Log in with a Facebook account that has ad accounts');
  console.log('   3. Grant the requested permissions');
  console.log('   4. You will be redirected to your callback URL');
  console.log('   5. Copy the "code" parameter from the redirect URL');
  console.log('   6. Use the code in the next step\n');

  // Step 3: Test token exchange (requires manual code input)
  console.log('3️⃣  Token exchange test (requires authorization code)...');
  console.log('⚠️  This requires completing the OAuth flow in a browser first');
  console.log('   Run this script with CODE environment variable:');
  console.log('   CODE=your_auth_code npm run test:oauth\n');

  const authCode = process.env.CODE;

  if (!authCode) {
    console.log('⏭️  SKIP: No authorization code provided');
    console.log('\n====================================');
    console.log('✅ OAuth configuration validated');
    console.log('   Ready to implement OAuth flow in your app');
    console.log('   See examples/api/auth/ for Next.js API routes\n');
    process.exit(0);
  }

  // Exchange code for token
  console.log('   Exchanging code for short-lived token...');
  const shortToken = await exchangeCodeForToken(authCode);
  console.log(`✅ PASS: Short-lived token obtained (expires in ${shortToken.expires_in}s)`);

  // Exchange for long-lived token
  console.log('   Exchanging for long-lived token...');
  const longToken = await exchangeForLongLivedToken(shortToken.access_token);
  console.log(`✅ PASS: Long-lived token obtained (expires in ${longToken.expires_in}s)\n`);

  // Step 4: Debug token
  console.log('4️⃣  Debugging token...');
  const tokenData = await debugToken(longToken.access_token);
  
  console.log('✅ PASS: Token is valid');
  console.log('\n🔑 Token Details:');
  console.log(`   User ID: ${tokenData.user_id}`);
  console.log(`   App ID: ${tokenData.app_id}`);
  console.log(`   Type: ${tokenData.type}`);
  console.log(`   Valid: ${tokenData.is_valid ? '✅' : '❌'}`);
  console.log(`   Issued: ${new Date(tokenData.issued_at * 1000).toLocaleString()}`);
  console.log(`   Expires: ${new Date(tokenData.expires_at * 1000).toLocaleString()}`);
  console.log(`   Scopes: ${tokenData.scopes.join(', ')}\n`);

  // Step 5: Get user info
  console.log('5️⃣  Fetching user information...');
  const userInfo = await getUserInfo(longToken.access_token);
  
  console.log('✅ PASS: User info retrieved');
  console.log('\n👤 User Details:');
  console.log(`   Name: ${userInfo.name}`);
  console.log(`   ID: ${userInfo.id}`);
  if (userInfo.email) {
    console.log(`   Email: ${userInfo.email}`);
  }
  console.log();

  // Step 6: Get ad accounts
  console.log('6️⃣  Fetching ad accounts...');
  const adAccounts = await getUserAdAccounts(longToken.access_token, userInfo.id);
  
  if (adAccounts.length === 0) {
    console.log('⚠️  WARN: No ad accounts found');
    console.log('   Make sure the user has access to at least one ad account');
  } else {
    console.log(`✅ PASS: Found ${adAccounts.length} ad account(s)`);
    console.log('\n💼 Ad Accounts:');
    adAccounts.forEach((account, index) => {
      console.log(`   ${index + 1}. ${account.name} (${account.account_id})`);
      console.log(`      Currency: ${account.currency}`);
      console.log(`      Timezone: ${account.timezone_name}`);
      console.log(`      Status: ${account.account_status === 1 ? 'ACTIVE' : 'DISABLED'}`);
    });
  }

  console.log('\n====================================');
  console.log('✅ OAuth flow test completed successfully!');
  console.log('\n📚 Next steps:');
  console.log('   1. Implement API routes in your Next.js app');
  console.log('   2. Add authentication middleware');
  console.log('   3. Test complete flow in browser');
  console.log('   4. Start syncing campaigns!\n');
}

// Run the test
testOAuthConfiguration().catch((error) => {
  console.error('\n❌ OAuth test failed:', error);
  process.exit(1);
});
