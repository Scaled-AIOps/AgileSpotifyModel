import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPipeline = {
  hset:    vi.fn().mockReturnThis(),
  hgetall: vi.fn().mockReturnThis(),
  set:     vi.fn().mockReturnThis(),
  sadd:    vi.fn().mockReturnThis(),
  srem:    vi.fn().mockReturnThis(),
  del:     vi.fn().mockReturnThis(),
  exec:    vi.fn().mockResolvedValue([]),
};

vi.mock('../../config/redis', () => ({
  default: {
    get:       vi.fn(),
    hgetall:   vi.fn(),
    hset:      vi.fn().mockResolvedValue(1),
    smembers:  vi.fn().mockResolvedValue([]),
    sismember: vi.fn().mockResolvedValue(1),
    exists:    vi.fn().mockResolvedValue(1),
    pipeline:  vi.fn(() => mockPipeline),
  },
}));

vi.mock('../../lib/id', () => ({ generateId: vi.fn().mockReturnValue('gen-id') }));

import redis from '../../config/redis';
import { create, findAll, findById, update, remove, getAssignments } from '../../services/member.service';

beforeEach(() => {
  vi.clearAllMocks();
  (redis.pipeline as any).mockReturnValue(mockPipeline);
});

const baseMember = { name: 'Alice', email: 'alice@example.com', role: 'Member' as const, avatarUrl: '', squadId: 'sq-1' };
const storedMember = { id: 'gen-id', name: 'Alice', email: 'alice@example.com', role: 'Member', avatarUrl: '', squadId: 'sq-1', squadRole: '' };

describe('create', () => {
  beforeEach(() => { (redis.get as any).mockResolvedValue(null); });

  it('creates a member and returns it', async () => {
    const member = await create(baseMember);
    expect(member.name).toBe('Alice');
    expect(member.id).toBe('gen-id');
    expect(mockPipeline.exec).toHaveBeenCalledOnce();
  });

  it('throws 409 when email already exists', async () => {
    (redis.get as any).mockResolvedValue('existing-id');
    await expect(create(baseMember)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('creates user record when passcode provided', async () => {
    await create({ ...baseMember, passcode: 'Pass1!' });
    expect(mockPipeline.hset).toHaveBeenCalledWith(
      expect.stringMatching(/^user:/), expect.any(Object)
    );
  });
});

describe('findById', () => {
  it('returns null when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await findById('missing')).toBeNull();
  });

  it('returns member when found', async () => {
    (redis.hgetall as any).mockResolvedValue(storedMember);
    const m = await findById('gen-id');
    expect(m?.name).toBe('Alice');
  });
});

describe('findAll', () => {
  it('returns empty array when no members', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    expect(await findAll()).toEqual([]);
  });

  it('returns members from pipeline', async () => {
    (redis.smembers as any).mockResolvedValue(['gen-id']);
    const pl = { hgetall: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([[null, storedMember]]) };
    (redis.pipeline as any).mockReturnValue(pl);
    const members = await findAll();
    expect(members).toHaveLength(1);
  });
});

describe('update', () => {
  it('updates and returns modified member', async () => {
    (redis.hgetall as any).mockResolvedValue(storedMember);
    const updated = await update('gen-id', { name: 'Alice Smith' });
    expect(updated.name).toBe('Alice Smith');
    expect(redis.hset).toHaveBeenCalledOnce();
  });

  it('throws 404 when member not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(update('missing', { name: 'X' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('remove', () => {
  it('removes member and cleans up related sets', async () => {
    (redis.hgetall as any).mockResolvedValue(storedMember);
    (redis.get as any).mockResolvedValue(null); // no user record
    await remove('gen-id');
    expect(mockPipeline.del).toHaveBeenCalledWith('member:gen-id');
    expect(mockPipeline.exec).toHaveBeenCalledOnce();
  });

  it('throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(remove('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('removes user auth record when user exists', async () => {
    (redis.hgetall as any).mockResolvedValue(storedMember);
    (redis.get as any).mockResolvedValue('user-id-1');
    await remove('gen-id');
    expect(mockPipeline.del).toHaveBeenCalledWith('user:user-id-1');
  });
});

describe('getAssignments', () => {
  it('returns squad assignment', async () => {
    (redis.hgetall as any).mockResolvedValue(storedMember);
    const result = await getAssignments('gen-id');
    expect(result.squadId).toBe('sq-1');
  });

  it('throws 404 when member not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(getAssignments('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
