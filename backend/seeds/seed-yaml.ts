/**
 * Manual YAML seed — thin wrapper around src/lib/seed-yaml.ts.
 * Usage: npm run seed:yaml
 */

import dotenv from 'dotenv';
import path from 'path';
const CONFIG_DIR = process.env.CONFIG_DIR || path.resolve(process.cwd(), 'config');
dotenv.config({ path: path.join(CONFIG_DIR, '.env') });
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
