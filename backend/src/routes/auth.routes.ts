/**
 * Purpose: Express router for authentication.
 * Usage:   Mounted at `/api/v1/auth` by routes/index.ts. Exposes login, register, refresh, logout, me, change-password, and the Jira / Microsoft SSO flows.
 * Goal:    All credential / token surface lives in one router so security reviews and rate-limiter hooks have a single entry point.
 * ToDo:    —
 */
import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { registerSchema, loginSchema, changePasswordSchema } from '../schemas/auth.schema';
import * as authService from '../services/auth.service';
import { env } from '../config/env';

const router = Router();

const REFRESH_COOKIE = 'refreshToken';
const COOKIE_OPTS = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 7 * 24 * 60 * 60 * 1000 };

const FRONTEND_URL = env.FRONTEND_URL ?? env.CORS_ORIGIN;
const BACKEND_URL  = env.BACKEND_URL  ?? `http://localhost:${env.PORT}`;

router.post('/register', authenticate, authorize('Admin'), validate(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role } = req.body;
    const result = await authService.register(email, password, name, role);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    res.status(201).json({ accessToken: result.accessToken, user: result.user });
  } catch (err) { next(err); }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (err) { next(err); }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) { res.status(401).json({ error: 'No refresh token' }); return; }
    const result = await authService.refresh(token);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.user!.userId);
    res.clearCookie(REFRESH_COOKIE);
    res.json({ message: 'Logged out' });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.user!.userId);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch (err) { next(err); }
});

router.patch('/me/password', authenticate, validate(changePasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ message: 'Password changed' });
  } catch (err) { next(err); }
});

// ── Auth config (tells the frontend which methods are enabled) ────────────────

router.get('/config', (_req: Request, res: Response) => {
  res.json({
    basic: env.AUTH_BASIC_ENABLED !== 'false',
    jira:  env.JIRA_ENABLED === 'true' && !!env.JIRA_CLIENT_ID && !!env.JIRA_CLIENT_SECRET,
    ad:    env.AD_ENABLED   === 'true' && !!env.AZURE_CLIENT_ID && !!env.AZURE_CLIENT_SECRET,
  });
});

// ── Jira / Atlassian OAuth 2.0 (3LO) ─────────────────────────────────────────

router.get('/jira', (_req: Request, res: Response) => {
  if (env.JIRA_ENABLED !== 'true' || !env.JIRA_CLIENT_ID || !env.JIRA_CLIENT_SECRET) {
    res.status(503).json({ error: 'Jira SSO not configured' }); return;
  }
  const params = new URLSearchParams({
    audience:      'api.atlassian.com',
    client_id:     env.JIRA_CLIENT_ID,
    scope:         'read:me',
    redirect_uri:  `${BACKEND_URL}/api/v1/auth/jira/callback`,
    response_type: 'code',
    prompt:        'consent',
  });
  res.redirect(`https://auth.atlassian.com/authorize?${params}`);
});

router.get('/jira/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, error, error_description } = req.query as Record<string, string>;
    if (error || !code) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=${encodeURIComponent(error_description ?? error ?? 'jira_error')}`);
    }

    const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'authorization_code',
        client_id:     env.JIRA_CLIENT_ID,
        client_secret: env.JIRA_CLIENT_SECRET,
        code,
        redirect_uri: `${BACKEND_URL}/api/v1/auth/jira/callback`,
      }),
    });
    const tokenData = await tokenRes.json() as Record<string, string>;
    if (!tokenData.access_token) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=jira_token_exchange_failed`);
    }

    const profileRes = await fetch('https://api.atlassian.com/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json() as Record<string, string>;
    const email = (profile.email ?? '').toLowerCase();
    if (!email) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=jira_no_email`);
    }

    const result = await authService.loginByEmail(email);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${result.accessToken}`);
  } catch (err) {
    const msg = (err as any)?.message ?? 'jira_failed';
    res.redirect(`${FRONTEND_URL}/auth/login?error=${encodeURIComponent(msg)}`);
  }
});

// ── Microsoft Azure AD / Entra ID OAuth 2.0 ──────────────────────────────────

router.get('/microsoft', (_req: Request, res: Response) => {
  if (env.AD_ENABLED !== 'true' || !env.AZURE_CLIENT_ID || !env.AZURE_CLIENT_SECRET) {
    res.status(503).json({ error: 'Microsoft SSO not configured' }); return;
  }
  const params = new URLSearchParams({
    client_id:      env.AZURE_CLIENT_ID,
    response_type:  'code',
    redirect_uri:   `${BACKEND_URL}/api/v1/auth/microsoft/callback`,
    scope:          'openid profile email',
    response_mode:  'query',
  });
  res.redirect(`https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params}`);
});

router.get('/microsoft/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, error, error_description } = req.query as Record<string, string>;
    if (error || !code) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=${encodeURIComponent(error_description ?? error ?? 'ms_error')}`);
    }

    const tokenRes = await fetch(`https://login.microsoftonline.com/${env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     env.AZURE_CLIENT_ID!,
        client_secret: env.AZURE_CLIENT_SECRET!,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  `${BACKEND_URL}/api/v1/auth/microsoft/callback`,
        scope:         'openid profile email',
      }),
    });
    const tokenData = await tokenRes.json() as Record<string, string>;
    if (!tokenData.id_token) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=ms_token_exchange_failed`);
    }

    // Extract email from the OIDC id_token JWT claims
    const claims = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64url').toString()) as Record<string, string>;
    const email = (claims.preferred_username ?? claims.email ?? claims.upn ?? '').toLowerCase();
    if (!email) {
      return res.redirect(`${FRONTEND_URL}/auth/login?error=ms_no_email`);
    }

    const result = await authService.loginByEmail(email);
    res.cookie(REFRESH_COOKIE, result.refreshToken, COOKIE_OPTS);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${result.accessToken}`);
  } catch (err) {
    const msg = (err as any)?.message ?? 'ms_failed';
    res.redirect(`${FRONTEND_URL}/auth/login?error=${encodeURIComponent(msg)}`);
  }
});

export default router;
