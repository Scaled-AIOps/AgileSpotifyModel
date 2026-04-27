import redis from '../config/redis';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import type { Domain } from '../models/index';

function fromHash(h: Record<string, string>): Domain {
  return h as unknown as Domain;
}

export async function create(data: { id?: string; name: string; description: string }): Promise<Domain> {
  const id = data.id ?? generateId();
  const now = new Date().toISOString();
  const domain: Domain = { id, name: data.name, description: data.description, createdAt: now, updatedAt: now };
  const pipeline = redis.pipeline();
  pipeline.hset(`domain:${id}`, domain as unknown as Record<string, string>);
  pipeline.sadd('domains:all', id);
  await pipeline.exec();
  return domain;
}

export async function findAll(): Promise<Domain[]> {
  const ids = await redis.smembers('domains:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`domain:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter(Boolean);
}

export async function findById(id: string): Promise<Domain | null> {
  const h = await redis.hgetall(`domain:${id}`);
  return h?.id ? fromHash(h) : null;
}

export async function update(id: string, data: Partial<{ name: string; description: string }>): Promise<Domain> {
  const existing = await findById(id);
  if (!existing) throw createError('Domain not found', 404);
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  await redis.hset(`domain:${id}`, updated as unknown as Record<string, string>);
  return updated;
}

export async function remove(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw createError('Domain not found', 404);
  const pipeline = redis.pipeline();
  pipeline.del(`domain:${id}`);
  pipeline.del(`domain:${id}:subdomains`);
  pipeline.del(`domain:${id}:tribes`);
  pipeline.srem('domains:all', id);
  await pipeline.exec();
}

export async function getSubdomains(id: string): Promise<string[]> {
  return redis.smembers(`domain:${id}:subdomains`);
}

export async function getTribes(id: string): Promise<string[]> {
  return redis.smembers(`domain:${id}:tribes`);
}

export async function getTree(id: string): Promise<object | null> {
  const domain = await findById(id);
  if (!domain) return null;

  const subdomainIds = await redis.smembers(`domain:${id}:subdomains`);
  const directTribeIds = await redis.smembers(`domain:${id}:tribes`);

  const [subdomains, directTribes] = await Promise.all([
    Promise.all(subdomainIds.map(async (sid) => {
      const sd = await redis.hgetall(`subdomain:${sid}`);
      const tribeIds = await redis.smembers(`subdomain:${sid}:tribes`);
      const tribes = await Promise.all(tribeIds.map(async (tid) => {
        const t = await redis.hgetall(`tribe:${tid}`);
        const squadIds = await redis.smembers(`tribe:${tid}:squads`);
        const squads = await Promise.all(squadIds.map(async (sqid) => {
          const sq = await redis.hgetall(`squad:${sqid}`);
          const [memberIds, appCount] = await Promise.all([
            redis.smembers(`squad:${sqid}:members`),
            redis.scard(`squad:${sqid}:apps`),
          ]);
          return { ...sq, memberCount: memberIds.length, appCount };
        }));
        return { ...t, squads };
      }));
      return { ...sd, tribes };
    })),
    Promise.all(directTribeIds.map(async (tid) => {
      const t = await redis.hgetall(`tribe:${tid}`);
      const squadIds = await redis.smembers(`tribe:${tid}:squads`);
      const squads = await Promise.all(squadIds.map(async (sqid) => {
        const sq = await redis.hgetall(`squad:${sqid}`);
        const [memberIds, appCount] = await Promise.all([
          redis.smembers(`squad:${sqid}:members`),
          redis.scard(`squad:${sqid}:apps`),
        ]);
        return { ...sq, memberCount: memberIds.length, appCount };
      }));
      return { ...t, squads };
    })),
  ]);

  return { ...domain, subdomains, tribes: directTribes };
}
