/**
 * Purpose: Redis-backed CRUD for Tribe.
 * Usage:   Called from tribe.routes.ts. Stores both `name` (short) and `tribeName` (long form). Maintains domain↔tribe / subdomain↔tribe bidirectional set membership.
 * Goal:    Persistence layer for tribes.
 * ToDo:    Same `as unknown as Tribe` cast cleanup as app.service.
 */
import redis from '../config/redis';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import { coerceLinks, parseLinks, serialiseLinks } from '../lib/links';
import type { Tribe, Link } from '../models/index';

function fromHash(h: Record<string, string>): Tribe {
  return {
    ...(h as unknown as Tribe),
    jira:        parseLinks(h.jira),
    confluence:  parseLinks(h.confluence),
    github:      parseLinks(h.github),
    mailingList: parseLinks(h.mailingList),
  };
}

function toHash(t: Tribe): Record<string, string> {
  return {
    ...(t as unknown as Record<string, string>),
    jira:        serialiseLinks(t.jira),
    confluence:  serialiseLinks(t.confluence),
    github:      serialiseLinks(t.github),
    mailingList: serialiseLinks(t.mailingList),
  };
}

export async function create(data: {
  id?: string; name: string; tribeName?: string; description: string;
  domainId: string; subdomainId?: string; leadMemberId?: string;
  releaseManager?: string; agileCoach?: string;
  jira?: unknown; confluence?: unknown; github?: unknown; mailingList?: unknown;
}): Promise<Tribe> {
  const domainExists = await redis.exists(`domain:${data.domainId}`);
  if (!domainExists) throw createError('Domain not found', 404);

  const id = data.id ?? generateId();
  const now = new Date().toISOString();
  const tribe: Tribe = {
    id, name: data.name, tribeName: data.tribeName ?? data.name,
    description: data.description, domainId: data.domainId,
    subdomainId: data.subdomainId ?? '', leadMemberId: data.leadMemberId ?? '',
    releaseManager: data.releaseManager ?? '', agileCoach: data.agileCoach ?? '',
    jira:        coerceLinks(data.jira),
    confluence:  coerceLinks(data.confluence),
    github:      coerceLinks(data.github),
    mailingList: coerceLinks(data.mailingList),
    createdAt: now, updatedAt: now,
  };

  const pipeline = redis.pipeline();
  pipeline.hset(`tribe:${id}`, toHash(tribe));
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

export async function update(id: string, data: Partial<{
  name: string; tribeName: string; description: string;
  leadMemberId: string; subdomainId: string;
  jira: Link[]; confluence: Link[]; github: Link[]; mailingList: Link[];
}>): Promise<Tribe> {
  const existing = await findById(id);
  if (!existing) throw createError('Tribe not found', 404);
  const merged: Tribe = {
    ...existing, ...data,
    jira:        data.jira        !== undefined ? coerceLinks(data.jira)        : existing.jira,
    confluence:  data.confluence  !== undefined ? coerceLinks(data.confluence)  : existing.confluence,
    github:      data.github      !== undefined ? coerceLinks(data.github)      : existing.github,
    mailingList: data.mailingList !== undefined ? coerceLinks(data.mailingList) : existing.mailingList,
    updatedAt: new Date().toISOString(),
  };
  await redis.hset(`tribe:${id}`, toHash(merged));
  return merged;
}

export async function remove(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw createError('Tribe not found', 404);
  const pipeline = redis.pipeline();
  pipeline.del(`tribe:${id}`);
  pipeline.del(`tribe:${id}:squads`);
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

export async function assignLead(id: string, leadMemberId: string): Promise<Tribe> {
  return update(id, { leadMemberId });
}
