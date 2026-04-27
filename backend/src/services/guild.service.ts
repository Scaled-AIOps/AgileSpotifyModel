import redis from '../config/redis';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import type { Guild } from '../models/index';

function fromHash(h: Record<string, string>): Guild {
  return h as unknown as Guild;
}

export async function create(data: { name: string; description: string; ownerMemberId?: string }): Promise<Guild> {
  const id = generateId();
  const now = new Date().toISOString();
  const guild: Guild = { id, name: data.name, description: data.description, ownerMemberId: data.ownerMemberId ?? '', createdAt: now, updatedAt: now };
  const pipeline = redis.pipeline();
  pipeline.hset(`guild:${id}`, guild as unknown as Record<string, string>);
  pipeline.sadd('guilds:all', id);
  await pipeline.exec();
  return guild;
}

export async function findAll(): Promise<Guild[]> {
  const ids = await redis.smembers('guilds:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`guild:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter(Boolean);
}

export async function findById(id: string): Promise<Guild | null> {
  const h = await redis.hgetall(`guild:${id}`);
  return h?.id ? fromHash(h) : null;
}

export async function update(id: string, data: Partial<Omit<Guild, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Guild> {
  const existing = await findById(id);
  if (!existing) throw createError('Guild not found', 404);
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  await redis.hset(`guild:${id}`, updated as unknown as Record<string, string>);
  return updated;
}

export async function remove(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw createError('Guild not found', 404);
  const memberIds = await redis.smembers(`guild:${id}:members`);
  const pipeline = redis.pipeline();
  memberIds.forEach((mid) => pipeline.srem(`member:${mid}:guilds`, id));
  pipeline.del(`guild:${id}`);
  pipeline.del(`guild:${id}:members`);
  pipeline.srem('guilds:all', id);
  await pipeline.exec();
}

export async function getMembers(id: string): Promise<string[]> {
  return redis.smembers(`guild:${id}:members`);
}

export async function addMember(guildId: string, memberId: string): Promise<void> {
  const [exists, memberExists] = await Promise.all([redis.exists(`guild:${guildId}`), redis.exists(`member:${memberId}`)]);
  if (!exists) throw createError('Guild not found', 404);
  if (!memberExists) throw createError('Member not found', 404);
  const pipeline = redis.pipeline();
  pipeline.sadd(`guild:${guildId}:members`, memberId);
  pipeline.sadd(`member:${memberId}:guilds`, guildId);
  await pipeline.exec();
}

export async function removeMember(guildId: string, memberId: string): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.srem(`guild:${guildId}:members`, memberId);
  pipeline.srem(`member:${memberId}:guilds`, guildId);
  await pipeline.exec();
}
