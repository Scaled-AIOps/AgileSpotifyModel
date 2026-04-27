/**
 * Purpose: Vitest configuration for the backend test suite.
 * Usage:   Picked up by `vitest run` (the `npm test` script). Sets up the test
 *          environment vars (JWT secrets, Redis URL, etc.), points coverage at
 *          src/ excluding tests/scripts/index/models/schemas, and pins
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
    include: ['src/tests/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-jwt-secret-32-chars-longxxx',
      JWT_REFRESH_SECRET: 'test-refresh-secret-32-chars-xx',
      JWT_EXPIRES_IN: '15m',
      JWT_REFRESH_EXPIRES_IN: '7d',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGIN: 'http://localhost:4200',
      AUTH_METHOD: 'basic',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/tests/**',
        'src/scripts/**',
        'src/index.ts',
        'src/models/**',
        'src/schemas/**',
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
