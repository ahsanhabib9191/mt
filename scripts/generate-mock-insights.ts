import { initializeDatabase } from '../lib/db';
import { CampaignModel } from '../lib/db/models/campaign';
import { AdSetModel } from '../lib/db/models/ad-set';
import { AdModel } from '../lib/db/models/ad';
import { PerformanceSnapshotModel } from '../lib/db/models/performance-snapshot';
import logger from '../lib/utils/logger';

async function generateMockInsights() {
    await initializeDatabase();
    logger.info('Database initialized');

    // Clean existing snapshots
    await PerformanceSnapshotModel.deleteMany({});
    logger.info('Cleaned old performance snapshots');

    let campaigns = await CampaignModel.find({ status: { $ne: 'ARCHIVED' } });
    if (campaigns.length === 0) {
        logger.info('No campaigns found. Creating a Mock Campaign for visualization...');
        const mockCampaign = await CampaignModel.create({
            campaignId: 'cmp_' + Math.floor(Math.random() * 1000000),
            accountId: 'act_123456789', // Default mock account
            name: 'Mock Traffic Campaign - Generated',
            status: 'ACTIVE',
            objective: 'OUTCOME_TRAFFIC',
            budget: 50,
            startDate: new Date(),
        });

        await AdSetModel.create({
            adSetId: 'adj_' + Math.floor(Math.random() * 1000000),
            campaignId: mockCampaign.campaignId,
            accountId: mockCampaign.accountId,
            name: 'Mock Ad Set (Broad)',
            status: 'ACTIVE',
            budget: 50,
            learningPhaseStatus: 'LEARNING',
            optimizationGoal: 'LINK_CLICKS'
        });

        // Re-fetch
        campaigns = await CampaignModel.find({ status: { $ne: 'ARCHIVED' } });
    }

    const adSets = await AdSetModel.find({ status: { $ne: 'ARCHIVED' } });
    const ads = await AdModel.find({ status: { $ne: 'ARCHIVED' } });

    logger.info(`Found ${campaigns.length} campaigns, ${adSets.length} ad sets, ${ads.length} ads`);

    const days = 7;
    const now = new Date();

    const entities = [
        ...campaigns.map(c => ({ type: 'CAMPAIGN', id: c.campaignId, accountId: c.accountId })),
        ...adSets.map(a => ({ type: 'AD_SET', id: a.adSetId, accountId: a.accountId })),
        ...ads.map(a => ({ type: 'AD', id: a.adId, accountId: a.accountId }))
    ];

    for (const entity of entities) {
        for (let i = 0; i < days; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            // Mock Data Logic
            // Make recent days perform better
            const performanceFactor = 1 + (1 / (i + 1));

            // Random Base
            const impressions = Math.floor(Math.random() * 1000 * performanceFactor);
            const clicks = Math.floor(impressions * (0.01 + Math.random() * 0.02)); // 1-3% CTR
            const spend = clicks * (0.5 + Math.random() * 1.5); // $0.50 - $2.00 CPC

            // Conversion Rate varies
            let conversionRate = 0.05 + Math.random() * 0.1; // 5-15% CVR

            // Inject "Bad" Performance for testing Optimization Rules
            // If entity ID ends in '2', make it bad (High CPA)
            if (entity.id.endsWith('2')) {
                conversionRate = 0.01; // Low CVR
            }
            // If entity ID ends in '8', make it Great (High ROAS)
            if (entity.id.endsWith('8')) {
                conversionRate = 0.20; // High CVR
            }

            const conversions = Math.floor(clicks * conversionRate);
            const revenue = conversions * (20 + Math.random() * 30); // $20-$50 AOV

            const cpm = (spend / impressions) * 1000 || 0;
            const cpc = spend / clicks || 0;
            const ctr = (clicks / impressions) * 100 || 0;
            const cpa = spend / conversions || 0;
            const roas = revenue / spend || 0;

            await PerformanceSnapshotModel.create({
                entityType: entity.type,
                entityId: entity.id,
                date: date,
                accountId: entity.accountId,
                impressions,
                clicks,
                spend,
                conversions,
                revenue,
                reach: Math.floor(impressions * 0.8),
                frequency: 1.2,
                cpm,
                cpc,
                ctr,
                cpa,
                roas
            });
        }
    }

    logger.info('Successfully generated mock insights data');
    process.exit(0);
}

generateMockInsights().catch(e => {
    logger.error('Failed to generate insights', e);
    process.exit(1);
});
