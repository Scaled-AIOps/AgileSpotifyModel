/**
 * Batch CRUD tests covering domain, tribe, chapter, guild, subdomain, infra
 * services. These services all follow the same Redis Hash+Set pattern so
 * a single shared mock covers them all.
 */
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
    get:      vi.fn(),
    hgetall:  vi.fn(),
    hset:     vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    scard:    vi.fn().mockResolvedValue(0),
    exists:   vi.fn().mockResolvedValue(1),
    pipeline: vi.fn(() => mockPipeline),
  },
}));

vi.mock('../../lib/id', () => ({ generateId: vi.fn().mockReturnValue('gen-id') }));

import redis from '../../config/redis';
import * as domainSvc    from '../../services/domain.service';
import * as tribeSvc     from '../../services/tribe.service';
import * as chapterSvc   from '../../services/chapter.service';
import * as guildSvc     from '../../services/guild.service';
import * as subdomainSvc from '../../services/subdomain.service';
import * as infraSvc     from '../../services/infra.service';

beforeEach(() => {
  vi.clearAllMocks();
  (redis.pipeline as any).mockReturnValue(mockPipeline);
});

// ── Domain ──────────────────────────────────────────────────────────────────

describe('domain.service', () => {
  const stored = { id: 'gen-id', name: 'Payments', description: 'Payments domain', createdAt: '', updatedAt: '' };

  it('create: creates domain', async () => {
    const d = await domainSvc.create({ name: 'Payments', description: 'Payments domain' });
    expect(d.name).toBe('Payments');
    expect(mockPipeline.exec).toHaveBeenCalledOnce();
  });

  it('findById: returns null for missing domain', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await domainSvc.findById('missing')).toBeNull();
  });

  it('findById: returns domain when found', async () => {
    (redis.hgetall as any).mockResolvedValue(stored);
    expect((await domainSvc.findById('gen-id'))?.name).toBe('Payments');
  });

  it('findAll: returns empty when no domains', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    expect(await domainSvc.findAll()).toEqual([]);
  });

  it('update: updates domain', async () => {
    (redis.hgetall as any).mockResolvedValue(stored);
    const u = await domainSvc.update('gen-id', { name: 'Updated' });
    expect(u.name).toBe('Updated');
  });

  it('update: throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(domainSvc.update('missing', {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('remove: deletes domain', async () => {
    (redis.hgetall as any).mockResolvedValue(stored);
    await domainSvc.remove('gen-id');
    expect(mockPipeline.del).toHaveBeenCalledWith('domain:gen-id');
  });

  it('remove: throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(domainSvc.remove('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('getSubdomains: returns subdomain ids', async () => {
    (redis.smembers as any).mockResolvedValue(['sd-1']);
    expect(await domainSvc.getSubdomains('gen-id')).toContain('sd-1');
  });

  it('getTribes: returns tribe ids', async () => {
    (redis.smembers as any).mockResolvedValue(['t-1']);
    expect(await domainSvc.getTribes('gen-id')).toContain('t-1');
  });

  it('getTree: returns null when domain not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await domainSvc.getTree('missing')).toBeNull();
  });

  it('getTree: returns domain tree with empty subdomains and tribes', async () => {
    (redis.hgetall as any).mockResolvedValue(stored);
    (redis.smembers as any).mockResolvedValue([]);
    const tree = await domainSvc.getTree('gen-id');
    expect(tree).toMatchObject({ id: 'gen-id', name: 'Payments' });
  });
});

// ── Tribe ──────────────────────────────────────────────────────────────────

