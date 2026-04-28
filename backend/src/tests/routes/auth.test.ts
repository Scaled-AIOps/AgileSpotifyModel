import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { env } from '../../config/env';

vi.mock('../../services/auth.service', () => ({
  register:       vi.fn(),
  login:          vi.fn(),
  refresh:        vi.fn(),
  logout:         vi.fn(),
  getMe:          vi.fn(),
  changeSignet: vi.fn(),
  loginByEmail:   vi.fn(),
}));

import * as authService from '../../services/auth.service';

const adminToken = () =>
  jwt.sign({ userId: 'admin-uid', memberId: 'admin-mid', role: 'Admin' }, env.JWT_SIGNING_KEY, { expiresIn: '1h' });

const memberToken = () =>
  jwt.sign({ userId: 'member-uid', memberId: 'member-mid', role: 'Member' }, env.JWT_SIGNING_KEY, { expiresIn: '1h' });

const mockResult = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  user: { id: 'uid', email: 'test@example.com', role: 'Admin' as const, memberId: 'mid', createdAt: new Date().toISOString() },
};

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/auth/register', () => {
  it('registers a new user (Admin only)', async () => {
    (authService.register as any).mockResolvedValue(mockResult);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: 'new@example.com', signet: 'Password1!', name: 'New User', role: 'Member' });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBe('mock-access-token');
  });

  it('returns 403 for non-admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${memberToken()}`)
      .send({ email: 'new@example.com', signet: 'Password1!', name: 'New', role: 'Member' });
    expect(res.status).toBe(403);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({});
    expect(res.status).toBe(401);
  });

  it('returns 400 on validation failure', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns tokens on success', async () => {
    (authService.login as any).mockResolvedValue(mockResult);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', signet: 'Password1!' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('mock-access-token');
  });

  it('returns 401 on bad credentials', async () => {
    const err: any = new Error('Invalid credentials');
    err.statusCode = 401;
    (authService.login as any).mockRejectedValue(err);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'x@x.com', signet: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 400 on missing fields', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/auth/refresh', () => {
  it('returns new access token when refresh cookie is valid', async () => {
    (authService.refresh as any).mockResolvedValue({ accessToken: 'new-access-token' });
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refreshToken=valid-refresh-token');
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBe('new-access-token');
  });

  it('returns 401 when refresh cookie is absent', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('logs out successfully', async () => {
    (authService.logout as any).mockResolvedValue(undefined);
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns current user', async () => {
    (authService.getMe as any).mockResolvedValue(mockResult.user);
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe('test@example.com');
  });

  it('returns 404 when user not found', async () => {
    (authService.getMe as any).mockResolvedValue(null);
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/auth/me/signet', () => {
  it('changes signet successfully', async () => {
    (authService.changeSignet as any).mockResolvedValue(undefined);
    const res = await request(app)
      .patch('/api/v1/auth/me/signet')
      .set('Authorization', `Bearer ${memberToken()}`)
      .send({ currentSignet: 'OldPass1!', newSignet: 'NewPass1!' });
    expect(res.status).toBe(200);
  });

  it('returns 400 on validation failure', async () => {
    const res = await request(app)
      .patch('/api/v1/auth/me/signet')
      .set('Authorization', `Bearer ${memberToken()}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── /auth/config ──────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/config', () => {
  it('returns basic:true and SSO flags false in default env', async () => {
    const res = await request(app).get('/api/v1/auth/config');
    expect(res.status).toBe(200);
    expect(res.body.basic).toBe(true);
    expect(res.body.jira).toBe(false);
    expect(res.body.ad).toBe(false);
  });
});

// ── /auth/jira ────────────────────────────────────────────────────────────────

describe('GET /api/v1/auth/jira', () => {
  it('returns 503 when JIRA_ENABLED is not true', async () => {
    const res = await request(app).get('/api/v1/auth/jira');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });
});

describe('GET /api/v1/auth/jira/callback', () => {
  it('redirects to login with error when error param is present', async () => {
    const res = await request(app)
      .get('/api/v1/auth/jira/callback?error=access_denied&error_description=User+denied+access');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/login?error=');
  });

  it('redirects to login with error when no code is provided', async () => {
    const res = await request(app).get('/api/v1/auth/jira/callback');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/login?error=');
  });

  it('redirects to login when token exchange returns no access_token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      json: async () => ({ error: 'invalid_code' }),
    }));
    const res = await request(app).get('/api/v1/auth/jira/callback?code=bad-code');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('jira_token_exchange_failed');
    vi.unstubAllGlobals();
  });

  it('redirects to login when Atlassian profile returns no email', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ access_token: 'tok' }) })
      .mockResolvedValueOnce({ json: async () => ({}) }),
    );
    const res = await request(app).get('/api/v1/auth/jira/callback?code=ok-code');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('jira_no_email');
    vi.unstubAllGlobals();
  });

  it('redirects to frontend with token on successful Jira login', async () => {
    (authService.loginByEmail as any).mockResolvedValue(mockResult);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ access_token: 'atlassian-tok' }) })
      .mockResolvedValueOnce({ json: async () => ({ email: 'test@example.com' }) }),
    );
    const res = await request(app).get('/api/v1/auth/jira/callback?code=valid-code');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/callback?token=mock-access-token');
    vi.unstubAllGlobals();
  });

  it('redirects to login when loginByEmail throws (no account)', async () => {
    const err: any = new Error('No account found for this email. Ask an admin to create one.');
    err.statusCode = 401;
    (authService.loginByEmail as any).mockRejectedValue(err);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ access_token: 'atlassian-tok' }) })
      .mockResolvedValueOnce({ json: async () => ({ email: 'unknown@example.com' }) }),
    );
    const res = await request(app).get('/api/v1/auth/jira/callback?code=valid-code');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/login?error=');
    vi.unstubAllGlobals();
  });
});

// ── /auth/microsoft ───────────────────────────────────────────────────────────

describe('GET /api/v1/auth/microsoft', () => {
  it('returns 503 when AD_ENABLED is not true', async () => {
    const res = await request(app).get('/api/v1/auth/microsoft');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not configured/i);
  });
});

describe('GET /api/v1/auth/microsoft/callback', () => {
  const makeFakeIdToken = (claims: Record<string, unknown>) => {
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    return `header.${payload}.sig`;
  };

  it('redirects to login with error when error param is present', async () => {
    const res = await request(app)
      .get('/api/v1/auth/microsoft/callback?error=access_denied&error_description=User+denied');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/login?error=');
  });

  it('redirects to login when no code is provided', async () => {
    const res = await request(app).get('/api/v1/auth/microsoft/callback');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/login?error=');
  });

  it('redirects to login when token exchange returns no id_token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      json: async () => ({ error: 'invalid_grant' }),
    }));
    const res = await request(app).get('/api/v1/auth/microsoft/callback?code=bad-code');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('ms_token_exchange_failed');
    vi.unstubAllGlobals();
  });

  it('redirects to login when id_token claims contain no email', async () => {
    const idToken = makeFakeIdToken({ sub: 'user-oid' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      json: async () => ({ id_token: idToken }),
    }));
    const res = await request(app).get('/api/v1/auth/microsoft/callback?code=ok-code');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('ms_no_email');
    vi.unstubAllGlobals();
  });

  it('extracts email from preferred_username claim and logs in', async () => {
    (authService.loginByEmail as any).mockResolvedValue(mockResult);
    const idToken = makeFakeIdToken({ preferred_username: 'user@corp.example.com' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      json: async () => ({ id_token: idToken }),
    }));
    const res = await request(app).get('/api/v1/auth/microsoft/callback?code=valid-code');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/callback?token=mock-access-token');
    expect(authService.loginByEmail).toHaveBeenCalledWith('user@corp.example.com');
    vi.unstubAllGlobals();
  });

  it('falls back to email claim when preferred_username is absent', async () => {
    (authService.loginByEmail as any).mockResolvedValue(mockResult);
    const idToken = makeFakeIdToken({ email: 'fallback@example.com' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      json: async () => ({ id_token: idToken }),
    }));
    const res = await request(app).get('/api/v1/auth/microsoft/callback?code=valid-code');
    expect(res.status).toBe(302);
    expect(authService.loginByEmail).toHaveBeenCalledWith('fallback@example.com');
    vi.unstubAllGlobals();
  });

  it('redirects to login when loginByEmail throws (no account)', async () => {
    const err: any = new Error('No account found for this email. Ask an admin to create one.');
    err.statusCode = 401;
    (authService.loginByEmail as any).mockRejectedValue(err);
    const idToken = makeFakeIdToken({ preferred_username: 'nobody@example.com' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      json: async () => ({ id_token: idToken }),
    }));
    const res = await request(app).get('/api/v1/auth/microsoft/callback?code=valid-code');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/auth/login?error=');
    vi.unstubAllGlobals();
  });
});
