import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPipeline = {
  hset:    vi.fn().mockReturnThis(),
  hgetall: vi.fn().mockReturnThis(),
  sadd:    vi.fn().mockReturnThis(),
  del:     vi.fn().mockReturnThis(),
  srem:    vi.fn().mockReturnThis(),
  exec:    vi.fn().mockResolvedValue([]),
};

vi.mock('../../config/redis', () => ({
  default: {
    hgetall:  vi.fn(),
    hset:     vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    pipeline: vi.fn(() => mockPipeline),
  },
}));

import redis from '../../config/redis';
import { create, findAll, findById, findBySquad, update, remove } from '../../services/app.service';

beforeEach(() => {
  vi.clearAllMocks();
  (redis.pipeline as any).mockReturnValue(mockPipeline);
});

const baseApp = {
  appId: 'payments-api',
  gitRepo: 'https://github.com/acme/payments-api',
  squadId: 'sq-1',
  squadKey: 'PAY',
  status: 'active' as const,
  tags: { criticality: 'high', pillar: 'payments' },
  platforms: {},
  urls: {},
};

describe('create', () => {
  it('creates an app and returns it', async () => {
    const app = await create(baseApp);
    expect(app.appId).toBe('payments-api');
    expect(app.squadKey).toBe('PAY');
    expect(app.status).toBe('active');
    expect(app.tags).toBe(JSON.stringify({ criticality: 'high', pillar: 'payments' }));
    expect(mockPipeline.hset).toHaveBeenCalledOnce();
    expect(mockPipeline.sadd).toHaveBeenCalledTimes(2);
  });

  it('stores tags as JSON string', async () => {
    const app = await create(baseApp);
    expect(() => JSON.parse(app.tags)).not.toThrow();
    expect(JSON.parse(app.tags)).toEqual(baseApp.tags);
  });

  it('sets optional fields to empty string when not provided', async () => {
    const app = await create({ ...baseApp, probeHealth: undefined });
    expect(app.probeHealth).toBe('');
  });
});

describe('findById', () => {
  it('returns null when key does not exist', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    const app = await findById('nonexistent');
    expect(app).toBeNull();
  });

  it('returns the app when found', async () => {
    const raw = { appId: 'payments-api', squadId: 'sq-1', squadKey: 'PAY', status: 'active', tags: '{}', platforms: '{}', urls: '{}' };
    (redis.hgetall as any).mockResolvedValue(raw);
    const app = await findById('payments-api');
    expect(app?.appId).toBe('payments-api');
  });
});

describe('findAll', () => {
  it('returns empty array when no apps registered', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    const apps = await findAll();
    expect(apps).toEqual([]);
  });

  it('returns all apps when ids exist', async () => {
    const raw = { appId: 'payments-api', squadId: 'sq-1', squadKey: 'PAY', status: 'active', tags: '{}', platforms: '{}', urls: '{}' };
    const pipeline2 = {
      hgetall: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([[null, raw], [null, { ...raw, appId: 'auth-api' }]]),
    };
    (redis.smembers as any).mockResolvedValue(['payments-api', 'auth-api']);
    (redis.pipeline as any).mockReturnValue(pipeline2);
    const apps = await findAll();
    expect(apps).toHaveLength(2);
  });
});

describe('findBySquad', () => {
  it('returns empty array for a squad with no apps', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    const apps = await findBySquad('sq-empty');
    expect(apps).toEqual([]);
  });
});

describe('update', () => {
  const existing = { appId: 'payments-api', squadId: 'sq-1', squadKey: 'PAY', status: 'active', tags: '{"criticality":"high"}', platforms: '{}', urls: '{}', gitRepo: '', javaVersion: '', javaComplianceStatus: '', artifactoryUrl: '', xrayUrl: '', compositionViewerUrl: '', splunkUrl: '', probeHealth: '', probeInfo: '', probeLiveness: '', probeReadiness: '', createdAt: '' };

  beforeEach(() => {
    (redis.hgetall as any).mockResolvedValue(existing);
  });

  it('returns updated app and diff for changed fields', async () => {
    const { app, diff } = await update('payments-api', { status: 'inactive' });
    expect(app.status).toBe('inactive');
    expect(diff['status']).toEqual({ from: 'active', to: 'inactive' });
  });

  it('returns empty diff when nothing changed', async () => {
    const { diff } = await update('payments-api', { status: 'active' });
    expect(diff).toEqual({});
  });

  it('throws when app not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(update('missing', { status: 'inactive' })).rejects.toThrow();
  });

  it('computes per-key tag diff', async () => {
    const { diff } = await update('payments-api', { tags: { criticality: 'low', pillar: 'platform' } });
    expect(diff['tags.criticality']).toEqual({ from: 'high', to: 'low' });
    expect(diff['tags.pillar']).toEqual({ from: '', to: 'platform' });
  });
});

describe('remove', () => {
  it('removes app from redis', async () => {
    const raw = { appId: 'payments-api', squadId: 'sq-1', squadKey: 'PAY', status: 'active', tags: '{}', platforms: '{}', urls: '{}' };
    (redis.hgetall as any).mockResolvedValue(raw);
    await remove('payments-api');
    expect(mockPipeline.del).toHaveBeenCalledOnce();
    expect(mockPipeline.srem).toHaveBeenCalledTimes(2);
  });

  it('throws when app not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(remove('nonexistent')).rejects.toThrow();
  });
});