describe('tribe.service', () => {
  const stored = { id: 'gen-id', name: 'Alpha Tribe', description: '', domainId: 'd-1', subdomainId: '', leadMemberId: '', releaseManager: '', agileCoach: '', confluence: '' };

  beforeEach(() => {
    (redis.hgetall as any).mockResolvedValue(stored);
    (redis.exists as any).mockResolvedValue(1);
  });

  it('create: creates tribe when domain exists', async () => {
    const t = await tribeSvc.create({ name: 'Alpha', description: '', domainId: 'd-1' });
    expect(t.name).toBe('Alpha');
  });

  it('create: throws 404 when domain missing', async () => {
    (redis.exists as any).mockResolvedValue(0);
    await expect(tribeSvc.create({ name: 'X', description: '', domainId: 'missing' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('findAll: returns empty array', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    expect(await tribeSvc.findAll()).toEqual([]);
  });

  it('findById: returns null', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await tribeSvc.findById('x')).toBeNull();
  });

  it('update: updates tribe', async () => {
    const t = await tribeSvc.update('gen-id', { name: 'New Name' });
    expect(t.name).toBe('New Name');
  });

  it('update: throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(tribeSvc.update('x', {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('remove: removes tribe', async () => {
    await tribeSvc.remove('gen-id');
    expect(mockPipeline.del).toHaveBeenCalledWith('tribe:gen-id');
    expect(mockPipeline.srem).toHaveBeenCalledWith('tribes:all', 'gen-id');
  });

  it('remove: removes from subdomain set when tribe has subdomainId', async () => {
    (redis.hgetall as any).mockResolvedValue({ ...stored, subdomainId: 'sd-1' });
    await tribeSvc.remove('gen-id');
    expect(mockPipeline.srem).toHaveBeenCalledWith('subdomain:sd-1:tribes', 'gen-id');
  });

  it('remove: throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(tribeSvc.remove('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('getSquads: returns squad ids', async () => {
    (redis.smembers as any).mockResolvedValue(['sq-1']);
    expect(await tribeSvc.getSquads('gen-id')).toContain('sq-1');
  });

  it('getChapters: returns chapter ids', async () => {
    (redis.smembers as any).mockResolvedValue(['ch-1']);
    expect(await tribeSvc.getChapters('gen-id')).toContain('ch-1');
  });

  it('assignLead: sets leadMemberId', async () => {
    const t = await tribeSvc.assignLead('gen-id', 'm-lead');
    expect(t.leadMemberId).toBe('m-lead');
  });
});

// ── Chapter ─────────────────────────────────────────────────────────────────

describe('chapter.service', () => {
  const stored = { id: 'gen-id', name: 'Frontend Chapter', discipline: 'Frontend', tribeId: 't-1', leadMemberId: '' };

  beforeEach(() => {
    (redis.hgetall as any).mockResolvedValue(stored);
    (redis.exists as any).mockResolvedValue(1);
  });

  it('create: creates chapter', async () => {
    const c = await chapterSvc.create({ name: 'Frontend', discipline: 'Frontend', tribeId: 't-1' });
    expect(c.name).toBe('Frontend');
  });

  it('create: throws 404 when tribe not found', async () => {
    (redis.exists as any).mockResolvedValue(0);
    await expect(chapterSvc.create({ name: 'X', discipline: 'X', tribeId: 'missing' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('findById: returns null when missing', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await chapterSvc.findById('x')).toBeNull();
  });

  it('update: updates chapter', async () => {
    const c = await chapterSvc.update('gen-id', { name: 'Updated' });
    expect(c.name).toBe('Updated');
  });

  it('update: throws 404', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(chapterSvc.update('x', {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('getMembers: returns member ids', async () => {
    (redis.smembers as any).mockResolvedValue(['m-1']);
    expect(await chapterSvc.getMembers('gen-id')).toContain('m-1');
  });

  it('findAll: returns empty when no chapters', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    expect(await chapterSvc.findAll()).toEqual([]);
  });

  it('remove: removes chapter and clears member assignments', async () => {
    (redis.smembers as any).mockResolvedValue(['m-1']);
    await chapterSvc.remove('gen-id');
    expect(mockPipeline.hset).toHaveBeenCalledWith('member:m-1', 'chapterId', '');
    expect(mockPipeline.del).toHaveBeenCalledWith('chapter:gen-id');
  });

  it('remove: throws 404 when not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(chapterSvc.remove('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('addMember: adds member to chapter', async () => {
    await chapterSvc.addMember('gen-id', 'm-1');
    expect(mockPipeline.sadd).toHaveBeenCalledWith('chapter:gen-id:members', 'm-1');
    expect(mockPipeline.hset).toHaveBeenCalledWith('member:m-1', 'chapterId', 'gen-id');
  });

  it('addMember: throws 404 when chapter not found', async () => {
    (redis.exists as any).mockResolvedValueOnce(0).mockResolvedValue(1);
    await expect(chapterSvc.addMember('missing', 'm-1')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('addMember: throws 404 when member not found', async () => {
    (redis.exists as any).mockResolvedValueOnce(1).mockResolvedValue(0);
    await expect(chapterSvc.addMember('gen-id', 'missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('removeMember: removes member from chapter', async () => {
    await chapterSvc.removeMember('gen-id', 'm-1');
    expect(mockPipeline.srem).toHaveBeenCalledWith('chapter:gen-id:members', 'm-1');
  });

  it('assignLead: sets leadMemberId on chapter', async () => {
    const c = await chapterSvc.assignLead('gen-id', 'm-lead');
    expect(c.leadMemberId).toBe('m-lead');
  });
});

// ── Guild ────────────────────────────────────────────────────────────────────

describe('guild.service', () => {
  const stored = { id: 'gen-id', name: 'Platform Guild', description: '', ownerMemberId: 'm-1' };

  beforeEach(() => {
    (redis.hgetall as any).mockResolvedValue(stored);
  });

  it('create: creates guild', async () => {
    const g = await guildSvc.create({ name: 'Platform Guild', description: '', ownerMemberId: 'm-1' });
    expect(g.name).toBe('Platform Guild');
  });

  it('findAll: returns empty', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    expect(await guildSvc.findAll()).toEqual([]);
  });

  it('findById: returns null', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await guildSvc.findById('x')).toBeNull();
  });

  it('update: updates guild', async () => {
    const g = await guildSvc.update('gen-id', { name: 'New Name' });
    expect(g.name).toBe('New Name');
  });

  it('update: throws 404', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(guildSvc.update('x', {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('remove: removes guild', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    await guildSvc.remove('gen-id');
    expect(mockPipeline.del).toHaveBeenCalledWith('guild:gen-id');
  });

  it('remove: throws 404', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(guildSvc.remove('x')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('addMember: adds member to guild', async () => {
    (redis.exists as any).mockResolvedValue(1);
    await guildSvc.addMember('gen-id', 'm-2');
    expect(mockPipeline.sadd).toHaveBeenCalledWith('guild:gen-id:members', 'm-2');
  });

  it('removeMember: removes member from guild', async () => {
    await guildSvc.removeMember('gen-id', 'm-1');
    expect(mockPipeline.srem).toHaveBeenCalledWith('guild:gen-id:members', 'm-1');
  });

  it('getMembers: returns member ids', async () => {
    (redis.smembers as any).mockResolvedValue(['m-1', 'm-2']);
    expect(await guildSvc.getMembers('gen-id')).toHaveLength(2);
  });
});

// ── SubDomain ────────────────────────────────────────────────────────────────

describe('subdomain.service', () => {
  const stored = { id: 'gen-id', name: 'Checkout', description: '', domainId: 'd-1' };

  beforeEach(() => {
    (redis.hgetall as any).mockResolvedValue(stored);
    (redis.exists as any).mockResolvedValue(1);
  });

  it('create: creates subdomain', async () => {
    const sd = await subdomainSvc.create({ name: 'Checkout', description: '', domainId: 'd-1' });
    expect(sd.name).toBe('Checkout');
  });

  it('findById: returns null', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await subdomainSvc.findById('x')).toBeNull();
  });

  it('update: updates subdomain', async () => {
    const sd = await subdomainSvc.update('gen-id', { name: 'Updated' });
    expect(sd.name).toBe('Updated');
  });

  it('update: throws 404', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(subdomainSvc.update('x', {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('remove: removes subdomain', async () => {
    await subdomainSvc.remove('gen-id');
    expect(mockPipeline.del).toHaveBeenCalledWith('subdomain:gen-id');
  });
});

// ── Infra ────────────────────────────────────────────────────────────────────

describe('infra.service', () => {
  const storedCluster = { platformId: 'plat-1', name: 'OCP-PRD', clusterId: 'c-1', environment: 'prd', host: 'api.ocp.example.com', routeHostName: '*.apps.example.com', platform: 'OpenShift', platformType: 'on-prem', tokenId: 'tok-1', tags: '{}', createdAt: '' };

  beforeEach(() => {
    (redis.hgetall as any).mockResolvedValue(storedCluster);
  });

  it('create: creates cluster', async () => {
    const { createdAt: _, ...input } = storedCluster;
    const c = await infraSvc.create(input);
    expect(c.platformId).toBe('plat-1');
    expect(mockPipeline.exec).toHaveBeenCalledOnce();
  });

  it('findAll: returns empty', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    expect(await infraSvc.findAll()).toEqual([]);
  });

  it('findById: returns cluster', async () => {
    const c = await infraSvc.findById('plat-1');
    expect(c?.platformId).toBe('plat-1');
  });

  it('findById: returns null', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    expect(await infraSvc.findById('missing')).toBeNull();
  });

  it('findByEnv: returns empty array', async () => {
    (redis.smembers as any).mockResolvedValue([]);
    expect(await infraSvc.findByEnv('prd')).toEqual([]);
  });

  it('remove: removes cluster', async () => {
    await infraSvc.remove('plat-1');
    expect(mockPipeline.del).toHaveBeenCalledWith('infra:plat-1');
  });

  it('remove: throws 404', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(infraSvc.remove('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
});
