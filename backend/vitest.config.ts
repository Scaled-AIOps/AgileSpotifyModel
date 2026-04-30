/**
 * Purpose: Vitest configuration for the backend test suite.
 * Usage:   Picked up by `vitest run` (the `npm test` script). Sets up the test
 *          environment vars (JWT signing keys, Redis URL, etc.), points coverage at
 *          api/ excluding tests/scripts/index/models/schemas, and pins
 *          coverage thresholds (80% lines/funcs/statements, 75% branches).
 * Goal:    Single source of truth for how the backend is tested locally and in
 *          CI — keeps test env isolated from dev env and enforces a coverage
 *          floor.
 * ToDo:    Add a `setupFiles` hook that flushes the in-memory Redis mock
 *          between tests so service tests cannot leak state.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['api/tests/**/*.test.ts'],
    setupFiles: ['api/tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SIGNING_KEY: 'test-jwt-signing-key-32-charsxxx',
      JWT_REFRESH_KEY: 'test-jwt-refresh-key-32-charsxxx',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      REDIS_URL: 'redis://localhost:6379',
      AUTH_METHOD: 'basic',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['api/**/*.ts'],
      exclude: [
        'api/tests/**',
        'api/scripts/**',
        'api/index.ts',
        'api/models/**',
        'api/schemas/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
