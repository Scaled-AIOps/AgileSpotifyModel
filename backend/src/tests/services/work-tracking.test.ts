import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPipeline = {
  hset:    vi.fn().mockReturnThis(),
  hgetall: vi.fn().mockReturnThis(),
  set:     vi.fn().mockReturnThis(),
  sadd:    vi.fn().mockReturnThis(),
  srem:    vi.fn().mockReturnThis(),
  del:     vi.fn().mockReturnThis(),
  zadd:    vi.fn().mockReturnThis(),
  zrem:    vi.fn().mockReturnThis(),
  hget:    vi.fn().mockReturnThis(),
  exec:    vi.fn().mockResolvedValue([]),
};

vi.mock('../../config/redis', () => ({
  default: {
    get:      vi.fn(),
    hgetall:  vi.fn(),
    hset:     vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    exists:   vi.fn().mockResolvedValue(1),
    zrange:   vi.fn().mockResolvedValue([]),
    pipeline: vi.fn(() => mockPipeline),
  },
}));

vi.mock('../../lib/id', () => ({ generateId: vi.fn().mockReturnValue('gen-id') }));

import redis from '../../config/redis';
import * as backlogSvc from '../../services/backlog.service';
import * as sprintSvc  from '../../services/sprint.service';

beforeEach(() => {
  vi.clearAllMocks();
  (redis.pipeline as any).mockReturnValue(mockPipeline);
  (redis.exists as any).mockResolvedValue(1);
  (redis.get as any).mockResolvedValue(null);
});

// ── Backlog ──────────────────────────────────────────────────────────────────

