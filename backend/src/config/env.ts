import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
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
  JIRA_CLIENT_SECRET: z.string().optional(),
  // Microsoft Azure AD / Entra ID
  AD_ENABLED: z.string().default('false'),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_TENANT_ID: z.string().default('common'),
  AZURE_CLIENT_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
