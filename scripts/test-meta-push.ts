import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { CampaignModel } from '../lib/db/models/campaign';
import { AdSetModel } from '../lib/db/models/ad-set';
import { AdModel } from '../lib/db/models/ad';
import { pushEntityToMeta } from '../lib/services/meta-sync/sync-service';
import logger from '../lib/utils/logger';

dotenv.config();

function generateUniqueName(prefix: string) {
    return `${prefix}_${Date.now()}`;
}

async function main() {
    try {
        await connectDB();

        // 1. Find a valid connection
        const connection = await MetaConnectionModel.findOne({ status: 'ACTIVE' }).exec();
        if (!connection) {
            logger.error('No active Meta connection found. Please ensure you have a valid token in the DB.');
            return;
        }

        logger.info('Using Meta Connection', { adAccountId: connection.adAccountId, tenantId: connection.tenantId });

        // Debug: Test if we can decrypt the token
        try {
            const testToken = connection.getAccessToken();
            logger.info('✅ Token decryption test successful', { tokenLength: testToken.length });
        } catch (error) {
            logger.error('❌ Token decryption test failed', { error });
            throw error;
        }

        // 2. Create a test campaign locally (in memory, then push)
        // In a real app, we save to DB first, then push. Let's simulate that flow.

        logger.info('--- Step 1: Push Campaign ---');
        const campaignName = generateUniqueName('Test_Campaign');
        // Note: using temporary ID
        const campaignData = {
            campaignId: `tmp_camp_${Date.now()}`,
            accountId: connection.tenantId,
            name: campaignName,
            status: 'PAUSED',
            objective: 'OUTCOME_TRAFFIC',
            budget: 1000, // $10.00
        };

        logger.info('Pushing Campaign...', campaignData);
        const campaignResult = await pushEntityToMeta(connection, 'CAMPAIGN', campaignData as any);
        logger.info('Campaign Pushed Successfully', { id: campaignResult.id });

        // Update local model with real ID (Simulated)
        const realCampaignId = campaignResult.id;

        // 3. Create Ad Set
        logger.info('--- Step 2: Push Ad Set ---');
        const adSetName = generateUniqueName('Test_AdSet');
        const adSetData = {
            adSetId: `tmp_adset_${Date.now()}`,
            campaignId: realCampaignId,
            accountId: connection.tenantId,
            name: adSetName,
            status: 'PAUSED',
            // No budget - using campaign budget instead
            optimizationGoal: 'LINK_CLICKS',
            targeting: {
                ageMin: 25,
                ageMax: 55,
                genders: [1], // Male
                locations: ['US'],
            }
        };

        logger.info('Pushing Ad Set...', adSetData);
        const adSetResult = await pushEntityToMeta(connection, 'AD_SET', adSetData as any);
        logger.info('Ad Set Pushed Successfully', { id: adSetResult.id });

        const realAdSetId = adSetResult.id;

        // 4. Create Ad (Skipped for now as it requires valid Creative ID)
        logger.info('--- Step 3: Push Ad (Skipped - Needs Creative) ---');
        // const adName = generateUniqueName('Test_Ad');
        // const adData = { ... };
        // const adResult = await pushEntityToMeta(connection, 'AD', adData as any);

        logger.info('Test Complete. Please verify in Ads Manager.');

    } catch (error) {
        logger.error('Test Failed', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
    } finally {
        await disconnectDB();
    }
}

main();
