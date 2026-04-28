/**
 * Purpose: Redis-backed CRUD for Squad + member management.
 * Usage:   Called from squad.routes.ts. Maintains tribe↔squad and squad↔member bidirectional sets, plus the `squad:key:{key}` index for slug lookup. Enforces unique squad keys on update.
 * Goal:    Persistence layer for the smallest org unit and its membership graph.
 * ToDo:    Same `as unknown as Squad` cast cleanup as app.service.
 */
import redis from '../config/redis';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import { coerceLinks, parseLinks, serialiseLinks } from '../lib/links';
import type { Squad } from '../models/index';

function fromHash(h: Record<string, string>): Squad {
  return {
    ...(h as unknown as Squad),
    jira:        parseLinks(h.jira),
    confluence:  parseLinks(h.confluence),
    github:      parseLinks(h.github),
    mailingList: parseLinks(h.mailingList),
  };
}

function toHash(s: Squad): Record<string, string> {
  return {
    ...(s as unknown as Record<string, string>),
    jira:        serialiseLinks(s.jira),
    confluence:  serialiseLinks(s.confluence),
    github:      serialiseLinks(s.github),
    mailingList: serialiseLinks(s.mailingList),
  };
}

export async function create(data: {
  name: string; description: string; tribeId: string;
  leadMemberId?: string; missionStatement?: string; key?: string;
  po?: string; sm?: string; tier?: string;
  jira?: unknown; confluence?: unknown; github?: unknown; mailingList?: unknown;
}): Promise<Squad> {
  const tribeExists = await redis.exists(`tribe:${data.tribeId}`);
  if (!tribeExists) throw createError('Tribe not found', 404);

  const id = data.key ?? generateId();
  const now = new Date().toISOString();
  const squad: Squad = {
    id, name: data.name, description: data.description, tribeId: data.tribeId,
    leadMemberId: data.leadMemberId ?? '', missionStatement: data.missionStatement ?? '',
    key: data.key ?? '', po: data.po ?? '', sm: data.sm ?? '',
    jira:        coerceLinks(data.jira),
    confluence:  coerceLinks(data.confluence),
    github:      coerceLinks(data.github),
    mailingList: coerceLinks(data.mailingList),
    tier: data.tier ?? '', createdAt: now, updatedAt: now,
  };

  const pipeline = redis.pipeline();
  pipeline.hset(`squad:${id}`, toHash(squad));
  pipeline.sadd('squads:all', id);
  pipeline.sadd(`tribe:${data.tribeId}:squads`, id);
  if (data.key) pipeline.set(`squad:key:${data.key}`, id);
  await pipeline.exec();
  return squad;
}

export async function findAll(): Promise<Squad[]> {
  const ids = await redis.smembers('squads:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`squad:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter(Boolean);
}

export async function findById(id: string): Promise<Squad | null> {
  const h = await redis.hgetall(`squad:${id}`);
  return h?.id ? fromHash(h) : null;
}

export async function update(id: string, data: Partial<Omit<Squad, 'id' | 'tribeId' | 'createdAt' | 'updatedAt'>>): Promise<Squad> {
  const existing = await findById(id);
  if (!existing) throw createError('Squad not found', 404);
  if (data.key && data.key !== existing.key) {
    const taken = await redis.get(`squad:key:${data.key}`);
    if (taken) throw createError('Squad key already in use', 409);
  }
  const merged: Squad = {
    ...existing, ...data,
    jira:        data.jira        !== undefined ? coerceLinks(data.jira)        : existing.jira,
    confluence:  data.confluence  !== undefined ? coerceLinks(data.confluence)  : existing.confluence,
    github:      data.github      !== undefined ? coerceLinks(data.github)      : existing.github,
    mailingList: data.mailingList !== undefined ? coerceLinks(data.mailingList) : existing.mailingList,
    updatedAt: new Date().toISOString(),
  };
  const pipeline = redis.pipeline();
  pipeline.hset(`squad:${id}`, toHash(merged));
  if (data.key && data.key !== existing.key) {
    if (existing.key) pipeline.del(`squad:key:${existing.key}`);
    pipeline.set(`squad:key:${data.key}`, id);
  }
  await pipeline.exec();
  return merged;
}

export async function remove(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw createError('Squad not found', 404);
  const memberIds = await redis.smembers(`squad:${id}:members`);
  const pipeline = redis.pipeline();
  memberIds.forEach((mid) => pipeline.hset(`member:${mid}`, 'squadId', ''));
  pipeline.del(`squad:${id}`);
  pipeline.del(`squad:${id}:members`);
  pipeline.del(`squad:${id}:apps`);
  pipeline.srem('squads:all', id);
  pipeline.srem(`tribe:${existing.tribeId}:squads`, id);
  if (existing.key) pipeline.del(`squad:key:${existing.key}`);
  await pipeline.exec();
}

export async function findByKey(key: string): Promise<Squad | null> {
  const id = await redis.get(`squad:key:${key}`);
  if (!id) return null;
  return findById(id);
}

export async function getMembers(id: string): Promise<string[]> {
  return redis.smembers(`squad:${id}:members`);
}

export async function addMember(squadId: string, memberId: string, squadRole?: string): Promise<void> {
  const [squadExists, memberExists] = await Promise.all([
    redis.exists(`squad:${squadId}`),
    redis.exists(`member:${memberId}`),
  ]);
  if (!squadExists) throw createError('Squad not found', 404);
  if (!memberExists) throw createError('Member not found', 404);

  const pipeline = redis.pipeline();
  pipeline.sadd(`squad:${squadId}:members`, memberId);
  pipeline.hset(`member:${memberId}`, 'squadId', squadId);
  if (squadRole !== undefined) pipeline.hset(`member:${memberId}`, 'squadRole', squadRole);
  await pipeline.exec();
}

export async function updateMemberRole(squadId: string, memberId: string, squadRole: string): Promise<void> {
  const [squadExists, memberExists] = await Promise.all([
    redis.exists(`squad:${squadId}`),
    redis.exists(`member:${memberId}`),
  ]);
  if (!squadExists) throw createError('Squad not found', 404);
  if (!memberExists) throw createError('Member not found', 404);
  const isMember = await redis.sismember(`squad:${squadId}:members`, memberId);
  if (!isMember) throw createError('Member not in squad', 400);
  await redis.hset(`member:${memberId}`, 'squadRole', squadRole);
}

export async function removeMember(squadId: string, memberId: string): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.srem(`squad:${squadId}:members`, memberId);
  pipeline.hset(`member:${memberId}`, 'squadId', '');
  await pipeline.exec();
}

export async function assignLead(squadId: string, leadMemberId: string): Promise<Squad> {
  return update(squadId, { leadMemberId });
}
