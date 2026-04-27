/**
 * Purpose: ioredis client singleton.
 * Usage:   Default-exports the connected client; `connectRedis()` is called once at boot from index.ts before any service touches Redis.
 * Goal:    Centralise Redis connection management so there is one shared connection pool for the entire backend.
 * ToDo:    —
 */
import Redis from 'ioredis';
import { env } from './env';

const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

export async function connectRedis(): Promise<void> {
  await redis.connect();
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
