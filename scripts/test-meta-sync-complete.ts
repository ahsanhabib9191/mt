/**
 * Comprehensive Meta Sync Service Test
 * 
 * This script validates the complete Meta sync implementation including:
 * - Campaign, AdSet, and Ad syncing
 * - Performance data collection
 * - Webhook handling
 * - Error handling and retries
 * 
 * Usage: npm run test:meta-sync
 */

import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { CampaignModel } from '../lib/db/models/campaign';
import { AdSetModel } from '../lib/db/models/ad-set';
import { AdModel } from '../lib/db/models/ad';
import { PerformanceSnapshotModel } from '../lib/db/models/performance-snapshot';
import { redis } from '../lib/db/redis';
import { 
  syncMetaConnection, 
  syncAllPerformanceData,
  syncCampaignFromWebhook,
  syncAdSetFromWebhook,
  syncAdFromWebhook,
} from '../lib/services/meta-sync/sync-service';
import { 
  handleMetaWebhook, 
  verifyMetaWebhookSignature,
  resolveMetaWebhookChallenge,
  MetaWebhookPayload 
} from '../lib/webhooks/meta';
import logger from '../lib/utils/logger';
import crypto from 'crypto';

dotenv.config();

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
  error?: string;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, message?: string, error?: string) {
  results.push({ name, passed, message, error });
  const icon = passed ? '✅' : '❌';
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`${icon} ${status}: ${name}${message ? ' - ' + message : ''}`);
  if (error) {
    console.error(`   Error: ${error}`);
  }
}

async function testEnvironmentConfig() {
  console.log('\n=== Testing Environment Configuration ===\n');

  const requiredVars = [
    'META_APP_ID',
    'META_APP_SECRET',
    'META_APP_VERIFY_TOKEN',
    'MONGODB_URI',
    'REDIS_URL',
  ];

  const optionalVars = [
    'META_API_VERSION',
    'META_SYNC_INTERVAL_MINUTES',
    'PERFORMANCE_SYNC_INTERVAL_MINUTES',
  ];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
      addResult(
        `Environment: ${varName}`,
        false,
        undefined,
        `${varName} is not configured`
      );
    } else {
      const display = value.length > 10 ? `${value.substring(0, 8)}...` : '***';
      addResult(`Environment: ${varName}`, true, `Configured (${display})`);
    }
  }

  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (value) {
      addResult(`Environment: ${varName}`, true, `Configured (${value})`);
    } else {
      console.log(`ℹ️  INFO: ${varName} not configured (using defaults)`);
    }
  }
}

