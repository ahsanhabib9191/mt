import Redis from 'ioredis';

// Support both REDIS_URL and individual REDIS_HOST/REDIS_PORT variables
const REDIS_URL = process.env.REDIS_URL;
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

/**
 * Global redis connection cache
 */
declare global {
  var redis: Redis | undefined;
}

let cached = global.redis;

if (!cached) {
  // Use REDIS_URL if provided, otherwise use individual parameters
  if (REDIS_URL) {
    cached = global.redis = new Redis(REDIS_URL, {
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  } else {
    cached = global.redis = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
}

export const redis = cached;

/**
 * Connect to Redis
 */
export async function connectRedis(): Promise<void> {
  if (redis.status !== 'ready') {
    await redis.connect();
    console.log('✅ Redis connected successfully');
  }
}

/**
 * Disconnect from Redis
 */
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  console.log('✅ Redis disconnected');
}

export default redis;
