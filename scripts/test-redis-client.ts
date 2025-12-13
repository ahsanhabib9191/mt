import dotenv from 'dotenv';
import { connectRedis, disconnectRedis, redis } from '../lib/db/redis';

dotenv.config();

async function run() {
  console.log('Testing Redis client...');

  // Test connection
  await connectRedis();
  if (redis.status !== 'ready') throw new Error('Redis not connected');

  // Test basic operations
  const testKey = `test:${Math.random().toString(36).slice(2)}`;
  
  // SET operation
  await redis.set(testKey, 'test-value');
  
  // GET operation
  const value = await redis.get(testKey);
  if (value !== 'test-value') throw new Error('Redis GET returned incorrect value');

  // SET with expiration
  const expiringKey = `expiring:${Math.random().toString(36).slice(2)}`;
  await redis.set(expiringKey, 'expires-soon', 'EX', 2); // 2 seconds
  
  const expiringValue = await redis.get(expiringKey);
  if (expiringValue !== 'expires-soon') throw new Error('Expiring key not set correctly');

  const ttl = await redis.ttl(expiringKey);
  if (ttl <= 0 || ttl > 2) throw new Error('TTL not set correctly');

  // Test DELETE
  await redis.del(testKey);
  const deletedValue = await redis.get(testKey);
  if (deletedValue !== null) throw new Error('Key not deleted');

  // Test hash operations
  const hashKey = `hash:${Math.random().toString(36).slice(2)}`;
  await redis.hset(hashKey, 'field1', 'value1');
  await redis.hset(hashKey, 'field2', 'value2');

  const hashValue = await redis.hget(hashKey, 'field1');
  if (hashValue !== 'value1') throw new Error('HGET returned incorrect value');

  const allFields = await redis.hgetall(hashKey);
  if (allFields.field1 !== 'value1' || allFields.field2 !== 'value2') {
    throw new Error('HGETALL returned incorrect values');
  }

  // Test list operations
  const listKey = `list:${Math.random().toString(36).slice(2)}`;
  await redis.rpush(listKey, 'item1', 'item2', 'item3');

  const listLength = await redis.llen(listKey);
  if (listLength !== 3) throw new Error('List length incorrect');

  const listItems = await redis.lrange(listKey, 0, -1);
  if (listItems.length !== 3 || listItems[0] !== 'item1') {
    throw new Error('LRANGE returned incorrect items');
  }

  // Test set operations
  const setKey = `set:${Math.random().toString(36).slice(2)}`;
  await redis.sadd(setKey, 'member1', 'member2', 'member3');

  const isMember = await redis.sismember(setKey, 'member1');
  if (!isMember) throw new Error('SISMEMBER returned incorrect result');

  const setMembers = await redis.smembers(setKey);
  if (setMembers.length !== 3) throw new Error('SMEMBERS returned incorrect count');

  // Test sorted set operations (for rate limiting)
  const zsetKey = `zset:${Math.random().toString(36).slice(2)}`;
  const now = Date.now();
  await redis.zadd(zsetKey, now, `req-${now}`);
  await redis.zadd(zsetKey, now + 1000, `req-${now + 1000}`);

  const zcount = await redis.zcount(zsetKey, now, now + 2000);
  if (zcount !== 2) throw new Error('ZCOUNT returned incorrect count');

  // Test ZREMRANGEBYSCORE (cleanup old entries)
  await redis.zremrangebyscore(zsetKey, 0, now - 1000);
  const remainingCount = await redis.zcard(zsetKey);
  if (remainingCount !== 2) throw new Error('ZREMRANGEBYSCORE did not work correctly');

  // Test key expiration
  await new Promise(resolve => setTimeout(resolve, 2100)); // Wait for expiring key to expire
  const expiredValue = await redis.get(expiringKey);
  if (expiredValue !== null) throw new Error('Key did not expire');

  // Test increment operations
  const counterKey = `counter:${Math.random().toString(36).slice(2)}`;
  await redis.incr(counterKey);
  await redis.incr(counterKey);
  const counterValue = await redis.get(counterKey);
  if (counterValue !== '2') throw new Error('INCR did not work correctly');

  await redis.incrby(counterKey, 10);
  const counterValue2 = await redis.get(counterKey);
  if (counterValue2 !== '12') throw new Error('INCRBY did not work correctly');

  // Test EXISTS
  const exists = await redis.exists(counterKey);
  if (exists !== 1) throw new Error('EXISTS returned incorrect value');

  const notExists = await redis.exists('non-existent-key');
  if (notExists !== 0) throw new Error('EXISTS should return 0 for non-existent key');

  // Cleanup test keys
  await redis.del(hashKey, listKey, setKey, zsetKey, counterKey);

  // Test disconnection
  await disconnectRedis();
  // Wait a moment for disconnect to complete
  await new Promise(resolve => setTimeout(resolve, 100));
  // After quit(), status should not be 'ready' (might be 'end', 'close', or other states)
  if (redis.status === 'ready') throw new Error('Redis still connected after disconnect');

  // Reconnect for other tests
  await connectRedis();

  console.log('✅ All Redis client tests passed');
  await disconnectRedis();
}

run().catch(async (err) => {
  console.error('❌ Redis client tests failed:', err.message);
  try {
    await disconnectRedis();
  } catch {}
  process.exit(1);
});