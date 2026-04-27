import redis from '../config/redis';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import type { Chapter } from '../models/index';

function fromHash(h: Record<string, string>): Chapter {
  return h as unknown as Chapter;
}

export async function create(data: { name: string; description?: string; discipline: string; tribeId: string; leadMemberId?: string }): Promise<Chapter> {
  const tribeExists = await redis.exists(`tribe:${data.tribeId}`);
  if (!tribeExists) throw createError('Tribe not found', 404);

  const id = generateId();
  const now = new Date().toISOString();
  const chapter: Chapter = { id, name: data.name, description: data.description ?? '', discipline: data.discipline, tribeId: data.tribeId, leadMemberId: data.leadMemberId ?? '', createdAt: now, updatedAt: now };

  const pipeline = redis.pipeline();
  pipeline.hset(`chapter:${id}`, chapter as unknown as Record<string, string>);
  pipeline.sadd('chapters:all', id);
  pipeline.sadd(`tribe:${data.tribeId}:chapters`, id);
  await pipeline.exec();
  return chapter;
}

export async function findAll(): Promise<Chapter[]> {
  const ids = await redis.smembers('chapters:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`chapter:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter(Boolean);
}

export async function findById(id: string): Promise<Chapter | null> {
  const h = await redis.hgetall(`chapter:${id}`);
  return h?.id ? fromHash(h) : null;
}

export async function update(id: string, data: Partial<Omit<Chapter, 'id' | 'tribeId' | 'createdAt' | 'updatedAt'>>): Promise<Chapter> {
  const existing = await findById(id);
  if (!existing) throw createError('Chapter not found', 404);
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  await redis.hset(`chapter:${id}`, updated as unknown as Record<string, string>);
  return updated;
}

export async function remove(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw createError('Chapter not found', 404);
  const memberIds = await redis.smembers(`chapter:${id}:members`);
  const pipeline = redis.pipeline();
  memberIds.forEach((mid) => pipeline.hset(`member:${mid}`, 'chapterId', ''));
  pipeline.del(`chapter:${id}`);
  pipeline.del(`chapter:${id}:members`);
  pipeline.srem('chapters:all', id);
  pipeline.srem(`tribe:${existing.tribeId}:chapters`, id);
  await pipeline.exec();
}

export async function getMembers(id: string): Promise<string[]> {
  return redis.smembers(`chapter:${id}:members`);
}

export async function addMember(chapterId: string, memberId: string): Promise<void> {
  const [exists, memberExists] = await Promise.all([redis.exists(`chapter:${chapterId}`), redis.exists(`member:${memberId}`)]);
  if (!exists) throw createError('Chapter not found', 404);
  if (!memberExists) throw createError('Member not found', 404);
  const pipeline = redis.pipeline();
  pipeline.sadd(`chapter:${chapterId}:members`, memberId);
  pipeline.hset(`member:${memberId}`, 'chapterId', chapterId);
  await pipeline.exec();
}

export async function removeMember(chapterId: string, memberId: string): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.srem(`chapter:${chapterId}:members`, memberId);
  pipeline.hset(`member:${memberId}`, 'chapterId', '');
  await pipeline.exec();
}

export async function assignLead(chapterId: string, leadMemberId: string): Promise<Chapter> {
  return update(chapterId, { leadMemberId });
}
