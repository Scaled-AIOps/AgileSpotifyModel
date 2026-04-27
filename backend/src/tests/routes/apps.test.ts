import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { env } from '../../config/env';

vi.mock('../../services/app.service', () => ({
  findAll:  vi.fn(),
  findById: vi.fn(),
  create:   vi.fn(),
  update:   vi.fn(),
  remove:   vi.fn(),
}));
vi.mock('../../services/appstatus.service', () => ({
  getLatestAll: vi.fn().mockResolvedValue({}),
  getHistory:   vi.fn().mockResolvedValue([]),
  record:       vi.fn(),
}));
vi.mock('../../services/audit.service', () => ({
  record:     vi.fn().mockResolvedValue({}),
  getForApp:  vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/member.service', () => ({
  findById: vi.fn(),
}));
vi.mock('../../services/squad.service', () => ({
  findById: vi.fn(),
}));
vi.mock('../../config/redis', () => ({
  default: {
    hgetall: vi.fn().mockResolvedValue({ email: 'admin@example.com' }),
  },
}));

import * as appService from '../../services/app.service';
import * as appstatusService from '../../services/appstatus.service';
import * as auditService from '../../services/audit.service';
import * as memberService from '../../services/member.service';
import * as squadService from '../../services/squad.service';

const token = (role = 'Admin', memberId = 'mid') =>
  jwt.sign({ userId: 'uid', memberId, role }, env.JWT_SECRET, { expiresIn: '1h' });

const mockApp = {
  appId: 'payments-api', gitRepo: 'https://github.com/acme/payments', squadId: 'sq-1',
  squadKey: 'PAY', status: 'active', tags: '{}', platforms: '{}', urls: '{}',
  javaVersion: '17', javaComplianceStatus: 'compliant', artifactoryUrl: '', xrayUrl: '',
  compositionViewerUrl: '', splunkUrl: '', probeHealth: '', probeInfo: '',
  probeLiveness: '', probeReadiness: '', createdAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (appService.findById as any).mockResolvedValue(mockApp);
  (appstatusService.getLatestAll as any).mockResolvedValue({});
  (memberService.findById as any).mockResolvedValue({ squadId: 'sq-1' });
  (squadService.findById as any).mockResolvedValue({ tribeId: 'tribe-1', key: 'PAY' });
});

