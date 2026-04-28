/**
 * Route-level integration tests for domain, tribe,
 * member, subdomain, infra, and org routes.
 * All services are mocked; only the HTTP layer is exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { env } from '../../config/env';

// ── Service mocks ─────────────────────────────────────────────────────────────

vi.mock('../../services/domain.service', () => ({
  findAll:      vi.fn().mockResolvedValue([]),
  findById:     vi.fn(),
  create:       vi.fn(),
  update:       vi.fn(),
  remove:       vi.fn(),
  getSubdomains:vi.fn().mockResolvedValue([]),
  getTribes:    vi.fn().mockResolvedValue([]),
  getTree:      vi.fn(),
}));

vi.mock('../../services/tribe.service', () => ({
  findAll:    vi.fn().mockResolvedValue([]),
  findById:   vi.fn(),
  create:     vi.fn(),
  update:     vi.fn(),
  remove:     vi.fn(),
  getSquads:  vi.fn().mockResolvedValue([]),
  assignLead: vi.fn(),
}));

vi.mock('../../services/member.service', () => ({
  findAll:       vi.fn().mockResolvedValue([]),
  findById:      vi.fn(),
  create:        vi.fn(),
  update:        vi.fn(),
  remove:        vi.fn(),
  getAssignments:vi.fn(),
}));

vi.mock('../../services/subdomain.service', () => ({
  findAll:  vi.fn().mockResolvedValue([]),
  findById: vi.fn(),
  create:   vi.fn(),
  update:   vi.fn(),
  remove:   vi.fn(),
  getTribes:vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/infra.service', () => ({
  findAll:  vi.fn().mockResolvedValue([]),
  findById: vi.fn(),
  remove:   vi.fn(),
}));

vi.mock('../../config/redis', () => ({
  default: {
    hgetall:  vi.fn().mockResolvedValue({ email: 'admin@example.com' }),
    smembers: vi.fn().mockResolvedValue([]),
    hset:     vi.fn(),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import * as domainSvc    from '../../services/domain.service';
import * as tribeSvc     from '../../services/tribe.service';
import * as memberSvc    from '../../services/member.service';
import * as subdomainSvc from '../../services/subdomain.service';
import * as infraSvc     from '../../services/infra.service';

const tok = (role = 'Admin') =>
  jwt.sign({ userId: 'uid', memberId: 'mid', role }, env.JWT_SIGNING_KEY, { expiresIn: '1h' });

beforeEach(() => { vi.clearAllMocks(); });

// ── Domain routes ─────────────────────────────────────────────────────────────

describe('domain routes', () => {
  const domain = { id: 'd-1', name: 'Payments', description: '', createdAt: '', updatedAt: '' };

  it('GET /domains returns list', async () => {
    (domainSvc.findAll as any).mockResolvedValue([domain]);
    const res = await request(app).get('/api/v1/domains').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('GET /domains requires auth', async () => {
    const res = await request(app).get('/api/v1/domains');
    expect(res.status).toBe(401);
  });

  it('POST /domains creates domain (Admin)', async () => {
    (domainSvc.create as any).mockResolvedValue(domain);
    const res = await request(app).post('/api/v1/domains').set('Authorization', `Bearer ${tok('Admin')}`).send({ name: 'Payments', description: '' });
    expect(res.status).toBe(201);
  });

  it('POST /domains returns 403 for Member', async () => {
    const res = await request(app).post('/api/v1/domains').set('Authorization', `Bearer ${tok('Member')}`).send({ name: 'X', description: '' });
    expect(res.status).toBe(403);
  });

  it('GET /domains/:id returns domain', async () => {
    (domainSvc.findById as any).mockResolvedValue(domain);
    const res = await request(app).get('/api/v1/domains/d-1').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('d-1');
  });

  it('GET /domains/:id returns 404', async () => {
    (domainSvc.findById as any).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/domains/missing').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(404);
  });

  it('PATCH /domains/:id updates domain', async () => {
    (domainSvc.update as any).mockResolvedValue({ ...domain, name: 'Updated' });
    const res = await request(app).patch('/api/v1/domains/d-1').set('Authorization', `Bearer ${tok('Admin')}`).send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /domains/:id deletes domain', async () => {
    (domainSvc.remove as any).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/domains/d-1').set('Authorization', `Bearer ${tok('Admin')}`);
    expect(res.status).toBe(204);
  });

  it('GET /domains/:id/subdomains returns list', async () => {
    (domainSvc.getSubdomains as any).mockResolvedValue(['sd-1']);
    const res = await request(app).get('/api/v1/domains/d-1/subdomains').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /domains/:id/tribes returns list', async () => {
    (domainSvc.getTribes as any).mockResolvedValue(['t-1']);
    const res = await request(app).get('/api/v1/domains/d-1/tribes').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /domains/:id/tree returns tree', async () => {
    (domainSvc.getTree as any).mockResolvedValue({ id: 'd-1', subdomains: [], tribes: [] });
    const res = await request(app).get('/api/v1/domains/d-1/tree').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /domains/:id/tree returns 404', async () => {
    (domainSvc.getTree as any).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/domains/missing/tree').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(404);
  });
});

// ── Tribe routes ──────────────────────────────────────────────────────────────

describe('tribe routes', () => {
  const tribe = { id: 't-1', name: 'Alpha', description: '', domainId: 'd-1', subdomainId: '', leadMemberId: '', releaseManager: '', agileCoach: '', confluence: '', createdAt: '', updatedAt: '' };

  it('GET /tribes returns list', async () => {
    (tribeSvc.findAll as any).mockResolvedValue([tribe]);
    const res = await request(app).get('/api/v1/tribes').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('POST /tribes creates tribe (Admin)', async () => {
    (tribeSvc.create as any).mockResolvedValue(tribe);
    const res = await request(app).post('/api/v1/tribes').set('Authorization', `Bearer ${tok('Admin')}`).send({ name: 'Alpha', domainId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(201);
  });

  it('GET /tribes/:id returns tribe', async () => {
    (tribeSvc.findById as any).mockResolvedValue(tribe);
    const res = await request(app).get('/api/v1/tribes/t-1').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('t-1');
  });

  it('GET /tribes/:id returns 404', async () => {
    (tribeSvc.findById as any).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/tribes/missing').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(404);
  });

  it('PATCH /tribes/:id updates tribe (TribeLead)', async () => {
    (tribeSvc.update as any).mockResolvedValue({ ...tribe, name: 'Beta' });
    const res = await request(app).patch('/api/v1/tribes/t-1').set('Authorization', `Bearer ${tok('TribeLead')}`).send({ name: 'Beta' });
    expect(res.status).toBe(200);
  });

  it('DELETE /tribes/:id deletes tribe (Admin)', async () => {
    (tribeSvc.remove as any).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/tribes/t-1').set('Authorization', `Bearer ${tok('Admin')}`);
    expect(res.status).toBe(204);
  });

  it('GET /tribes/:id/squads returns squad ids', async () => {
    (tribeSvc.getSquads as any).mockResolvedValue(['sq-1']);
    const res = await request(app).get('/api/v1/tribes/t-1/squads').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('PATCH /tribes/:id/lead assigns lead (Admin)', async () => {
    (tribeSvc.assignLead as any).mockResolvedValue({ ...tribe, leadMemberId: '00000000-0000-0000-0000-000000000001' });
    const res = await request(app).patch('/api/v1/tribes/t-1/lead').set('Authorization', `Bearer ${tok('Admin')}`).send({ leadMemberId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(200);
  });
});

// ── Member routes ─────────────────────────────────────────────────────────────

describe('member routes', () => {
  const member = { id: 'm-1', name: 'Alice', email: 'alice@example.com', role: 'Member', squadId: 'sq-1' };

  it('GET /members returns list', async () => {
    (memberSvc.findAll as any).mockResolvedValue([member]);
    const res = await request(app).get('/api/v1/members').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('POST /members creates member (PO+)', async () => {
    (memberSvc.create as any).mockResolvedValue(member);
    const res = await request(app).post('/api/v1/members').set('Authorization', `Bearer ${tok('PO')}`).send({ name: 'Alice', email: 'alice@example.com', role: 'Member' });
    expect(res.status).toBe(201);
  });

  it('POST /members returns 403 for Member role', async () => {
    const res = await request(app).post('/api/v1/members').set('Authorization', `Bearer ${tok('Member')}`).send({ name: 'Alice', email: 'alice@example.com', role: 'Member' });
    expect(res.status).toBe(403);
  });

  it('GET /members/:id returns member', async () => {
    (memberSvc.findById as any).mockResolvedValue(member);
    const res = await request(app).get('/api/v1/members/m-1').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /members/:id returns 404', async () => {
    (memberSvc.findById as any).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/members/missing').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(404);
  });

  it('PATCH /members/:id updates member (Admin)', async () => {
    (memberSvc.update as any).mockResolvedValue({ ...member, name: 'Alice Smith' });
    const res = await request(app).patch('/api/v1/members/m-1').set('Authorization', `Bearer ${tok('Admin')}`).send({ name: 'Alice Smith' });
    expect(res.status).toBe(200);
  });

  it('DELETE /members/:id removes member (Admin)', async () => {
    (memberSvc.remove as any).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/members/m-1').set('Authorization', `Bearer ${tok('Admin')}`);
    expect(res.status).toBe(204);
  });

  it('GET /members/:id/assignments returns assignments', async () => {
    (memberSvc.getAssignments as any).mockResolvedValue({ squadId: 'sq-1' });
    const res = await request(app).get('/api/v1/members/m-1/assignments').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });
});

// ── Subdomain routes ──────────────────────────────────────────────────────────

describe('subdomain routes', () => {
  const sd = { id: 'sd-1', name: 'Checkout', description: '', domainId: 'd-1' };

  it('GET /subdomains returns list', async () => {
    (subdomainSvc.findAll as any).mockResolvedValue([sd]);
    const res = await request(app).get('/api/v1/subdomains').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('POST /subdomains creates subdomain (Admin)', async () => {
    (subdomainSvc.create as any).mockResolvedValue(sd);
    const res = await request(app).post('/api/v1/subdomains').set('Authorization', `Bearer ${tok('Admin')}`).send({ name: 'Checkout', domainId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(201);
  });

  it('GET /subdomains/:id returns subdomain', async () => {
    (subdomainSvc.findById as any).mockResolvedValue(sd);
    const res = await request(app).get('/api/v1/subdomains/sd-1').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /subdomains/:id returns 404', async () => {
    (subdomainSvc.findById as any).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/subdomains/missing').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(404);
  });

  it('PATCH /subdomains/:id updates subdomain', async () => {
    (subdomainSvc.update as any).mockResolvedValue({ ...sd, name: 'Updated' });
    const res = await request(app).patch('/api/v1/subdomains/sd-1').set('Authorization', `Bearer ${tok('Admin')}`).send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /subdomains/:id deletes subdomain (Admin)', async () => {
    (subdomainSvc.remove as any).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/subdomains/sd-1').set('Authorization', `Bearer ${tok('Admin')}`);
    expect(res.status).toBe(204);
  });

  it('GET /subdomains/:id/tribes returns tribe ids', async () => {
    (subdomainSvc.getTribes as any).mockResolvedValue(['t-1']);
    const res = await request(app).get('/api/v1/subdomains/sd-1/tribes').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });
});

// ── Infra routes ──────────────────────────────────────────────────────────────

describe('infra routes', () => {
  const cluster = { platformId: 'plat-1', name: 'OCP-PRD', environment: 'prd', host: 'api.ocp.example.com', platform: 'OpenShift', platformType: 'on-prem', tokenId: 'tok-1', tags: '{}', createdAt: '' };

  it('GET /infra returns list', async () => {
    (infraSvc.findAll as any).mockResolvedValue([cluster]);
    const res = await request(app).get('/api/v1/infra').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /infra/:platformId returns cluster', async () => {
    (infraSvc.findById as any).mockResolvedValue(cluster);
    const res = await request(app).get('/api/v1/infra/plat-1').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /infra/:platformId returns 404', async () => {
    (infraSvc.findById as any).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/infra/missing').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(404);
  });

  it('DELETE /infra/:platformId deletes cluster (Admin)', async () => {
    (infraSvc.remove as any).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/infra/plat-1').set('Authorization', `Bearer ${tok('Admin')}`);
    expect(res.status).toBe(204);
  });
});

// ── Org routes ────────────────────────────────────────────────────────────────

import redis from '../../config/redis';

describe('org routes', () => {
  it('GET /org/tree returns domain trees', async () => {
    (redis.smembers as any).mockResolvedValue(['d-1']);
    (domainSvc.getTree as any).mockResolvedValue({ id: 'd-1', subdomains: [], tribes: [] });
    const res = await request(app).get('/api/v1/org/tree').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /org/tree returns empty array when no domains', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    const res = await request(app).get('/api/v1/org/tree').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /org/headcount returns tribe headcounts (TribeLead+)', async () => {
    (redis.smembers as any)
      .mockResolvedValueOnce(['t-1'])      // tribes:all
      .mockResolvedValueOnce(['sq-1'])     // tribe:t-1:squads
      .mockResolvedValueOnce(['m-1']);     // squad:sq-1:members
    (redis.hgetall as any)
      .mockResolvedValueOnce({ name: 'Alpha' })   // tribe
      .mockResolvedValueOnce({ name: 'Payments' }); // squad
    const res = await request(app).get('/api/v1/org/headcount').set('Authorization', `Bearer ${tok('TribeLead')}`);
    expect(res.status).toBe(200);
    expect(res.body[0].memberCount).toBe(1);
  });

  it('GET /org/headcount returns 403 for Member', async () => {
    const res = await request(app).get('/api/v1/org/headcount').set('Authorization', `Bearer ${tok('Member')}`);
    expect(res.status).toBe(403);
  });
});
