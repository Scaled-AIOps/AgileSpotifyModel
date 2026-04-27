import redis from '../config/redis';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import { coerceLinks, parseLinks, serialiseLinks } from '../lib/links';
import type { SubDomain, Link } from '../models/index';

function fromHash(h: Record<string, string>): SubDomain {
  return {
    ...(h as unknown as SubDomain),
    jira:        parseLinks(h.jira),
    confluence:  parseLinks(h.confluence),
    github:      parseLinks(h.github),
    mailingList: parseLinks(h.mailingList),
  };
}

function toHash(s: SubDomain): Record<string, string> {
  return {
    ...(s as unknown as Record<string, string>),
    jira:        serialiseLinks(s.jira),
    confluence:  serialiseLinks(s.confluence),
    github:      serialiseLinks(s.github),
    mailingList: serialiseLinks(s.mailingList),
  };
}

export async function create(data: {
  id?: string; name: string; description: string; domainId: string;
  jira?: unknown; confluence?: unknown; github?: unknown; mailingList?: unknown;
}): Promise<SubDomain> {
  const domainExists = await redis.exists(`domain:${data.domainId}`);
  if (!domainExists) throw createError('Domain not found', 404);

  const id = data.id ?? generateId();
  const now = new Date().toISOString();
  const sd: SubDomain = {
    id, name: data.name, description: data.description, domainId: data.domainId,
    jira:        coerceLinks(data.jira),
    confluence:  coerceLinks(data.confluence),
    github:      coerceLinks(data.github),
    mailingList: coerceLinks(data.mailingList),
    createdAt: now, updatedAt: now,
  };
  const pipeline = redis.pipeline();
  pipeline.hset(`subdomain:${id}`, toHash(sd));
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

export async function update(id: string, data: Partial<{
  name: string; description: string;
  jira: Link[]; confluence: Link[]; github: Link[]; mailingList: Link[];
}>): Promise<SubDomain> {
  const existing = await findById(id);
  if (!existing) throw createError('SubDomain not found', 404);
  const merged: SubDomain = {
    ...existing, ...data,
    jira:        data.jira        !== undefined ? coerceLinks(data.jira)        : existing.jira,
    confluence:  data.confluence  !== undefined ? coerceLinks(data.confluence)  : existing.confluence,
    github:      data.github      !== undefined ? coerceLinks(data.github)      : existing.github,
    mailingList: data.mailingList !== undefined ? coerceLinks(data.mailingList) : existing.mailingList,
    updatedAt: new Date().toISOString(),
  };
  await redis.hset(`subdomain:${id}`, toHash(merged));
  return merged;
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
