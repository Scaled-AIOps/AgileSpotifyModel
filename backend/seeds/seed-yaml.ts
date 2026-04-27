/**
 * Manual YAML seed — thin wrapper around src/lib/seed-yaml.ts.
 * Usage: npm run seed:yaml
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../config/.env') });
import '../src/config/env';
import { connectRedis } from '../src/config/redis';
import redis from '../src/config/redis';
import { seedFromYaml } from '../src/lib/seed-yaml';

async function run() {
  await connectRedis();
  await seedFromYaml();
  await redis.quit();
}

run().catch((err) => { console.error(err); process.exit(1); });
