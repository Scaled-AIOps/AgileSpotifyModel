/**
 * Purpose: Validated environment configuration.
 * Usage:   Imported as `import { env } from './config/env'` anywhere a config value is needed. Exits early with a clear error if required variables are missing or malformed.
 * Goal:    Catch misconfiguration at boot time rather than failing at request time, and give the rest of the codebase a typed `env` object to consume.
 * ToDo:    —
 */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  /** Set REDIS_MOCK=true (or REDIS_URL=mock) for an in-memory ioredis-mock instance —
   *  handy for local dev / demos without a running Redis. Production rejects this. */
  REDIS_MOCK: z.string().optional(),
  JWT_SIGNING_KEY: z.string().min(16),
  JWT_REFRESH_KEY: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  FRONTEND_URL: z.string().optional(),
  BACKEND_URL: z.string().optional(),
  // Explicit toggles (default: basic on, SSO off unless credentials are present)
  AUTH_BASIC_ENABLED: z.string().default('true'),
  // Jira / Atlassian OAuth 2.0 (3LO)
  JIRA_ENABLED: z.string().default('false'),
  JIRA_CLIENT_ID: z.string().optional(),
  JIRA_CLIENT_KEY: z.string().optional(),
  // Microsoft Azure AD / Entra ID
  AD_ENABLED: z.string().default('false'),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_TENANT_ID: z.string().default('common'),
  AZURE_CLIENT_KEY: z.string().optional(),
  /**
   * Bearer token used by automated ingest scripts (CI/CD, deploy hooks, fleet
   * importers) to call the four mutating app endpoints — `POST /apps`,
   * `PATCH /apps/:appId`, `POST /apps/:appId/:env/deploys`, and
   * `PATCH /apps/:appId/:env/deploys/:deployedAt` — without holding a
   * per-user JWT. Required in production; auto-generated on first boot in
   * dev/test and logged once. Treat the value as a credential.
   */
  INGEST_API_KEY: z.string().min(24).optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/**
 * Resolve the ingest token: prefer the explicit env var, otherwise (non-prod)
 * synthesize one once at boot and surface it on stdout so an operator can
 * copy it into their automation. In production a missing token aborts.
 */
function resolveIngestToken(): string {
  if (env.INGEST_API_KEY) return env.INGEST_API_KEY;
  if (env.NODE_ENV === 'production') {
    console.error('[env] INGEST_API_KEY must be set in production.');
    process.exit(1);
  }
  // Dev / test fallback. crypto.randomUUID is 36 chars; concat two for entropy.
  const { randomUUID } = require('node:crypto') as typeof import('node:crypto');
  const token = `${randomUUID()}-${randomUUID()}`.replace(/-/g, '');
  console.log(`[env] INGEST_API_KEY not set — using ephemeral dev token: ${token}`);
  console.log('[env]   Set INGEST_API_KEY in backend/config/.env to make it stable across restarts.');
  return token;
}

export const ingestToken = resolveIngestToken();
