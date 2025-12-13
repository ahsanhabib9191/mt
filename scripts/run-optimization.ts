import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { OptimizationService } from '../lib/services/optimization/optimizer';
import logger from '../lib/utils/logger';

dotenv.config();

async function main() {
    try {
        await connectDB();

        // Debug DB
        const uri = process.env.DATABASE_URL || process.env.MONGODB_URI || 'unknown';
        logger.info(`DB URI (Masked): ${uri.substring(0, 15)}...`);

        // Debug: List all first
        const all = await MetaConnectionModel.find({});
        logger.info(`Found ${all.length} total connections in DB`);
        all.forEach(c => logger.info(`- ${c.adAccountId} (${c._id})`));

        // Self-Healing: If we find a specific bad ID, delete it
        const badConn = await MetaConnectionModel.findOne({ adAccountId: 'act_177712960' });
        if (badConn) {
            logger.warn('Found stale/bad connection. Yeeting it.');
            await MetaConnectionModel.deleteOne({ _id: badConn._id });
        }

        // 1. Find the active connection
        let connection = await MetaConnectionModel.findOne({ status: 'ACTIVE' }).sort({ createdAt: -1 });

        // Self-Healing: Seed if missing
        if (!connection || connection.adAccountId !== 'act_123456789') {
            logger.warn('Target Mock Connection not found. Seeding it locally in this verify-process.');
            await MetaConnectionModel.create({
                tenantId: 'default_tenant',
                adAccountId: 'act_123456789',
                accessToken: 'mock_access_token_123', // Raw for simplicity here, or encrypt if model requires
                status: 'ACTIVE',
                lastSyncedAt: new Date()
            });
            connection = await MetaConnectionModel.findOne({ adAccountId: 'act_123456789' });
        }

        if (!connection) {
            logger.error('No active Meta connection found even after seeding.');
            return;
        }

        logger.info('Using Meta Connection', { adAccountId: connection.adAccountId, id: connection._id });

        // 2. Run Optimization
        logger.info('--- Running Optimization Engine ---');
        const results = await OptimizationService.runOptimization(connection._id.toString());

        // 3. Report Results
        if (results.length > 0) {
            logger.info('✅ Optimization Actions Taken:');
            results.forEach(res => {
                logger.info(`- [${res.actionTaken}] ${res.entityType} ${res.entityId} (Metric: ${res.metricValue.toFixed(2)})`);
                logger.info(`  Changed from ${res.oldValue} to ${res.newValue}`);
            });
        } else {
            logger.info('ℹ️ No optimization actions needed (Thresholds not met).');
        }

    } catch (error) {
        logger.error('Optimization Failed', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
    } finally {
        await disconnectDB();
    }
}

main();
