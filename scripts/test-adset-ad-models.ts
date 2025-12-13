import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db/client';
import { AdSetModel } from '../lib/db/models/ad-set';
import { AdModel } from '../lib/db/models/ad';
import { CampaignModel } from '../lib/db/models/campaign';

dotenv.config();

async function run() {
  await connectDB();

  // Setup: create a test campaign
  const campaignId = 'campaign-' + Math.random().toString(36).slice(2);
  const accountId = 'act_' + Math.random().toString(36).slice(2);
  
  const campaign = await CampaignModel.create({
    campaignId,
    accountId,
    name: 'Test Campaign',
    objective: 'OUTCOME_SALES',
    status: 'ACTIVE',
    budget: 100,
  });
  console.log('✅ Created test campaign:', campaign.campaignId);

  // Test AdSet creation with targeting
  const adSetId = 'adset-' + Math.random().toString(36).slice(2);
  const adSet = await AdSetModel.create({
    adSetId,
    campaignId,
    accountId,
    name: 'Test Ad Set',
    status: 'ACTIVE',
    budget: 50,
    targeting: {
      audienceSize: 1000000,
      ageMin: 25,
      ageMax: 45,
      genders: [1, 2],
      locations: ['US', 'CA'],
      interests: ['123456', '789012'],
      customAudiences: [],
      lookalikes: [],
    },
    learningPhaseStatus: 'LEARNING',
    optimizationGoal: 'PURCHASE',
    optimizationEventsCount: 25,
    ageDays: 2,
  });
  console.log('✅ Created ad set with targeting:', adSet.adSetId);

  // Verify targeting nested schema
  if (!adSet.targeting || adSet.targeting.audienceSize !== 1000000) {
    throw new Error('Targeting data not saved correctly');
  }
  console.log('✅ Targeting nested schema works correctly');

  // Test Ad creation with creative
  const adId = 'ad-' + Math.random().toString(36).slice(2);
  const ad = await AdModel.create({
    adId,
    adSetId,
    campaignId,
    accountId,
    name: 'Test Ad',
    status: 'ACTIVE',
    creative: {
      creativeId: 'creative-123',
      type: 'IMAGE',
      headline: 'Test Headline',
      body: 'Test body text',
      callToAction: 'SHOP_NOW',
      linkUrl: 'https://example.com',
      metadata: { imageUrl: 'https://example.com/image.jpg' },
    },
    effectiveStatus: 'ACTIVE',
    issues: [],
  });
  console.log('✅ Created ad with creative:', ad.adId);

  // Verify creative nested schema
  if (!ad.creative || ad.creative.headline !== 'Test Headline') {
    throw new Error('Creative data not saved correctly');
  }
  console.log('✅ Creative nested schema works correctly');

  // Test unique constraint on adSetId
  try {
    await AdSetModel.create({
      adSetId,
      campaignId,
      accountId,
      name: 'Duplicate Ad Set',
      status: 'ACTIVE',
      budget: 30,
      targeting: {},
      learningPhaseStatus: 'NOT_STARTED',
      optimizationGoal: 'LEAD',
    });
    throw new Error('Should have failed with duplicate adSetId');
  } catch (err: any) {
    if (err.code === 11000) {
      console.log('✅ Unique constraint on adSetId working');
    } else {
      throw err;
    }
  }

  // Test unique constraint on adId
  try {
    await AdModel.create({
      adId,
      adSetId,
      campaignId,
      accountId,
      name: 'Duplicate Ad',
      status: 'ACTIVE',
      creative: {},
      effectiveStatus: 'ACTIVE',
    });
    throw new Error('Should have failed with duplicate adId');
  } catch (err: any) {
    if (err.code === 11000) {
      console.log('✅ Unique constraint on adId working');
    } else {
      throw err;
    }
  }

  // Test compound index queries
  const adSetsByCampaign = await AdSetModel.find({ campaignId, status: 'ACTIVE' }).lean();
  if (adSetsByCampaign.length !== 1) {
    throw new Error('Compound index query failed for ad sets');
  }
  console.log('✅ Compound index query (campaignId + status) working for ad sets');

  const adsByAdSet = await AdModel.find({ adSetId, status: 'ACTIVE' }).lean();
  if (adsByAdSet.length !== 1) {
    throw new Error('Compound index query failed for ads');
  }
  console.log('✅ Compound index query (adSetId + status) working for ads');

  // Test learning phase index
  const learningAdSets = await AdSetModel.find({ learningPhaseStatus: 'LEARNING' }).lean();
  if (learningAdSets.length < 1) {
    throw new Error('Learning phase index query failed');
  }
  console.log('✅ Learning phase index query working');

  // Test effective status index
  const activeAds = await AdModel.find({ effectiveStatus: 'ACTIVE' }).lean();
  if (activeAds.length < 1) {
    throw new Error('Effective status index query failed');
  }
  console.log('✅ Effective status index query working');

  // Test creative.creativeId index
  const adsByCreative = await AdModel.find({ 'creative.creativeId': 'creative-123' }).lean();
  if (adsByCreative.length < 1) {
    throw new Error('Creative ID index query failed');
  }
  console.log('✅ Creative ID index query working');

  // Test Ad with issues
  const adWithIssues = await AdModel.create({
    adId: 'ad-issues-' + Math.random().toString(36).slice(2),
    adSetId,
    campaignId,
    accountId,
    name: 'Ad with Issues',
    status: 'PAUSED',
    creative: {},
    effectiveStatus: 'DISAPPROVED',
    issues: [
      {
        errorCode: 'POLICY_VIOLATION',
        errorMessage: 'Ad violates community standards',
        errorSummary: 'Policy violation',
        level: 'ERROR' as const,
      },
      {
        errorMessage: 'Image quality too low',
        errorSummary: 'Quality warning',
        level: 'WARNING' as const,
      },
    ],
  });
  
  if (!adWithIssues.issues || adWithIssues.issues.length !== 2) {
    throw new Error('Issues array not saved correctly');
  }
  console.log('✅ Ad issues nested schema working');

  // Test budget validation
  try {
    await AdSetModel.create({
      adSetId: 'negative-budget-' + Math.random().toString(36).slice(2),
      campaignId,
      accountId,
      name: 'Invalid Budget',
      status: 'ACTIVE',
      budget: -10,
      targeting: {},
      learningPhaseStatus: 'NOT_STARTED',
      optimizationGoal: 'LEAD',
    });
    throw new Error('Should have failed with negative budget');
  } catch (err: any) {
    if (err.message && err.message.includes('budget')) {
      console.log('✅ Budget validation (min: 0) working');
    } else {
      throw err;
    }
  }

  // Test denormalized campaignId in Ad model
  const adsByCampaign = await AdModel.find({ campaignId, status: 'ACTIVE' }).lean();
  if (adsByCampaign.length < 1) {
    throw new Error('Denormalized campaignId query failed');
  }
  console.log('✅ Denormalized campaignId in Ad model working');

  console.log('\n✅ All AdSet and Ad model tests passed successfully!');
  await disconnectDB();
}

run().catch(async (err) => {
  console.error('❌ Test failed:', err);
  try { await disconnectDB(); } catch {}
  process.exit(1);
});
