import dotenv from 'dotenv';
import { redis } from '../lib/db/redis';
import { createRateLimiter } from '../lib/middleware/rate-limit';

dotenv.config();

async function run() {
  await redis.connect();
  const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 3, keyPrefix: 'test' });

  const key = 'ip:127.0.0.1';

  // Clear any existing data first
  await redis.del(`test:${key}`);

  // 3 allowed
  for (let i = 0; i < 3; i++) {
    const res = await limiter(key);
    if (!res.allowed) throw new Error(`Expected allowed at attempt ${i + 1}`);
  }
  // 4th blocked
  const res4 = await limiter(key);
  if (res4.allowed) throw new Error('Expected 4th attempt to be blocked');

  // Edge case: new key
  const resNew = await limiter('ip:127.0.0.2');
  if (!resNew.allowed) throw new Error('New key should be allowed');

  // Wait window to reset
  await new Promise((r) => setTimeout(r, 1100));
  const resAfter = await limiter(key);
  if (!resAfter.allowed) throw new Error('After window, should be allowed');

  console.log('Rate limiter tests passed');
  await redis.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try { await redis.disconnect(); } catch {}
  process.exit(1);
});
