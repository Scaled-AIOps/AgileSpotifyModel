import redis from '../config/redis';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import type { Tribe } from '../models/index';

function fromHash(h: Record<string, string>): Tribe {
  return h as unknown as Tribe;
}

export async function create(data: { id?: string; name: string; description: string; domainId: string; subdomainId?: string; leadMemberId?: string; releaseManager?: string; agileCoach?: string; confluence?: string }): Promise<Tribe> {
  const domainExists = await redis.exists(`domain:${data.domainId}`);
  if (!domainExists) throw createError('Domain not found', 404);

  const id = data.id ?? generateId();
  const now = new Date().toISOString();
  const tribe: Tribe = { id, name: data.name, description: data.description, domainId: data.domainId, subdomainId: data.subdomainId ?? '', leadMemberId: data.leadMemberId ?? '', releaseManager: data.releaseManager ?? '', agileCoach: data.agileCoach ?? '', confluence: data.confluence ?? '', createdAt: now, updatedAt: now };

  const pipeline = redis.pipeline();
  pipeline.hset(`tribe:${id}`, tribe as unknown as Record<string, string>);
  pipeline.sadd('tribes:all', id);
  if (tribe.subdomainId) {
    pipeline.sadd(`subdomain:${tribe.subdomainId}:tribes`, id);
  } else {
    pipeline.sadd(`domain:${tribe.domainId}:tribes`, id);
  }
  await pipeline.exec();
  return tribe;
}

export async function findAll(): Promise<Tribe[]> {
  const ids = await redis.smembers('tribes:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`tribe:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter(Boolean);
}

export async function findById(id: string): Promise<Tribe | null> {
  const h = await redis.hgetall(`tribe:${id}`);
  return h?.id ? fromHash(h) : null;
}

export async function update(id: string, data: Partial<{ name: string; description: string; leadMemberId: string; subdomainId: string }>): Promise<Tribe> {
  const existing = await findById(id);
  if (!existing) throw createError('Tribe not found', 404);
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  await redis.hset(`tribe:${id}`, updated as unknown as Record<string, string>);
  return updated;
}

export async function remove(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw createError('Tribe not found', 404);
  const pipeline = redis.pipeline();
  pipeline.del(`tribe:${id}`);
  pipeline.del(`tribe:${id}:squads`);
  pipeline.del(`tribe:${id}:chapters`);
  pipeline.srem('tribes:all', id);
  if (existing.subdomainId) {
    pipeline.srem(`subdomain:${existing.subdomainId}:tribes`, id);
  } else {
    pipeline.srem(`domain:${existing.domainId}:tribes`, id);
  }
  await pipeline.exec();
}

export async function getSquads(id: string): Promise<string[]> {
  return redis.smembers(`tribe:${id}:squads`);
}

export async function getChapters(id: string): Promise<string[]> {
  return redis.smembers(`tribe:${id}:chapters`);
}

export async function assignLead(id: string, leadMemberId: string): Promise<Tribe> {
  return update(id, { leadMemberId });
}
