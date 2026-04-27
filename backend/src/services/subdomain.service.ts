import redis from '../config/redis';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import type { SubDomain } from '../models/index';

function fromHash(h: Record<string, string>): SubDomain {
  return h as unknown as SubDomain;
}

export async function create(data: { id?: string; name: string; description: string; domainId: string }): Promise<SubDomain> {
  const domainExists = await redis.exists(`domain:${data.domainId}`);
  if (!domainExists) throw createError('Domain not found', 404);

  const id = data.id ?? generateId();
  const now = new Date().toISOString();
  const sd: SubDomain = { id, ...data, createdAt: now, updatedAt: now };
  const pipeline = redis.pipeline();
  pipeline.hset(`subdomain:${id}`, sd as unknown as Record<string, string>);
  pipeline.sadd('subdomains:all', id);
  pipeline.sadd(`domain:${data.domainId}:subdomains`, id);
  await pipeline.exec();
  return sd;
}

export async function findAll(): Promise<SubDomain[]> {
  const ids = await redis.smembers('subdomains:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`subdomain:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter(Boolean);
}

export async function findById(id: string): Promise<SubDomain | null> {
  const h = await redis.hgetall(`subdomain:${id}`);
  return h?.id ? fromHash(h) : null;
}

export async function update(id: string, data: Partial<{ name: string; description: string }>): Promise<SubDomain> {
  const existing = await findById(id);
  if (!existing) throw createError('SubDomain not found', 404);
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  await redis.hset(`subdomain:${id}`, updated as unknown as Record<string, string>);
  return updated;
}

export async function remove(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw createError('SubDomain not found', 404);
  const pipeline = redis.pipeline();
  pipeline.del(`subdomain:${id}`);
  pipeline.del(`subdomain:${id}:tribes`);
  pipeline.srem('subdomains:all', id);
  pipeline.srem(`domain:${existing.domainId}:subdomains`, id);
  await pipeline.exec();
}

export async function getTribes(id: string): Promise<string[]> {
  return redis.smembers(`subdomain:${id}:tribes`);
}
