/**
 * Purpose: Redis-backed CRUD for Member + assignment lookup.
 * Usage:   Called from member.routes.ts. Stores member hashes and provides `getAssignments(id)` returning the squad the member belongs to.
 * Goal:    Persistence layer for the identity / people directory.
 * ToDo:    —
 */
import redis from '../config/redis';
import { generateId } from '../lib/id';
import { hashPassword } from '../lib/crypto';
import { createError } from '../middleware/errorHandler';
import type { Member, Role } from '../models/index';

function fromHash(h: Record<string, string>): Member {
  return h as unknown as Member;
}

export async function create(data: {
  name: string; email: string; password?: string; role: Role; avatarUrl: string; squadId: string;
}): Promise<Member> {
  const existing = await redis.get(`member:email:${data.email}`);
  if (existing) throw createError('Email already in use', 409);

  const id = generateId();
  const now = new Date().toISOString();

  const member: Member = { id, name: data.name, email: data.email, avatarUrl: data.avatarUrl, role: data.role, squadId: data.squadId, squadRole: '', createdAt: now, updatedAt: now };

  const pipeline = redis.pipeline();
  pipeline.hset(`member:${id}`, member as unknown as Record<string, string>);
  pipeline.set(`member:email:${data.email}`, id);
  pipeline.sadd('members:all', id);
  if (data.password) {
    const userId = generateId();
    const passwordHash = await hashPassword(data.password);
    pipeline.hset(`user:${userId}`, { id: userId, email: data.email, passwordHash, role: data.role, memberId: id, createdAt: now });
    pipeline.set(`user:email:${data.email}`, userId);
    pipeline.sadd('users:all', userId);
  }
  if (data.squadId) pipeline.sadd(`squad:${data.squadId}:members`, id);
  await pipeline.exec();
  return member;
}

export async function findAll(): Promise<Member[]> {
  const ids = await redis.smembers('members:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`member:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter(Boolean);
}

export async function findById(id: string): Promise<Member | null> {
  const h = await redis.hgetall(`member:${id}`);
  return h?.id ? fromHash(h) : null;
}

export async function update(id: string, data: Partial<Omit<Member, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Member> {
  const existing = await findById(id);
  if (!existing) throw createError('Member not found', 404);
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  await redis.hset(`member:${id}`, updated as unknown as Record<string, string>);
  return updated;
}

export async function remove(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw createError('Member not found', 404);

  const pipeline = redis.pipeline();
  if (existing.squadId) pipeline.srem(`squad:${existing.squadId}:members`, id);
  pipeline.del(`member:${id}`);
  pipeline.del(`member:email:${existing.email}`);
  pipeline.srem('members:all', id);
  // Also remove user auth record
  const userId = await redis.get(`user:email:${existing.email}`);
  if (userId) {
    pipeline.del(`user:${userId}`);
    pipeline.del(`user:email:${existing.email}`);
    pipeline.del(`refresh:${userId}`);
    pipeline.srem('users:all', userId);
  }
  await pipeline.exec();
}

export async function getAssignments(id: string): Promise<{ squadId: string }> {
  const member = await findById(id);
  if (!member) throw createError('Member not found', 404);
  return { squadId: member.squadId };
}