describe('backlog.service', () => {
  const stored = { id: 'gen-id', squadId: 'sq-1', title: 'Fix bug', description: '', type: 'Bug', status: 'Backlog', priority: '500', storyPoints: '3', sprintId: '', assigneeId: '', epicId: '', createdAt: '', updatedAt: '' };

  beforeEach(() => { (redis.hgetall as any).mockResolvedValue(stored); });

  it('create: creates item when squad exists', async () => {
    const item = await backlogSvc.create('sq-1', { title: 'Fix bug', type: 'Bug' });
    expect(item.title).toBe('Fix bug');
    expect(item.priority).toBe(500);
    expect(mockPipeline.exec).toHaveBeenCalledOnce();
  });

  it('create: throws 404 when squad missing', async () => {
    (redis.exists as any).mockResolvedValue(0);
    await expect(backlogSvc.create('missing', { title: 'X' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('findBySquad: returns empty when no items', async () => {
    expect(await backlogSvc.findBySquad('sq-1')).toEqual([]);
  });

  it('findBySquad: returns items from pipeline', async () => {
    (redis.zrange as any).mockResolvedValue(['gen-id']);
    const pl = { hgetall: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([[null, stored]]) };
    (redis.pipeline as any).mockReturnValue(pl);
    const items = await backlogSvc.findBySquad('sq-1');
    expect(items).toHaveLength(1);
    expect(items[0].priority).toBe(500);
  });

  it('findById: returns null when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await backlogSvc.findById('missing')).toBeNull();
  });

  it('findById: returns parsed item when found', async () => {
    const item = await backlogSvc.findById('gen-id');
    expect(item?.title).toBe('Fix bug');
    expect(item?.storyPoints).toBe(3);
  });

  it('update: updates and returns item', async () => {
    const updated = await backlogSvc.update('gen-id', { title: 'Updated' });
    expect(updated.title).toBe('Updated');
  });

  it('update: updates ZSET when priority changes', async () => {
    await backlogSvc.update('gen-id', { priority: 100 });
    expect(mockPipeline.zadd).toHaveBeenCalledWith('squad:sq-1:backlog', 100, 'gen-id');
  });

  it('update: throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(backlogSvc.update('missing', {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('updateStatus: delegates to update', async () => {
    const item = await backlogSvc.updateStatus('gen-id', 'InProgress');
    expect(item.status).toBe('InProgress');
  });

  it('remove: removes item and ZSET entry', async () => {
    await backlogSvc.remove('gen-id');
    expect(mockPipeline.del).toHaveBeenCalledWith('backlogitem:gen-id');
    expect(mockPipeline.zrem).toHaveBeenCalledWith('squad:sq-1:backlog', 'gen-id');
  });

  it('remove: also removes from sprint set when item has sprintId', async () => {
    (redis.hgetall as any).mockResolvedValue({ ...stored, sprintId: 'sp-1' });
    await backlogSvc.remove('gen-id');
    expect(mockPipeline.srem).toHaveBeenCalledWith('sprint:sp-1:items', 'gen-id');
  });

  it('remove: throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(backlogSvc.remove('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('reorder: updates priorities in batch', async () => {
    await backlogSvc.reorder('sq-1', [{ id: 'a', priority: 100 }, { id: 'b', priority: 200 }]);
    expect(mockPipeline.zadd).toHaveBeenCalledTimes(2);
    expect(mockPipeline.exec).toHaveBeenCalledOnce();
  });
});

// ── Sprint ───────────────────────────────────────────────────────────────────

describe('sprint.service', () => {
  const stored = { id: 'gen-id', squadId: 'sq-1', name: 'Sprint 1', goal: 'Ship it', status: 'Planning', startDate: '2025-01-01', endDate: '2025-01-14', velocity: '0', createdAt: '', updatedAt: '' };

  beforeEach(() => { (redis.hgetall as any).mockResolvedValue(stored); });

  it('create: creates sprint', async () => {
    const sprint = await sprintSvc.create('sq-1', { name: 'Sprint 1', goal: 'Ship', startDate: '2025-01-01', endDate: '2025-01-14' });
    expect(sprint.name).toBe('Sprint 1');
    expect(sprint.status).toBe('Planning');
    expect(sprint.velocity).toBe(0);
  });

  it('create: throws 404 when squad missing', async () => {
    (redis.exists as any).mockResolvedValue(0);
    await expect(sprintSvc.create('missing', { name: 'X', goal: '', startDate: '2025-01-01', endDate: '2025-01-14' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('findBySquad: returns empty when no sprints', async () => {
    expect(await sprintSvc.findBySquad('sq-1')).toEqual([]);
  });

  it('findBySquad: returns sprints from pipeline', async () => {
    (redis.zrange as any).mockResolvedValue(['gen-id']);
    const pl = { hgetall: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([[null, stored]]) };
    (redis.pipeline as any).mockReturnValue(pl);
    const sprints = await sprintSvc.findBySquad('sq-1');
    expect(sprints).toHaveLength(1);
    expect(sprints[0].velocity).toBe(0);
  });

  it('findActive: returns null when none active', async () => {
    expect(await sprintSvc.findActive('sq-1')).toBeNull();
  });

  it('findActive: returns sprint when active sprint exists', async () => {
    (redis.get as any).mockResolvedValue('gen-id');
    const sprint = await sprintSvc.findActive('sq-1');
    expect(sprint?.id).toBe('gen-id');
  });

  it('findById: returns null when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await sprintSvc.findById('missing')).toBeNull();
  });

  it('findById: returns sprint when found', async () => {
    expect((await sprintSvc.findById('gen-id'))?.name).toBe('Sprint 1');
  });

  it('update: updates sprint', async () => {
    const updated = await sprintSvc.update('gen-id', { name: 'Updated Sprint' });
    expect(updated.name).toBe('Updated Sprint');
  });

  it('update: throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(sprintSvc.update('missing', {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('start: activates sprint', async () => {
    const sprint = await sprintSvc.start('sq-1', 'gen-id');
    expect(sprint.status).toBe('Active');
    expect(mockPipeline.set).toHaveBeenCalledWith('squad:sq-1:activeSprint', 'gen-id');
  });

  it('start: throws 409 when sprint already active', async () => {
    (redis.get as any).mockResolvedValue('other-sprint');
    await expect(sprintSvc.start('sq-1', 'gen-id')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('start: throws 404 when sprint not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(sprintSvc.start('sq-1', 'missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('start: throws 400 when sprint belongs to different squad', async () => {
    (redis.hgetall as any).mockResolvedValue({ ...stored, squadId: 'other-sq' });
    await expect(sprintSvc.start('sq-1', 'gen-id')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('complete: completes sprint with no items (velocity = 0)', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    const sprint = await sprintSvc.complete('sq-1', 'gen-id');
    expect(sprint.status).toBe('Completed');
    expect(sprint.velocity).toBe(0);
  });

  it('complete: throws 404 when sprint not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(sprintSvc.complete('sq-1', 'missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('complete: throws 400 when sprint in different squad', async () => {
    (redis.hgetall as any).mockResolvedValue({ ...stored, squadId: 'other-sq' });
    await expect(sprintSvc.complete('sq-1', 'gen-id')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('remove: removes sprint', async () => {
    await sprintSvc.remove('gen-id');
    expect(mockPipeline.del).toHaveBeenCalledWith('sprint:gen-id');
    expect(mockPipeline.srem).toHaveBeenCalledWith('sprints:all', 'gen-id');
  });

  it('remove: clears activeSprint key when this sprint was active', async () => {
    (redis.get as any).mockResolvedValue('gen-id');
    await sprintSvc.remove('gen-id');
    expect(mockPipeline.del).toHaveBeenCalledWith('squad:sq-1:activeSprint');
  });

  it('remove: throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(sprintSvc.remove('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('addItem: links item to sprint', async () => {
    await sprintSvc.addItem('gen-id', 'item-1');
    expect(mockPipeline.sadd).toHaveBeenCalledWith('sprint:gen-id:items', 'item-1');
  });

  it('removeItem: unlinks item from sprint', async () => {
    await sprintSvc.removeItem('gen-id', 'item-1');
    expect(mockPipeline.srem).toHaveBeenCalledWith('sprint:gen-id:items', 'item-1');
  });

  it('getItems: returns item ids', async () => {
    (redis.smembers as any).mockResolvedValue(['i-1', 'i-2']);
    expect(await sprintSvc.getItems('gen-id')).toEqual(['i-1', 'i-2']);
  });
});

