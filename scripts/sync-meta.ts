import 'dotenv/config';
import { connectDB, disconnectDB } from '../lib/db';
import { MetaConnectionModel } from '../lib/db/models/MetaConnection';
import { redis } from '../lib/db/redis';
import { syncMetaConnection, syncAllPerformanceData } from '../lib/services/meta-sync/sync-service';
import logger from '../lib/utils/logger';

const LOCK_KEY = 'meta-sync:lock';
const INTERVAL_MINUTES = parseInt(process.env.META_SYNC_INTERVAL_MINUTES || '60', 10);
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

async function runSyncCycle(syncPerformance = false) {
  const connections = await MetaConnectionModel.find({
    status: { $in: ['ACTIVE', 'CONNECTED'] }
  }).exec();

  if (!connections || connections.length === 0) {
    logger.info('No active Meta connections found for sync');
    return {
      connectionsProcessed: 0,
      campaignsSynced: 0,
      adSetsSynced: 0,
      adsSynced: 0,
    };
  }

  let stats = {
    connectionsProcessed: 0,
    campaignsSynced: 0,
    adSetsSynced: 0,
    adsSynced: 0,
    performanceSnapshotsSynced: 0,
    errors: 0,
  };

  for (const connection of connections) {
    try {
      const result = await syncMetaConnection(connection, syncPerformance);

      stats.connectionsProcessed++;
      stats.campaignsSynced += result.campaignsSynced;
      stats.adSetsSynced += result.adSetsSynced;
      stats.adsSynced += result.adsSynced;

      if (result.performanceStats) {
        stats.performanceSnapshotsSynced +=
          result.performanceStats.campaigns +
          result.performanceStats.adSets +
          result.performanceStats.ads;
      }

      logger.info('Connection synced successfully', {
        tenantId: connection.tenantId,
        adAccountId: connection.adAccountId,
        result,
      });
    } catch (error) {
      stats.errors++;
      logger.error('Meta sync failed for connection', {
        tenantId: connection.tenantId,
        adAccountId: connection.adAccountId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  logger.info('Sync cycle completed', stats);
  return stats;
}

async function main() {
  try {
    await connectDB();

    const args = process.argv.slice(2);
    const runLoop = args.includes('--loop');
    const syncPerformance = args.includes('--performance');
    const intervalArg = args.find((arg) => arg.startsWith('--interval='));
    const intervalOverride = intervalArg ? parseInt(intervalArg.split('=')[1], 10) : undefined;
    const intervalMs = intervalOverride ? Math.max(intervalOverride, 1) * 60 * 1000 : INTERVAL_MS;
    const lockValue = `${process.pid}-${Date.now()}`;

    const ttlSeconds = Math.ceil(intervalMs / 1000) + 300; // Add 5 min buffer

    const execute = async () => {
      const locked = await acquireLock(lockValue, ttlSeconds);
      if (!locked) {
        logger.info('Another Meta sync job is currently running. Skipping this cycle.');
        return;
      }

      try {
        await runSyncCycle(syncPerformance);
      } finally {
        await releaseLock(lockValue);
      }
    };

    logger.info('Starting Meta sync job', {
      syncPerformance,
      runLoop,
      intervalMinutes: intervalMs / 60000
    });

    await execute();

    if (runLoop) {
      logger.info('Starting periodic Meta sync loop', { intervalMinutes: intervalMs / 60000 });

      while (true) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
        await execute();
      }
    } else {
      logger.info('Single sync cycle completed');
    }
  } catch (error) {
    logger.error('Meta sync job failed', {
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