describe('GET /api/v1/apps', () => {
  it('returns all apps', async () => {
    (appService.findAll as any).mockResolvedValue([mockApp]);
    const res = await request(app)
      .get('/api/v1/apps')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/apps');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/apps', () => {
  it('creates an app (TribeLead+)', async () => {
    (appService.findById as any).mockResolvedValueOnce(null); // not existing
    (appService.create as any).mockResolvedValue(mockApp);
    const res = await request(app)
      .post('/api/v1/apps')
      .set('Authorization', `Bearer ${token('TribeLead')}`)
      .send({ appId: 'payments-api', squadId: 'sq-1', status: 'active' });
    expect(res.status).toBe(201);
  });

  it('returns 409 when app already exists', async () => {
    (appService.findById as any).mockResolvedValueOnce(mockApp);
    const res = await request(app)
      .post('/api/v1/apps')
      .set('Authorization', `Bearer ${token('Admin')}`)
      .send({ appId: 'payments-api', squadId: 'sq-1', status: 'active' });
    expect(res.status).toBe(409);
  });

  it('returns 403 for Member role', async () => {
    const res = await request(app)
      .post('/api/v1/apps')
      .set('Authorization', `Bearer ${token('Member')}`)
      .send({ appId: 'new-app', squadId: 'sq-1', status: 'active' });
    expect(res.status).toBe(403);
  });

  it('returns 400 on invalid appId (spaces)', async () => {
    const res = await request(app)
      .post('/api/v1/apps')
      .set('Authorization', `Bearer ${token('Admin')}`)
      .send({ appId: 'invalid app id', squadId: 'sq-1', status: 'active' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/apps/:appId', () => {
  it('returns app with latestDeploys and editable flag', async () => {
    const res = await request(app)
      .get('/api/v1/apps/payments-api')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body.appId).toBe('payments-api');
    expect(res.body).toHaveProperty('editable');
    expect(res.body).toHaveProperty('latestDeploys');
  });

  it('returns 404 when app not found', async () => {
    (appService.findById as any).mockResolvedValue(null);
    const res = await request(app)
      .get('/api/v1/apps/nonexistent')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/apps/:appId', () => {
  it('updates app when user is in same tribe', async () => {
    (appService.update as any).mockResolvedValue({ app: { ...mockApp, status: 'inactive' }, diff: { status: { from: 'active', to: 'inactive' } } });
    const res = await request(app)
      .patch('/api/v1/apps/payments-api')
      .set('Authorization', `Bearer ${token('Member', 'mid')}`)
      .send({ status: 'inactive' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
  });

  it('records audit when diff is non-empty', async () => {
    (appService.update as any).mockResolvedValue({ app: mockApp, diff: { status: { from: 'active', to: 'inactive' } } });
    await request(app)
      .patch('/api/v1/apps/payments-api')
      .set('Authorization', `Bearer ${token('Admin')}`)
      .send({ status: 'inactive' });
    expect(auditService.record).toHaveBeenCalledOnce();
  });

  it('does not record audit when nothing changed', async () => {
    (appService.update as any).mockResolvedValue({ app: mockApp, diff: {} });
    await request(app)
      .patch('/api/v1/apps/payments-api')
      .set('Authorization', `Bearer ${token('Admin')}`)
      .send({ status: 'active' });
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('returns 403 when user is in different tribe', async () => {
    (memberService.findById as any).mockResolvedValue({ squadId: 'sq-other' });
    (squadService.findById as any)
      .mockResolvedValueOnce({ tribeId: 'other-tribe' }) // user squad
      .mockResolvedValueOnce({ tribeId: 'tribe-1' });    // app squad
    const res = await request(app)
      .patch('/api/v1/apps/payments-api')
      .set('Authorization', `Bearer ${token('Member', 'mid')}`)
      .send({ status: 'inactive' });
    expect(res.status).toBe(403);
  });

  it('returns 404 when app not found', async () => {
    (appService.findById as any).mockResolvedValue(null);
    const res = await request(app)
      .patch('/api/v1/apps/nonexistent')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/apps/:appId', () => {
  it('deletes app (Admin only)', async () => {
    (appService.remove as any).mockResolvedValue(undefined);
    const res = await request(app)
      .delete('/api/v1/apps/payments-api')
      .set('Authorization', `Bearer ${token('Admin')}`);
    expect(res.status).toBe(204);
  });

  it('returns 403 for non-Admin', async () => {
    const res = await request(app)
      .delete('/api/v1/apps/payments-api')
      .set('Authorization', `Bearer ${token('TribeLead')}`);
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/apps/:appId/audit', () => {
  it('returns audit log', async () => {
    (auditService.getForApp as any).mockResolvedValue([{ id: 'a1', appId: 'payments-api' }]);
    const res = await request(app)
      .get('/api/v1/apps/payments-api/audit')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/v1/apps/:appId/:env/deploys', () => {
  it('returns deploy history', async () => {
    (appstatusService.getHistory as any).mockResolvedValue([{ version: '1.0.0' }]);
    const res = await request(app)
      .get('/api/v1/apps/payments-api/prd/deploys')
      .set('Authorization', `Bearer ${token()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /api/v1/apps/:appId/:env/deploys', () => {
  it('records a deployment (ReleaseManager+)', async () => {
    const deploy = { version: '2.0.0', commitId: 'abc', branch: 'main', deployedBy: 'ci', state: 'success' };
    (appstatusService.record as any).mockResolvedValue({ ...deploy, appId: 'payments-api', env: 'prd' });
    const res = await request(app)
      .post('/api/v1/apps/payments-api/prd/deploys')
      .set('Authorization', `Bearer ${token('ReleaseManager')}`)
      .send(deploy);
    expect(res.status).toBe(201);
  });

  it('returns 403 for Member', async () => {
    const res = await request(app)
      .post('/api/v1/apps/payments-api/prd/deploys')
      .set('Authorization', `Bearer ${token('Member')}`)
      .send({ version: '1.0', commitId: 'a', branch: 'main', deployedBy: 'me', state: 'success' });
    expect(res.status).toBe(403);
  });
});
