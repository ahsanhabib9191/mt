import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { fetchInsights } from '../lib/services/meta-sync/graph-client';
import { ensureConnectionAccessToken } from '../lib/services/meta-sync/graph-client';
import logger from '../lib/utils/logger';

dotenv.config();

async function main() {
    try {
        await connectDB();

        // 1. Find the active connection
        const connection = await MetaConnectionModel.findOne({ status: 'ACTIVE' }).exec();
        if (!connection) {
            logger.error('No active Meta connection found.');
            return;
        }

        logger.info('Using Meta Connection', { adAccountId: connection.adAccountId });

        const { accessToken } = await ensureConnectionAccessToken(connection);
        const userId = connection.tenantId;

        // 2. Fetch Account Level Insights (Impressions, Spend, Clicks)
        logger.info('--- Fetching Account Insights (Last 7 Days) ---');
        const accountInsights = await fetchInsights(
            accessToken,
            connection.adAccountId,
            {
                date_preset: 'last_7d',
                level: 'account',
                fields: 'impressions,spend,clicks,cpc,ctr,cpp,cost_per_unique_click,actions',
            },
            userId
        );
        console.log('Account Insights:', JSON.stringify(accountInsights, null, 2));

        // 3. Fetch Campaign Level Insights
        // We'll use the campaign ID we created earlier if it exists, or just list all campaigns
        logger.info('--- Fetching Campaign Insights ---');
        const campaignInsights = await fetchInsights(
            accessToken,
            connection.adAccountId,
            {
                date_preset: 'last_7d',
                level: 'campaign',
                fields: 'campaign_id,campaign_name,impressions,spend,clicks,cpc,ctr',
                limit: '5'
            },
            userId
        );
        console.log('Campaign Insights (Top 5):', JSON.stringify(campaignInsights, null, 2));

        // 4. Fetch Ad Set Level Insights
        logger.info('--- Fetching Ad Set Insights ---');
        const adSetInsights = await fetchInsights(
            accessToken,
            connection.adAccountId,
            {
                date_preset: 'last_7d',
                level: 'adset',
                fields: 'adset_id,adset_name,impressions,spend,clicks,cpc,ctr',
                limit: '5'
            },
            userId
        );
        console.log('Ad Set Insights (Top 5):', JSON.stringify(adSetInsights, null, 2));

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
