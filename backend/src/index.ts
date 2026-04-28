/**
 * Purpose: Backend entry point.
 * Usage:   Loads environment from CONFIG_DIR/.env, connects to Redis, runs the YAML startup-seed in non-production, and starts the Express HTTP server.
 * Goal:    Single bootstrap script bundled to dist/server.js by webpack and invoked via `node dist/server.js` (or `npm run dev` for ts-node + nodemon).
 * ToDo:    —
 */
import dotenv from 'dotenv';
import path from 'path';
const CONFIG_DIR = process.env.CONFIG_DIR || path.resolve(process.cwd(), 'config');
dotenv.config({ path: path.join(CONFIG_DIR, '.env') });
import { env } from './config/env';
import redis, { connectRedis } from './config/redis';
import app from './app';
import { seedFromYaml } from './lib/seed-yaml';
import * as authService from './services/auth.service';

/** Ensure a default admin login exists in non-prod when the user table is empty.
 *  Useful for the in-memory mock + greenfield Redis instances. */
async function ensureDefaultAdmin(): Promise<void> {
  const userIds = await redis.smembers('users:all');
  if (userIds.length > 0) return;
  await authService.register('admin@example.com', 'Admin1234!', 'System Admin', 'Admin');
  console.log('[Seed] Created default admin: admin@example.com / Admin1234!');
}

async function main() {
  await connectRedis();
  if (env.NODE_ENV !== 'production') {
    await seedFromYaml();
    await ensureDefaultAdmin();
  }
  app.listen(env.PORT, () => {
    console.log(`[Server] Listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
