import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db/client';
import { AdSetModel } from '../lib/db/models/ad-set';
import { AdModel } from '../lib/db/models/ad';
import { CampaignModel } from '../lib/db/models/campaign';

dotenv.config();

async function run() {
  await connectDB();

  // Setup: create a test campaign
  const campaignId = 'campaign-enum-' + Math.random().toString(36).slice(2);
  const accountId = 'act_enum_' + Math.random().toString(36).slice(2);
  
  await CampaignModel.create({
    campaignId,
    accountId,
    name: 'Enum Test Campaign',
    objective: 'OUTCOME_SALES',
    status: 'ACTIVE',
    budget: 100,
  });

  // Test 1: Invalid AdSetStatus should fail
  console.log('Testing invalid AdSetStatus...');
  try {
    await AdSetModel.create({
      adSetId: 'adset-invalid-' + Math.random().toString(36).slice(2),
      campaignId,
      accountId,
      name: 'Invalid Status Ad Set',
      status: 'INVALID_STATUS' as any, // Force invalid value
      budget: 50,
      learningPhaseStatus: 'LEARNING',
      optimizationGoal: 'PURCHASE',
    });
    throw new Error('Should have failed with invalid status');
  } catch (err: any) {
    if (err.message && err.message.includes('enum')) {
      console.log('✅ AdSetStatus enum validation working');
    } else {
      throw err;
    }
  }

  // Test 2: Invalid LearningPhaseStatus should fail
  console.log('Testing invalid LearningPhaseStatus...');
  try {
    await AdSetModel.create({
      adSetId: 'adset-invalid-lp-' + Math.random().toString(36).slice(2),
      campaignId,
      accountId,
      name: 'Invalid Learning Phase Ad Set',
      status: 'ACTIVE',
      budget: 50,
      learningPhaseStatus: 'INVALID_PHASE' as any, // Force invalid value
      optimizationGoal: 'PURCHASE',
    });
    throw new Error('Should have failed with invalid learning phase status');
  } catch (err: any) {
    if (err.message && err.message.includes('enum')) {
      console.log('✅ LearningPhaseStatus enum validation working');
    } else {
      throw err;
    }
  }

  // Test 3: Invalid AdStatus should fail
  console.log('Testing invalid AdStatus...');
  const validAdSetId = 'adset-valid-' + Math.random().toString(36).slice(2);
  await AdSetModel.create({
    adSetId: validAdSetId,
    campaignId,
    accountId,
    name: 'Valid Ad Set for Ad Test',
    status: 'ACTIVE',
    budget: 50,
    learningPhaseStatus: 'LEARNING',
    optimizationGoal: 'PURCHASE',
  });

  try {
    await AdModel.create({
      adId: 'ad-invalid-status-' + Math.random().toString(36).slice(2),
      adSetId: validAdSetId,
      campaignId,
      accountId,
      name: 'Invalid Status Ad',
      status: 'INVALID_AD_STATUS' as any, // Force invalid value
      creative: {},
      effectiveStatus: 'ACTIVE',
    });
    throw new Error('Should have failed with invalid ad status');
  } catch (err: any) {
    if (err.message && err.message.includes('enum')) {
      console.log('✅ AdStatus enum validation working');
    } else {
      throw err;
    }
  }

  // Test 4: Invalid AdEffectiveStatus should fail
  console.log('Testing invalid AdEffectiveStatus...');
  try {
    await AdModel.create({
      adId: 'ad-invalid-effective-' + Math.random().toString(36).slice(2),
      adSetId: validAdSetId,
      campaignId,
      accountId,
      name: 'Invalid Effective Status Ad',
      status: 'ACTIVE',
      creative: {},
      effectiveStatus: 'INVALID_EFFECTIVE' as any, // Force invalid value
    });
    throw new Error('Should have failed with invalid effective status');
  } catch (err: any) {
    if (err.message && err.message.includes('enum')) {
      console.log('✅ AdEffectiveStatus enum validation working');
    } else {
      throw err;
    }
  }

  // Test 5: Valid enum values should work
  console.log('Testing valid enum values...');
  const adSet = await AdSetModel.create({
    adSetId: 'adset-valid-enum-' + Math.random().toString(36).slice(2),
    campaignId,
    accountId,
    name: 'Valid Enum Ad Set',
    status: 'PAUSED', // Valid status
    budget: 50,
    learningPhaseStatus: 'LEARNING_LIMITED', // Valid learning phase
    optimizationGoal: 'LEAD',
  });
  console.log('✅ Valid AdSetStatus and LearningPhaseStatus accepted');

  const ad = await AdModel.create({
    adId: 'ad-valid-enum-' + Math.random().toString(36).slice(2),
    adSetId: adSet.adSetId,
    campaignId,
    accountId,
    name: 'Valid Enum Ad',
    status: 'DRAFT', // Valid status
    creative: {},
    effectiveStatus: 'PENDING_REVIEW', // Valid effective status
  });
  console.log('✅ Valid AdStatus and AdEffectiveStatus accepted');

  // Test 6: Targeting is optional (can be omitted)
  console.log('Testing optional targeting field...');
  const adSetNoTargeting = await AdSetModel.create({
    adSetId: 'adset-no-targeting-' + Math.random().toString(36).slice(2),
    campaignId,
    accountId,
    name: 'Ad Set Without Targeting',
    status: 'ACTIVE',
    budget: 30,
    learningPhaseStatus: 'NOT_STARTED',
    optimizationGoal: 'LEAD',
    // targeting omitted - should default to {}
  });
  
  if (adSetNoTargeting.targeting && typeof adSetNoTargeting.targeting === 'object') {
    console.log('✅ Targeting defaults to empty object when omitted');
  } else {
    throw new Error('Targeting should default to empty object');
  }

  console.log('\n✅ All enum validation tests passed successfully!');
  await disconnectDB();
}

run().catch(async (err) => {
  console.error('❌ Enum validation test failed:', err);
  try { await disconnectDB(); } catch {}
  process.exit(1);
});
