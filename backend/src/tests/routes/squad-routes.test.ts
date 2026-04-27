import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../app';
import { env } from '../../config/env';

vi.mock('../../services/squad.service', () => ({
  findAll:          vi.fn().mockResolvedValue([]),
  findById:         vi.fn(),
  create:           vi.fn(),
  update:           vi.fn(),
  remove:           vi.fn(),
  getMembers:       vi.fn().mockResolvedValue([]),
  addMember:        vi.fn(),
  removeMember:     vi.fn(),
  updateMemberRole: vi.fn(),
  assignLead:       vi.fn(),
}));

vi.mock('../../services/app.service', () => ({
  findBySquad: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../config/redis', () => ({
  default: {
    hgetall:  vi.fn().mockResolvedValue({ email: 'admin@example.com' }),
    smembers: vi.fn().mockResolvedValue([]),
  },
}));

import * as squadSvc from '../../services/squad.service';

const tok = (role = 'Admin') =>
  jwt.sign({ userId: 'uid', memberId: 'mid', role }, env.JWT_SECRET, { expiresIn: '1h' });

const squad = { id: 'sq-1', name: 'Payments', description: '', tribeId: 't-1', leadMemberId: '', key: 'PAY', missionStatement: '', po: '', sm: '', jira: '', confluence: '', mailingList: '', tier: '1' };

beforeEach(() => {
  vi.clearAllMocks();
  (squadSvc.findById as any).mockResolvedValue(squad);
});

// ── Squad CRUD ────────────────────────────────────────────────────────────────

describe('GET /squads', () => {
  it('returns squad list', async () => {
    (squadSvc.findAll as any).mockResolvedValue([squad]);
    const res = await request(app).get('/api/v1/squads').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('POST /squads', () => {
  it('creates squad (TribeLead+)', async () => {
    (squadSvc.create as any).mockResolvedValue(squad);
    const res = await request(app).post('/api/v1/squads').set('Authorization', `Bearer ${tok('TribeLead')}`).send({ name: 'Payments', tribeId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(201);
  });

  it('returns 403 for Member', async () => {
    const res = await request(app).post('/api/v1/squads').set('Authorization', `Bearer ${tok('Member')}`).send({ name: 'X', tribeId: 't-1' });
    expect(res.status).toBe(403);
  });
});

describe('GET /squads/:id', () => {
  it('returns squad', async () => {
    const res = await request(app).get('/api/v1/squads/sq-1').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('sq-1');
  });

  it('returns 404 when not found', async () => {
    (squadSvc.findById as any).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/squads/missing').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(404);
  });
});

describe('PATCH /squads/:id', () => {
  it('updates squad (PO+)', async () => {
    (squadSvc.update as any).mockResolvedValue({ ...squad, name: 'Updated' });
    const res = await request(app).patch('/api/v1/squads/sq-1').set('Authorization', `Bearer ${tok('PO')}`).send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /squads/:id', () => {
  it('deletes squad (Admin)', async () => {
    (squadSvc.remove as any).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/squads/sq-1').set('Authorization', `Bearer ${tok('Admin')}`);
    expect(res.status).toBe(204);
  });
});

describe('squad members endpoints', () => {
  it('GET /:id/members returns member ids', async () => {
    (squadSvc.getMembers as any).mockResolvedValue(['m-1']);
    const res = await request(app).get('/api/v1/squads/sq-1/members').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('PATCH /:id/lead assigns lead', async () => {
    (squadSvc.assignLead as any).mockResolvedValue({ ...squad, leadMemberId: '00000000-0000-0000-0000-000000000001' });
    const res = await request(app).patch('/api/v1/squads/sq-1/lead').set('Authorization', `Bearer ${tok('TribeLead')}`).send({ leadMemberId: '00000000-0000-0000-0000-000000000001' });
    expect(res.status).toBe(200);
  });
});
