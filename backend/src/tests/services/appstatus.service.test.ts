import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPipeline = {
  lpush: vi.fn().mockReturnThis(),
  ltrim: vi.fn().mockReturnThis(),
  set:   vi.fn().mockReturnThis(),
  exec:  vi.fn().mockResolvedValue([]),
};

vi.mock('../../config/redis', () => ({
  default: {
    get:      vi.fn(),
    lrange:   vi.fn().mockResolvedValue([]),
    pipeline: vi.fn(() => mockPipeline),
  },
}));

import redis from '../../config/redis';
import { record, getHistory, getLatest, getLatestAll } from '../../services/appstatus.service';

beforeEach(() => vi.clearAllMocks());

const deployEvent = {
  version:    '1.0.0',
  commitId:   'abc123',
  branch:     'main',
  deployedBy: 'ci-bot',
  state:      'success' as const,
  deployedAt: '2024-06-01T12:00:00.000Z',
  notes:      'Release 1.0',
  changeRequest: 'CHG-001',
};

describe('record', () => {
  it('returns a fully populated AppDeployment', async () => {
    const d = await record('my-app', 'prd', deployEvent);

    expect(d.appId).toBe('my-app');
    expect(d.env).toBe('prd');
    expect(d.version).toBe('1.0.0');
    expect(d.state).toBe('success');
    expect(d.changeRequest).toBe('CHG-001');
  });

  it('defaults optional fields to empty string', async () => {
    const { notes: _, xray: __, changeRequest: ___, ...minimal } = deployEvent;
    const d = await record('my-app', 'dev', minimal);
    expect(d.notes).toBe('');
    expect(d.xray).toBe('');
    expect(d.changeRequest).toBe('');
  });

  it('writes to redis pipeline (lpush, ltrim, set)', async () => {
    await record('my-app', 'prd', deployEvent);
    expect(mockPipeline.lpush).toHaveBeenCalledOnce();
    expect(mockPipeline.ltrim).toHaveBeenCalledOnce();
    expect(mockPipeline.set).toHaveBeenCalledOnce();
    expect(mockPipeline.exec).toHaveBeenCalledOnce();
  });
});

describe('getHistory', () => {
  it('returns empty array when no entries', async () => {
    const history = await getHistory('my-app', 'prd');
    expect(history).toEqual([]);
  });

  it('parses JSON entries from redis list', async () => {
    const stored = JSON.stringify({ appId: 'my-app', env: 'prd', version: '1.0.0', state: 'success' });
    (redis.lrange as any).mockResolvedValue([stored]);
    const history = await getHistory('my-app', 'prd');
    expect(history).toHaveLength(1);
    expect(history[0].version).toBe('1.0.0');
  });
});

describe('getLatest', () => {
  it('returns null when no deployment exists', async () => {
    (redis.get as any).mockResolvedValue(null);
    const d = await getLatest('my-app', 'prd');
    expect(d).toBeNull();
  });

  it('parses and returns the latest deployment', async () => {
    const stored = JSON.stringify({ appId: 'my-app', env: 'prd', version: '2.0.0', state: 'success' });
    (redis.get as any).mockResolvedValue(stored);
    const d = await getLatest('my-app', 'prd');
    expect(d?.version).toBe('2.0.0');
  });
});

describe('getLatestAll', () => {
  it('returns only envs that have a deployment', async () => {
    const prdJson = JSON.stringify({ appId: 'my-app', env: 'prd', version: '1.0.0', state: 'success' });
    (redis.get as any).mockImplementation((key: string) =>
      key.includes(':prd:') ? Promise.resolve(prdJson) : Promise.resolve(null),
    );
    const all = await getLatestAll('my-app');
    expect(Object.keys(all)).toContain('prd');
    expect(Object.keys(all)).not.toContain('dev');
  });
});
