import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db/client';
import { CampaignModel } from '../lib/db/models/campaign';
import { AdSetModel } from '../lib/db/models/ad-set';
import { AdModel } from '../lib/db/models/ad';
import { PerformanceSnapshotModel } from '../lib/db/models/performance-snapshot';
import { OptimizationLogModel } from '../lib/db/models/optimization-log';

dotenv.config();

async function run() {
  await connectDB();
  console.log('Testing database models...');

  const testId = Math.random().toString(36).slice(2);

  // Test Campaign model CRUD
  const campaign = await CampaignModel.create({
    campaignId: `cmp-${testId}`,
    accountId: `act_${testId}`,
    name: 'Test Campaign',
    objective: 'OUTCOME_SALES',
    status: 'ACTIVE',
    budget: 100,
    startDate: new Date(),
  });

  if (!campaign.campaignId) throw new Error('Campaign creation failed');
  if (campaign.budget !== 100) throw new Error('Campaign budget incorrect');
  if (campaign.objective !== 'OUTCOME_SALES') throw new Error('Campaign objective incorrect');

  // Test Campaign update
  campaign.status = 'PAUSED';
  campaign.budget = 150;
  await campaign.save();
  const updatedCampaign = await CampaignModel.findOne({ campaignId: campaign.campaignId });
  if (!updatedCampaign) throw new Error('Campaign not found after update');
  if (updatedCampaign.status !== 'PAUSED') throw new Error('Campaign status not updated');
  if (updatedCampaign.budget !== 150) throw new Error('Campaign budget not updated');

  // Test Campaign unique constraint
  try {
    await CampaignModel.create({
      campaignId: campaign.campaignId, // Duplicate
      accountId: `act_${testId}`,
      name: 'Duplicate',
      objective: 'OUTCOME_TRAFFIC',
      status: 'ACTIVE',
      budget: 50,
    });
    throw new Error('Duplicate campaignId should fail');
  } catch (err: any) {
    if (!err.message.includes('duplicate') && err.code !== 11000) {
      throw new Error('Expected duplicate key error for campaignId');
    }
  }

  // Test AdSet model with nested targeting
  const adSet = await AdSetModel.create({
    adSetId: `adset-${testId}`,
    campaignId: campaign._id, // Use MongoDB _id instead of campaignId string
    accountId: campaign.accountId,
    name: 'Test AdSet',
    status: 'ACTIVE',
    budget: 50,
    targeting: {
      audienceSize: 100000,
      ageMin: 18,
      ageMax: 65,
      genders: [1, 2],
      locations: ['US', 'CA'],
      interests: ['technology', 'marketing'],
      customAudiences: ['aud_123'],
      lookalikes: ['lookalike_456'],
    },
    learningPhaseStatus: 'LEARNING',
    optimizationGoal: 'CONVERSIONS',
    deliveryStatus: 'active',
    optimizationEventsCount: 25,
    ageDays: 2,
  });

  if (!adSet.adSetId) throw new Error('AdSet creation failed');
  if (!adSet.targeting) throw new Error('AdSet targeting not saved');
  if (adSet.targeting.audienceSize !== 100000) throw new Error('Targeting audienceSize incorrect');
  if (adSet.targeting.ageMin !== 18) throw new Error('Targeting ageMin incorrect');
  if (!adSet.targeting.genders || adSet.targeting.genders.length !== 2) {
    throw new Error('Targeting genders incorrect');
  }

  // Test AdSet learning phase status update
  adSet.learningPhaseStatus = 'ACTIVE';
  adSet.optimizationEventsCount = 50;
  await adSet.save();
  const updatedAdSet = await AdSetModel.findOne({ adSetId: adSet.adSetId });
  if (updatedAdSet?.learningPhaseStatus !== 'ACTIVE') throw new Error('Learning phase status not updated');

  // Test Ad model with creative and issues
  const ad = await AdModel.create({
    adId: `ad-${testId}`,
    adSetId: adSet._id, // Use MongoDB _id
    campaignId: campaign._id, // Use MongoDB _id
    accountId: campaign.accountId,
    name: 'Test Ad',
    status: 'ACTIVE',
    creative: {
      creativeId: `creative-${testId}`,
      type: 'image',
      headline: 'Amazing Product',
      body: 'Buy now and save 50%',
      callToAction: 'SHOP_NOW',
      linkUrl: 'https://example.com/product',
      metadata: { testKey: 'testValue' },
    },
    effectiveStatus: 'ACTIVE',
    issues: [
      {
        errorCode: 'TEST_ERROR',
        errorMessage: 'Test error message',
        errorSummary: 'Test summary',
        level: 'WARNING',
      },
    ],
  });

  if (!ad.adId) throw new Error('Ad creation failed');
  if (!ad.creative) throw new Error('Ad creative not saved');
  if (ad.creative.headline !== 'Amazing Product') throw new Error('Creative headline incorrect');
  if (!ad.issues || ad.issues.length !== 1) throw new Error('Ad issues not saved');
  if (ad.issues[0].level !== 'WARNING') throw new Error('Issue level incorrect');

  // Test Ad status changes
  ad.status = 'PAUSED';
  ad.effectiveStatus = 'PAUSED';
  await ad.save();
  const pausedAd = await AdModel.findOne({ adId: ad.adId });
  if (pausedAd?.status !== 'PAUSED') throw new Error('Ad status not updated');
  if (pausedAd?.effectiveStatus !== 'PAUSED') throw new Error('Ad effective status not updated');

  // Test Ad with disapproval
  const disapprovedAd = await AdModel.create({
    adId: `ad-disapproved-${testId}`,
    adSetId: adSet._id, // Use MongoDB _id
    campaignId: campaign._id, // Use MongoDB _id
    accountId: campaign.accountId,
    name: 'Disapproved Ad',
    status: 'PAUSED',
    creative: {
      headline: 'Violating Ad',
      body: 'Contains policy violation',
    },
    effectiveStatus: 'DISAPPROVED',
    issues: [
      {
        errorCode: 'POLICY_VIOLATION',
        errorMessage: 'Ad violates advertising policies',
        errorSummary: 'Policy violation detected',
        level: 'ERROR',
      },
    ],
  });

  if (disapprovedAd.effectiveStatus !== 'DISAPPROVED') throw new Error('Disapproved status not set');
  if (!disapprovedAd.issues?.find(i => i.level === 'ERROR')) {
    throw new Error('Error-level issue not found for disapproved ad');
  }

  // Test PerformanceSnapshot model
  const snapshot = await PerformanceSnapshotModel.create({
    entityType: 'AD',
    entityId: ad.adId,
    date: new Date('2025-01-01'),
    impressions: 10000,
    clicks: 500,
    spend: 250.50,
    conversions: 25,
    revenue: 1250.00,
  });

  if (!snapshot.entityId) throw new Error('PerformanceSnapshot creation failed');
  if (snapshot.impressions !== 10000) throw new Error('Impressions incorrect');
  if (snapshot.conversions !== 25) throw new Error('Conversions incorrect');

  // Calculate metrics from snapshot
  const ctr = (snapshot.clicks / snapshot.impressions) * 100;
  const cpa = snapshot.spend / snapshot.conversions;
  const roas = snapshot.revenue! / snapshot.spend;
  if (ctr < 4.9 || ctr > 5.1) throw new Error('CTR calculation incorrect'); // ~5%
  if (cpa < 10 || cpa > 10.1) throw new Error('CPA calculation incorrect'); // ~$10
  if (roas < 4.9 || roas > 5.1) throw new Error('ROAS calculation incorrect'); // ~5.0

  // Test PerformanceSnapshot unique constraint (date per entity)
  try {
    await PerformanceSnapshotModel.create({
      entityType: 'AD',
      entityId: ad.adId,
      date: new Date('2025-01-01'), // Same date
      impressions: 5000,
      clicks: 250,
      spend: 125,
      conversions: 10,
    });
    throw new Error('Duplicate performance snapshot should fail');
  } catch (err: any) {
    if (!err.message.includes('duplicate') && err.code !== 11000) {
      throw new Error('Expected duplicate key error for performance snapshot');
    }
  }

  // Test OptimizationLog model
  const log = await OptimizationLogModel.create({
    action: 'PAUSE',
    entityType: 'AD',
    entityId: ad.adId,
    ruleId: 'high-cpa-rule',
    success: true,
    executedAt: new Date(),
    details: {
      reason: 'CPA exceeded threshold',
      threshold: 15,
      actual: 25,
      previousStatus: 'ACTIVE',
      newStatus: 'PAUSED',
    },
  });

  if (!log.action) throw new Error('OptimizationLog creation failed');
  if (log.action !== 'PAUSE') throw new Error('Optimization action incorrect');
  if (!log.success) throw new Error('Optimization success flag incorrect');
  if (!log.details || !log.details.reason) throw new Error('Optimization details not saved');

  // Test querying logs by entity
  const logs = await OptimizationLogModel.find({
    entityType: 'AD',
    entityId: ad.adId,
  }).sort({ executedAt: -1 });
  if (logs.length === 0) throw new Error('Optimization logs not found');
  if (logs[0].action !== 'PAUSE') throw new Error('Latest log action incorrect');

  // Test campaign with multiple ad sets and ads
  const campaign2 = await CampaignModel.create({
    campaignId: `cmp-multi-${testId}`,
    accountId: `act_${testId}`,
    name: 'Multi-Level Campaign',
    objective: 'OUTCOME_TRAFFIC',
    status: 'ACTIVE',
    budget: 200,
  });

  const adSets = await Promise.all([
    AdSetModel.create({
      adSetId: `adset-1-${testId}`,
      campaignId: campaign2._id, // Use MongoDB _id
      accountId: campaign2.accountId,
      name: 'AdSet 1',
      status: 'ACTIVE',
      budget: 100,
      learningPhaseStatus: 'ACTIVE',
      optimizationGoal: 'LINK_CLICKS',
    }),
    AdSetModel.create({
      adSetId: `adset-2-${testId}`,
      campaignId: campaign2._id, // Use MongoDB _id
      accountId: campaign2.accountId,
      name: 'AdSet 2',
      status: 'PAUSED',
      budget: 50,
      learningPhaseStatus: 'NOT_STARTED',
      optimizationGoal: 'LINK_CLICKS',
    }),
  ]);

  // Query ad sets by campaign
  const campaignAdSets = await AdSetModel.find({ campaignId: campaign2._id });
  if (campaignAdSets.length !== 2) throw new Error('Expected 2 ad sets for campaign');

  const activeAdSets = await AdSetModel.find({
    campaignId: campaign2._id,
    status: 'ACTIVE',
  });
  if (activeAdSets.length !== 1) throw new Error('Expected 1 active ad set');

  // Test invalid enum values
  try {
    await CampaignModel.create({
      campaignId: `cmp-invalid-${testId}`,
      accountId: `act_${testId}`,
      name: 'Invalid Campaign',
      objective: 'INVALID_OBJECTIVE', // Invalid
      status: 'ACTIVE',
      budget: 100,
    });
    throw new Error('Invalid objective should fail validation');
  } catch (err: any) {
    if (!err.message.toLowerCase().includes('valid')) {
      throw new Error('Expected validation error for invalid enum');
    }
  }

  // Test negative budget validation
  try {
    await CampaignModel.create({
      campaignId: `cmp-negative-${testId}`,
      accountId: `act_${testId}`,
      name: 'Negative Budget',
      objective: 'OUTCOME_SALES',
      status: 'ACTIVE',
      budget: -50, // Invalid
    });
    throw new Error('Negative budget should fail validation');
  } catch (err: any) {
    if (!err.message.toLowerCase().includes('budget')) {
      throw new Error('Expected validation error for negative budget');
    }
  }

  console.log('✅ All model tests passed');
  await disconnectDB();
}

run().catch(async (err) => {
  console.error('❌ Model tests failed:', err.message);
  try {
    await disconnectDB();
  } catch {}
  process.exit(1);
});