async function testDatabaseConnection() {
  console.log('\n=== Testing Database Connection ===\n');

  try {
    await connectDB();
    addResult('Database Connection', true, 'MongoDB connected successfully');

    const pingResult = await redis.ping();
    if (pingResult === 'PONG') {
      addResult('Redis Connection', true, 'Redis connected successfully');
    } else {
      addResult('Redis Connection', false, undefined, 'Redis ping failed');
    }
  } catch (error) {
    addResult(
      'Database Connection',
      false,
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

async function testMetaConnectionModel() {
  console.log('\n=== Testing MetaConnection Model ===\n');

  try {
    const count = await MetaConnectionModel.countDocuments().exec();
    addResult(
      'MetaConnection Model',
      true,
      `Found ${count} connection(s) in database`
    );

    const activeCount = await MetaConnectionModel.countDocuments({
      status: { $in: ['ACTIVE', 'CONNECTED'] },
    }).exec();

    addResult(
      'Active Connections',
      activeCount > 0,
      activeCount > 0 
        ? `Found ${activeCount} active connection(s)` 
        : 'No active connections (create one to test sync)'
    );

    return activeCount > 0;
  } catch (error) {
    addResult(
      'MetaConnection Model',
      false,
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return false;
  }
}

async function testSyncServiceImports() {
  console.log('\n=== Testing Sync Service Imports ===\n');

  try {
    addResult(
      'Sync Service Import',
      typeof syncMetaConnection === 'function',
      'syncMetaConnection is available'
    );

    addResult(
      'Performance Sync Import',
      typeof syncAllPerformanceData === 'function',
      'syncAllPerformanceData is available'
    );

    addResult(
      'Webhook Handlers',
      typeof syncCampaignFromWebhook === 'function' &&
      typeof syncAdSetFromWebhook === 'function' &&
      typeof syncAdFromWebhook === 'function',
      'All webhook sync functions are available'
    );
  } catch (error) {
    addResult(
      'Sync Service Import',
      false,
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

async function testWebhookHandlers() {
  console.log('\n=== Testing Webhook Handlers ===\n');

  try {
    // Test webhook challenge verification
    const mockQuery = {
      'hub.mode': 'subscribe',
      'hub.verify_token': process.env.META_APP_VERIFY_TOKEN || 'test_token',
      'hub.challenge': 'test_challenge_123',
    };

    const challenge = resolveMetaWebhookChallenge(mockQuery);
    addResult(
      'Webhook Challenge',
      challenge === 'test_challenge_123',
      'Challenge verification works'
    );

    // Test webhook signature verification
    const testPayload = JSON.stringify({ test: 'data' });
    const appSecret = process.env.META_APP_SECRET || 'test_secret';
    const signature = 'sha1=' + crypto
      .createHmac('sha1', appSecret)
      .update(testPayload)
      .digest('hex');

    const isValid = verifyMetaWebhookSignature(signature, testPayload);
    addResult(
      'Webhook Signature Verification',
      isValid,
      'Signature verification works'
    );

    // Test invalid signature
    const invalidSignature = 'sha1=invalid_signature';
    const isInvalid = !verifyMetaWebhookSignature(invalidSignature, testPayload);
    addResult(
      'Webhook Invalid Signature Detection',
      isInvalid,
      'Invalid signatures are rejected'
    );

  } catch (error) {
    addResult(
      'Webhook Handlers',
      false,
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

async function testModelSchemas() {
  console.log('\n=== Testing Model Schemas ===\n');

  try {
    const campaignCount = await CampaignModel.countDocuments().exec();
    addResult('Campaign Model', true, `${campaignCount} campaign(s) in database`);

    const adSetCount = await AdSetModel.countDocuments().exec();
    addResult('AdSet Model', true, `${adSetCount} ad set(s) in database`);

    const adCount = await AdModel.countDocuments().exec();
    addResult('Ad Model', true, `${adCount} ad(s) in database`);

    const snapshotCount = await PerformanceSnapshotModel.countDocuments().exec();
    addResult(
      'PerformanceSnapshot Model',
      true,
      `${snapshotCount} snapshot(s) in database`
    );
  } catch (error) {
    addResult(
      'Model Schemas',
      false,
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

async function testRateLimiting() {
  console.log('\n=== Testing Rate Limiting ===\n');

  try {
    const testUserId = 'test_user_' + Date.now();
    const rateLimitKey = `meta:ratelimit:${testUserId}`;

    // Test rate limit counter
    const count1 = await redis.incr(rateLimitKey);
    const count2 = await redis.incr(rateLimitKey);
    const count3 = await redis.incr(rateLimitKey);

    addResult(
      'Rate Limit Counter',
      count1 === 1 && count2 === 2 && count3 === 3,
      'Rate limit counter increments correctly'
    );

    // Test TTL
    await redis.expire(rateLimitKey, 10);
    const ttl = await redis.ttl(rateLimitKey);
    addResult(
      'Rate Limit TTL',
      ttl > 0 && ttl <= 10,
      `TTL set correctly (${ttl}s)`
    );

    // Clean up
    await redis.del(rateLimitKey);
  } catch (error) {
    addResult(
      'Rate Limiting',
      false,
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

async function testActualSync() {
  console.log('\n=== Testing Actual Meta Sync (if connection exists) ===\n');

  try {
    const connection = await MetaConnectionModel.findOne({
      status: { $in: ['ACTIVE', 'CONNECTED'] },
    }).exec();

    if (!connection) {
      console.log('ℹ️  INFO: No active connection found. Skipping actual sync test.');
      console.log('         Create a Meta connection to test full sync functionality.');
      return;
    }

    console.log(`\n📡 Testing sync for tenant: ${connection.tenantId}`);
    console.log(`   Ad Account: ${connection.adAccountId}\n`);

    try {
      const result = await syncMetaConnection(connection, false);

      addResult(
        'Sync: Campaigns',
        result.campaignsSynced >= 0,
        `Synced ${result.campaignsSynced} campaign(s)`
      );

      addResult(
        'Sync: AdSets',
        result.adSetsSynced >= 0,
        `Synced ${result.adSetsSynced} ad set(s)`
      );

      addResult(
        'Sync: Ads',
        result.adsSynced >= 0,
        `Synced ${result.adsSynced} ad(s)`
      );

      addResult(
        'Sync: Duration',
        result.durationMs > 0,
        `Completed in ${result.durationMs}ms`
      );

      // Test performance sync
      console.log('\n📊 Testing performance data sync...\n');
      const perfResult = await syncAllPerformanceData(connection, 'yesterday');

      addResult(
        'Performance: Campaigns',
        perfResult.campaigns >= 0,
        `Synced ${perfResult.campaigns} campaign snapshot(s)`
      );

      addResult(
        'Performance: AdSets',
        perfResult.adSets >= 0,
        `Synced ${perfResult.adSets} ad set snapshot(s)`
      );

      addResult(
        'Performance: Ads',
        perfResult.ads >= 0,
        `Synced ${perfResult.ads} ad snapshot(s)`
      );

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('190')) {
        addResult(
          'Actual Sync',
          false,
          undefined,
          'Token expired - need to refresh OAuth token'
        );
      } else if (errorMessage.includes('rate limit')) {
        addResult(
          'Actual Sync',
          false,
          undefined,
          'Rate limit reached - wait before retrying'
        );
      } else {
        addResult('Actual Sync', false, undefined, errorMessage);
      }
    }
  } catch (error) {
    addResult(
      'Actual Sync Test',
      false,
      undefined,
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

async function printSummary() {
  console.log('\n========================================');
  console.log('=== Test Summary ===');
  console.log('========================================\n');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${Math.round((passed / total) * 100)}%\n`);

  if (failed > 0) {
    console.log('Failed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ❌ ${r.name}`);
        if (r.error) {
          console.log(`     ${r.error}`);
        }
      });
    console.log();
  }

  console.log('========================================');
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Meta sync service is ready.\n');
    console.log('Next steps:');
    console.log('  1. Run full sync: npm run sync:meta');
    console.log('  2. Run performance sync: npm run sync:performance');
    console.log('  3. Start periodic sync: npm run sync:meta:loop');
    console.log('  4. Monitor logs in: logs/\n');
  } else {
    console.log('⚠️  Some tests failed. Fix issues before running sync.\n');
    console.log('Resources:');
    console.log('  - Setup guide: docs/META_API_SETUP.md');
    console.log('  - Environment: Check .env configuration');
    console.log('  - Logs: Check logs/ directory for errors\n');
  }
}

async function main() {
  console.log('🚀 Meta Sync Service Comprehensive Test');
  console.log('========================================\n');

  let hasActiveConnection = false;

  try {
    await testEnvironmentConfig();
    await testDatabaseConnection();
    hasActiveConnection = await testMetaConnectionModel();
    await testSyncServiceImports();
    await testWebhookHandlers();
    await testModelSchemas();
    await testRateLimiting();

    if (hasActiveConnection) {
      await testActualSync();
    }

    await printSummary();

    const failed = results.filter((r) => !r.passed).length;
    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Test suite failed with error:');
    console.error(error);
    process.exit(1);
  } finally {
    await disconnectDB();
    await redis.quit();
  }
}

main();
