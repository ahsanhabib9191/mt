import dotenv from 'dotenv';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { redis } from '../lib/db/redis';
import { syncAllPerformanceData } from '../lib/services/meta-sync/sync-service';
import logger from '../lib/utils/logger';

dotenv.config();

const LOCK_KEY = 'meta-performance-sync:lock';
const INTERVAL_MINUTES = parseInt(process.env.PERFORMANCE_SYNC_INTERVAL_MINUTES || '60', 10);
const INTERVAL_MS = Math.max(INTERVAL_MINUTES, 1) * 60 * 1000;

async function acquireLock(value: string, ttlSeconds: number) {
  const result = await redis.set(LOCK_KEY, value, 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

async function releaseLock(value: string) {
  const current = await redis.get(LOCK_KEY);
  if (current === value) {
    await redis.del(LOCK_KEY);
  }
}

async function runPerformanceSyncCycle(datePreset: string = 'yesterday') {
  const connections = await MetaConnectionModel.find({ 
    status: { $in: ['ACTIVE', 'CONNECTED'] } 
  }).exec();
  
  if (!connections || connections.length === 0) {
    logger.info('No active Meta connections found for performance sync');
    return {
      connectionsProcessed: 0,
      totalSnapshots: 0,
    };
  }

  let stats = {
    connectionsProcessed: 0,
    campaignSnapshots: 0,
    adSetSnapshots: 0,
    adSnapshots: 0,
    errors: 0,
  };

  for (const connection of connections) {
    try {
      const result = await syncAllPerformanceData(connection, datePreset);
      
      stats.connectionsProcessed++;
      stats.campaignSnapshots += result.campaigns;
      stats.adSetSnapshots += result.adSets;
      stats.adSnapshots += result.ads;
      
      logger.info('Performance data synced for connection', {
        tenantId: connection.tenantId,
        adAccountId: connection.adAccountId,
        result,
      });
    } catch (error) {
      stats.errors++;
      logger.error('Performance sync failed for connection', {
        tenantId: connection.tenantId,
        adAccountId: connection.adAccountId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  logger.info('Performance sync cycle completed', stats);
  return stats;
}

async function main() {
  try {
    await connectDB();
    
    const args = process.argv.slice(2);
    const runLoop = args.includes('--loop');
    const datePresetArg = args.find((arg) => arg.startsWith('--preset='));
    const datePreset = datePresetArg ? datePresetArg.split('=')[1] : 'yesterday';
    const intervalArg = args.find((arg) => arg.startsWith('--interval='));
    const intervalOverride = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : undefined;
    const intervalMs = intervalOverride ? Math.max(intervalOverride, 1) * 60 * 1000 : INTERVAL_MS;
    const lockValue = `${process.pid}-${Date.now()}`;

    const ttlSeconds = Math.ceil(intervalMs / 1000) + 300; // Add 5 min buffer

    const execute = async () => {
      const locked = await acquireLock(lockValue, ttlSeconds);
      if (!locked) {
        logger.info('Another performance sync job is currently running. Skipping this cycle.');
        return;
      }

      try {
        await runPerformanceSyncCycle(datePreset);
      } finally {
        await releaseLock(lockValue);
      }
    };

    logger.info('Starting performance sync job', { 
      datePreset, 
      runLoop, 
      intervalMinutes: intervalMs / 60000 
    });

    await execute();

    if (runLoop) {
      logger.info('Starting periodic performance sync loop', { intervalMinutes: intervalMs / 60000 });

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        await execute();
      }
    } else {
      logger.info('Single performance sync cycle completed');
    }
  } catch (error) {
    logger.error('Performance sync job failed', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  } finally {
    await disconnectDB();
    await redis.quit();
  }
}

main();
