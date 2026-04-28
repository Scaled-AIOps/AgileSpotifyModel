/**
 * Purpose: ioredis client singleton.
 * Usage:   Default-exports the connected client; `connectRedis()` is called once at boot from index.ts before any service touches Redis.
 * Goal:    Centralise Redis connection management so there is one shared connection pool for the entire backend.
 *          Local dev / demos can opt into an in-memory ioredis-mock by setting
 *          REDIS_MOCK=true (or REDIS_URL=mock) — production refuses.
 * ToDo:    —
 */
import Redis, { Redis as RedisType } from 'ioredis';
import { env } from './env';

const useMock =
  env.REDIS_MOCK?.toLowerCase() === 'true' ||
  env.REDIS_URL.toLowerCase() === 'mock' ||
  env.REDIS_URL.toLowerCase() === 'memory';

if (useMock && env.NODE_ENV === 'production') {
  console.error('[Redis] In-memory mock is not allowed in production. Unset REDIS_MOCK / REDIS_URL=mock.');
  process.exit(1);
}

let redis: RedisType;

if (useMock) {
  // Lazy-load so production bundles don't pay the cost.
  const RedisMock = require('ioredis-mock');
  redis = new RedisMock() as RedisType;
  console.log('[Redis] Using in-memory mock (ioredis-mock)');
} else {
  redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  });

  redis.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });

  redis.on('connect', () => {
    console.log('[Redis] Connected');
  });
}

export async function connectRedis(): Promise<void> {
  if (useMock) return; // mock has no connection step
  await (redis as Redis).connect();
}

export async function pingRedis(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export default redis;
