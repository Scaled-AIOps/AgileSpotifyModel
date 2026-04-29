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

vi.mock('../../lib/id', () => ({ generateId: vi.fn().mockReturnValue('sq-gen-id') }));

import redis from '../../config/redis';
import { create, findAll, findById, update, remove, getMembers, addMember, removeMember, updateMemberRole, assignLead, findByKey } from '../../services/squad.service';

const storedSquad = {
  id: 'sq-1', name: 'Payments', description: '', tribeId: 'tribe-1', leadMemberId: '', missionStatement: '',
  key: 'PAY', po: '', sm: '', jira: '', confluence: '', mailingList: '', tier: '1',
};

beforeEach(() => {
  vi.clearAllMocks();
  (redis.pipeline as any).mockReturnValue(mockPipeline);
  (redis.hgetall as any).mockResolvedValue(storedSquad);
  (redis.exists as any).mockResolvedValue(1);
});

describe('create', () => {
  it('creates squad when tribe exists', async () => {
    const squad = await create({ name: 'New Squad', description: '', tribeId: 'tribe-1', key: 'NS' });
    expect(squad.name).toBe('New Squad');
    expect(mockPipeline.exec).toHaveBeenCalledOnce();
  });

  it('throws 404 when tribe does not exist', async () => {
    (redis.exists as any).mockResolvedValue(0);
    await expect(create({ name: 'X', description: '', tribeId: 'missing' })).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('findById', () => {
  it('returns null when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await findById('missing')).toBeNull();
  });

  it('returns squad when found', async () => {
    const sq = await findById('sq-1');
    expect(sq?.name).toBe('Payments');
  });
});

describe('findAll', () => {
  it('returns empty array when no squads', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    expect(await findAll()).toEqual([]);
  });

  it('returns squads from pipeline', async () => {
    (redis.smembers as any).mockResolvedValue(['sq-1']);
    const pl = { hgetall: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([[null, storedSquad]]) };
    (redis.pipeline as any).mockReturnValue(pl);
    const squads = await findAll();
    expect(squads).toHaveLength(1);
  });
});

describe('findByKey', () => {
  it('returns null when key not found', async () => {
    (redis.get as any).mockResolvedValue(null);
    expect(await findByKey('MISSING')).toBeNull();
  });

  it('returns squad when key exists', async () => {
    (redis.get as any).mockResolvedValue('sq-1');
    const sq = await findByKey('PAY');
    expect(sq?.id).toBe('sq-1');
  });
});

describe('update', () => {
  it('updates and returns squad', async () => {
    const updated = await update('sq-1', { name: 'Updated Squad' });
    expect(updated.name).toBe('Updated Squad');
  });

  it('throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(update('missing', {})).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('remove', () => {
  it('removes squad and cleans up', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    await remove('sq-1');
    expect(mockPipeline.del).toHaveBeenCalledWith('squad:sq-1');
    expect(mockPipeline.exec).toHaveBeenCalledOnce();
  });

  it('throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(remove('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('getMembers', () => {
  it('returns member ids', async () => {
    (redis.smembers as any).mockResolvedValue(['m-1', 'm-2']);
    const ids = await getMembers('sq-1');
    expect(ids).toEqual(['m-1', 'm-2']);
  });
});

describe('addMember', () => {
  it('adds member to squad', async () => {
    await addMember('sq-1', 'm-1', 'Backend Dev');
    expect(mockPipeline.sadd).toHaveBeenCalledWith('squad:sq-1:members', 'm-1');
  });

  it('throws 404 when squad not found', async () => {
    (redis.exists as any).mockResolvedValueOnce(0).mockResolvedValue(1);
    await expect(addMember('missing', 'm-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 when member not found', async () => {
    (redis.exists as any).mockResolvedValueOnce(1).mockResolvedValue(0);
    await expect(addMember('sq-1', 'missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('updateMemberRole', () => {
  it('updates squad role', async () => {
    (redis.sismember as any).mockResolvedValue(1);
    await updateMemberRole('sq-1', 'm-1', 'Tech Lead');
    expect(redis.hset).toHaveBeenCalledWith('member:m-1', 'squadRole', 'Tech Lead');
  });

  it('throws 400 when member is not in squad', async () => {
    (redis.sismember as any).mockResolvedValue(0);
    await expect(updateMemberRole('sq-1', 'm-1', 'Dev')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('removeMember', () => {
  it('removes member from squad', async () => {
    await removeMember('sq-1', 'm-1');
    expect(mockPipeline.srem).toHaveBeenCalledWith('squad:sq-1:members', 'm-1');
  });
});

describe('assignLead', () => {
  it('sets leadMemberId', async () => {
    const sq = await assignLead('sq-1', 'm-lead');
    expect(sq.leadMemberId).toBe('m-lead');
  });
});
