import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../config/.env') });
import { env } from './config/env';
import { connectRedis } from './config/redis';
import app from './app';

async function main() {
  await connectRedis();
  app.listen(env.PORT, () => {
    console.log(`[Server] Listening on port ${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
