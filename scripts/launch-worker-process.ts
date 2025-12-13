
import 'dotenv/config'; // Must be first
import { connectDB } from '../lib/db/client';
import { connectRedis } from '../lib/db/redis';
import { LaunchQueue } from '../lib/services/queue/launch-queue';
import { processLaunchJob } from '../lib/services/workers/launch-worker';
import logger from '../lib/utils/logger';

async function startWorker() {
    logger.info('🚀 Launch Worker Process Starting...');

    try {
        await connectDB();
        logger.info('✅ DB Connected');
        await connectRedis();
        logger.info('✅ Redis Connected');

        let isRunning = true;

        // Handle Graceful Shutdown
        const shutdown = async () => {
            isRunning = false;
            logger.info('🛑 Shutting down worker...');
        };
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

        logger.info('👂 Listening for Launch Jobs...');

        while (isRunning) {
            try {
                // processNextJob will block/wait if queue is empty (using BRPOP or sleep inside)
                // My implementation of LaunchQueue.processNextJob uses RPOP + manual sleep logic or returns false immediately?
                // Providing explicit wait here if the queue returns false immediately.

                const processed = await LaunchQueue.processNextJob(processLaunchJob);

                if (!processed) {
                    // Queue empty, wait 1s before polling again
                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch (error) {
                logger.error('Worker Loop Error', { error });
                await new Promise(r => setTimeout(r, 5000)); // Backoff
            }
        }

    } catch (error) {
        logger.error('Fatal Worker Error', { error });
        process.exit(1);
    }
}

startWorker();
