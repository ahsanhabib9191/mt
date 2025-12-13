import { initializeDatabase } from '../lib/db/index';
import { disconnectDB } from '../lib/db/client';
import { connectRedis, disconnectRedis } from '../lib/db/redis';

async function main() {
  try {
    await initializeDatabase();
    await connectRedis();
  } catch (err) {
    console.error('Initialization error:', err);
    process.exitCode = 1;
  } finally {
    await disconnectRedis();
    await disconnectDB();
  }
}

main();
