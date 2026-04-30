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

// All keys are namespaced under this prefix so we can safely share a Redis
// instance with other apps. ioredis applies the prefix transparently to
// every command (including pipeline/multi), so service code keeps using
// bare key names like `user:<id>` and `app:<appId>`.
export const KEY_PREFIX = env.REDIS_KEY_PREFIX || 'scaledaiops:';

let redis: RedisType;

// Splice REDIS_USERNAME / REDIS_AUTH into the connection URL so the auth
// credential never has to appear in REDIS_URL itself. Existing inline
// credentials in REDIS_URL (`redis://user:cred@host`) take precedence — we
// only inject when the URL has no userinfo segment.
function applyAuthToUrl(rawUrl: string): string {
  if (!env.REDIS_AUTH && !env.REDIS_USERNAME) return rawUrl;
  try {
    const u = new URL(rawUrl);
    if (u.username || u.password) return rawUrl;
    if (env.REDIS_USERNAME) u.username = encodeURIComponent(env.REDIS_USERNAME);
    if (env.REDIS_AUTH)     u.password = encodeURIComponent(env.REDIS_AUTH);
    return u.toString();
  } catch {
    // REDIS_URL isn't a parseable URL (rare; e.g. unix socket) — leave as-is.
    return rawUrl;
  }
}

if (useMock) {
  // Lazy-load so production bundles don't pay the cost.
  const RedisMock = require('ioredis-mock');
  redis = new RedisMock({ keyPrefix: KEY_PREFIX }) as RedisType;
  console.log(`[Redis] Using in-memory mock (ioredis-mock) — keyPrefix='${KEY_PREFIX}'`);
} else {
  redis = new Redis(applyAuthToUrl(env.REDIS_URL), {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    keyPrefix: KEY_PREFIX,
  });

  redis.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });

  redis.on('connect', () => {
    console.log(`[Redis] Connected — keyPrefix='${KEY_PREFIX}'`);
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
