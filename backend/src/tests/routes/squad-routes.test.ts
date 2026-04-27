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

vi.mock('../../services/backlog.service', () => ({
  findBySquad:  vi.fn().mockResolvedValue([]),
  findById:     vi.fn(),
  create:       vi.fn(),
  update:       vi.fn(),
  updateStatus: vi.fn(),
  remove:       vi.fn(),
  reorder:      vi.fn(),
}));

vi.mock('../../services/sprint.service', () => ({
  findBySquad: vi.fn().mockResolvedValue([]),
  findById:    vi.fn(),
  findActive:  vi.fn(),
  create:      vi.fn(),
  update:      vi.fn(),
  remove:      vi.fn(),
  start:       vi.fn(),
  complete:    vi.fn(),
  addItem:     vi.fn(),
  removeItem:  vi.fn(),
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

import * as squadSvc   from '../../services/squad.service';
import * as backlogSvc from '../../services/backlog.service';
import * as sprintSvc  from '../../services/sprint.service';

const tok = (role = 'Admin') =>
  jwt.sign({ userId: 'uid', memberId: 'mid', role }, env.JWT_SECRET, { expiresIn: '1h' });

const squad = { id: 'sq-1', name: 'Payments', description: '', tribeId: 't-1', leadMemberId: '', key: 'PAY', missionStatement: '', po: '', sm: '', jira: '', confluence: '', mailingList: '', tier: '1' };
const item  = { id: 'item-1', squadId: 'sq-1', title: 'Fix bug', type: 'Bug', status: 'Backlog', priority: 500, storyPoints: 0, description: '', sprintId: '', assigneeId: '', epicId: '', createdAt: '', updatedAt: '' };
const sprint = { id: 'sp-1', squadId: 'sq-1', name: 'Sprint 1', goal: '', status: 'Planning', startDate: '2025-01-01', endDate: '2025-01-14', velocity: 0, createdAt: '', updatedAt: '' };

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

// ── Backlog endpoints ─────────────────────────────────────────────────────────

describe('backlog endpoints', () => {
  it('GET /:squadId/backlog returns items', async () => {
    (backlogSvc.findBySquad as any).mockResolvedValue([item]);
    const res = await request(app).get('/api/v1/squads/sq-1/backlog').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /:squadId/backlog creates item (PO+)', async () => {
    (backlogSvc.create as any).mockResolvedValue(item);
    const res = await request(app).post('/api/v1/squads/sq-1/backlog').set('Authorization', `Bearer ${tok('PO')}`).send({ title: 'Fix bug' });
    expect(res.status).toBe(201);
  });

  it('GET /:squadId/backlog/:itemId returns item', async () => {
    (backlogSvc.findById as any).mockResolvedValue(item);
    const res = await request(app).get('/api/v1/squads/sq-1/backlog/item-1').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /:squadId/backlog/:itemId returns 404', async () => {
    (backlogSvc.findById as any).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/squads/sq-1/backlog/missing').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(404);
  });

  it('PATCH /:squadId/backlog/:itemId updates item', async () => {
    (backlogSvc.update as any).mockResolvedValue({ ...item, title: 'Updated' });
    const res = await request(app).patch('/api/v1/squads/sq-1/backlog/item-1').set('Authorization', `Bearer ${tok('PO')}`).send({ title: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('PATCH /:squadId/backlog/:itemId/status updates status', async () => {
    (backlogSvc.updateStatus as any).mockResolvedValue({ ...item, status: 'Done' });
    const res = await request(app).patch('/api/v1/squads/sq-1/backlog/item-1/status').set('Authorization', `Bearer ${tok()}`).send({ status: 'Done' });
    expect(res.status).toBe(200);
  });

  it('PATCH /:squadId/backlog/reorder reorders items', async () => {
    (backlogSvc.reorder as any).mockResolvedValue(undefined);
    const res = await request(app).patch('/api/v1/squads/sq-1/backlog/reorder').set('Authorization', `Bearer ${tok('PO')}`).send({ items: [{ id: '00000000-0000-0000-0000-000000000001', priority: 100 }] });
    expect(res.status).toBe(204);
  });

  it('DELETE /:squadId/backlog/:itemId removes item', async () => {
    (backlogSvc.remove as any).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/squads/sq-1/backlog/item-1').set('Authorization', `Bearer ${tok('PO')}`);
    expect(res.status).toBe(204);
  });
});

// ── Sprint endpoints ──────────────────────────────────────────────────────────

describe('sprint endpoints', () => {
  it('GET /:squadId/sprints returns sprints', async () => {
    (sprintSvc.findBySquad as any).mockResolvedValue([sprint]);
    const res = await request(app).get('/api/v1/squads/sq-1/sprints').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /:squadId/sprints creates sprint (PO+)', async () => {
    (sprintSvc.create as any).mockResolvedValue(sprint);
    const res = await request(app).post('/api/v1/squads/sq-1/sprints').set('Authorization', `Bearer ${tok('PO')}`).send({ name: 'Sprint 1', startDate: '2025-01-01T00:00:00.000Z', endDate: '2025-01-14T00:00:00.000Z' });
    expect(res.status).toBe(201);
  });

  it('GET /:squadId/sprints/active returns active sprint', async () => {
    (sprintSvc.findActive as any).mockResolvedValue(sprint);
    const res = await request(app).get('/api/v1/squads/sq-1/sprints/active').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /:squadId/sprints/active returns 404 when none', async () => {
    (sprintSvc.findActive as any).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/squads/sq-1/sprints/active').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(404);
  });

  it('GET /:squadId/sprints/:sprintId returns sprint', async () => {
    (sprintSvc.findById as any).mockResolvedValue(sprint);
    const res = await request(app).get('/api/v1/squads/sq-1/sprints/sp-1').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(200);
  });

  it('GET /:squadId/sprints/:sprintId returns 404', async () => {
    (sprintSvc.findById as any).mockResolvedValue(null);
    const res = await request(app).get('/api/v1/squads/sq-1/sprints/missing').set('Authorization', `Bearer ${tok()}`);
    expect(res.status).toBe(404);
  });

  it('PATCH /:squadId/sprints/:sprintId updates sprint', async () => {
    (sprintSvc.update as any).mockResolvedValue({ ...sprint, name: 'Updated' });
    const res = await request(app).patch('/api/v1/squads/sq-1/sprints/sp-1').set('Authorization', `Bearer ${tok('PO')}`).send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  it('DELETE /:squadId/sprints/:sprintId removes sprint', async () => {
    (sprintSvc.remove as any).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/squads/sq-1/sprints/sp-1').set('Authorization', `Bearer ${tok('PO')}`);
    expect(res.status).toBe(204);
  });

  it('POST /:squadId/sprints/:sprintId/start starts sprint', async () => {
    (sprintSvc.start as any).mockResolvedValue({ ...sprint, status: 'Active' });
    const res = await request(app).post('/api/v1/squads/sq-1/sprints/sp-1/start').set('Authorization', `Bearer ${tok('PO')}`);
    expect(res.status).toBe(200);
  });

  it('POST /:squadId/sprints/:sprintId/complete completes sprint', async () => {
    (sprintSvc.complete as any).mockResolvedValue({ ...sprint, status: 'Completed' });
    const res = await request(app).post('/api/v1/squads/sq-1/sprints/sp-1/complete').set('Authorization', `Bearer ${tok('PO')}`);
    expect(res.status).toBe(200);
  });

  it('POST /:squadId/sprints/:sprintId/items/:itemId adds item to sprint', async () => {
    (sprintSvc.addItem as any).mockResolvedValue(undefined);
    const res = await request(app).post('/api/v1/squads/sq-1/sprints/sp-1/items/item-1').set('Authorization', `Bearer ${tok('PO')}`);
    expect(res.status).toBe(204);
  });

  it('DELETE /:squadId/sprints/:sprintId/items/:itemId removes item from sprint', async () => {
    (sprintSvc.removeItem as any).mockResolvedValue(undefined);
    const res = await request(app).delete('/api/v1/squads/sq-1/sprints/sp-1/items/item-1').set('Authorization', `Bearer ${tok('PO')}`);
    expect(res.status).toBe(204);
  });
});

