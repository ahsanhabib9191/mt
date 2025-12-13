
import mongoose from 'mongoose';
import { connectDB } from '../lib/db/client';
import { OptimizationLogModel } from '../lib/db/models/optimization-log';
import logger from '../lib/utils/logger';

async function main() {
    try {
        await connectDB();

        const TEST_ACCOUNT_ID = 'act_123456789';

        // 1. Simulate the Optimization Engine writing a log
        logger.info('🤖 Optimization Engine: Writing test log...');

        await OptimizationLogModel.create({
            action: 'PAUSE',
            entityType: 'AD',
            entityId: 'ad_987654321',
            accountId: TEST_ACCOUNT_ID,
            success: true,
            executedAt: new Date(),
            message: 'Paused ad "Summer Sale Creative" because CPA ($65) exceeded threshold ($50).',
            severity: 'ACTION',
            details: { cpa: 65, threshold: 50 }
        });

        console.log('✅ Log written successfully.');

        // 2. Simulate the Frontend API reading the log
        logger.info('📱 Frontend API: Fetching activity feed...');

        const logs = await OptimizationLogModel.find({
            accountId: TEST_ACCOUNT_ID
        })
            .sort({ executedAt: -1 })
            .limit(5)
            .lean();

        console.log(`\n📋 Activity Feed (Found ${logs.length} items):`);
        logs.forEach(log => {
            const symbol = log.severity === 'ACTION' ? '🔴' : log.severity === 'WARNING' ? '🟡' : '🔵';
            console.log(`${symbol} [${log.executedAt.toISOString()}] ${log.message}`);
        });

        if (logs.length > 0) {
            console.log('\n✅ Data Bridge Verification: PASSED');
        } else {
            console.error('\n❌ Data Bridge Verification: FAILED (No logs found)');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

main();
