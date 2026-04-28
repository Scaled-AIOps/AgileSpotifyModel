import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/redis', () => ({
  default: {
    zadd:             vi.fn().mockResolvedValue(1),
    zremrangebyrank:  vi.fn().mockResolvedValue(0),
    zrevrange:        vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../lib/id', () => ({
  generateId: vi.fn().mockReturnValue('audit-id-1'),
}));

import redis from '../../config/redis';
import { record, getForApp } from '../../services/audit.service';

beforeEach(() => vi.clearAllMocks());

const baseEntry = {
  appId: 'my-app',
  userId: 'u1',
  userEmail: 'user@example.com',
  action: 'update',
  changes: { status: { from: 'active', to: 'inactive' } },
};

describe('record', () => {
  it('stores an audit entry and returns it with id and changedAt', async () => {
    const entry = await record(baseEntry);

    expect(entry.id).toBe('audit-id-1');
    expect(entry.appId).toBe('my-app');
    expect(entry.changedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(entry.changes).toEqual(baseEntry.changes);
    expect(redis.zadd).toHaveBeenCalledOnce();
    expect(redis.zremrangebyrank).toHaveBeenCalledOnce();
  });

  it('stores JSON-serialised entry in Redis', async () => {
    await record(baseEntry);
    const [key, , json] = (redis.zadd as any).mock.calls[0];
    expect(key).toBe(`audit:app:my-app`);
    const parsed = JSON.parse(json);
    expect(parsed.id).toBe('audit-id-1');
    expect(parsed.action).toBe('update');
  });

  it('caps history using zremrangebyrank', async () => {
    await record(baseEntry);
    const [key, start, stop] = (redis.zremrangebyrank as any).mock.calls[0];
    expect(key).toBe('audit:app:my-app');
    expect(start).toBe(0);
    expect(stop).toBe(-201);
  });
});

describe('getForApp', () => {
  it('returns empty array when no entries exist', async () => {
    (redis.zrevrange as any).mockResolvedValue([]);
    const entries = await getForApp('my-app');
    expect(entries).toEqual([]);
  });

  it('parses and returns stored entries', async () => {
    const stored = { id: 'e1', appId: 'my-app', userId: 'u1', userEmail: 'a@b.com', changedAt: '2024-01-01T00:00:00.000Z', action: 'update', changes: {} };
    (redis.zrevrange as any).mockResolvedValue([JSON.stringify(stored)]);
    const entries = await getForApp('my-app');
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('e1');
  });
});
