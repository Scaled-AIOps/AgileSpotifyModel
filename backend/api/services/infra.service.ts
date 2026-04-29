/**
 * Purpose: Redis-backed CRUD for InfraCluster records.
 * Usage:   Called from infra.routes.ts. Indexed by environment via `infra:env:{env}` set.
 * Goal:    Persistence layer for the infrastructure catalogue (clusters, hosts, platforms).
 * ToDo:    Wire a PATCH route. update() is now exposed for the YAML upsert path.
 */
import redis from '../config/redis';
import { createError } from '../middleware/errorHandler';
import type { InfraCluster } from '../models/index';

function fromHash(h: Record<string, string>): InfraCluster {
  return h as unknown as InfraCluster;
}

export async function create(data: Omit<InfraCluster, 'createdAt'>): Promise<InfraCluster> {
  const cluster: InfraCluster = { ...data, createdAt: new Date().toISOString() };
  const pipeline = redis.pipeline();
  pipeline.hset(`infra:${data.platformId}`, cluster as unknown as Record<string, string>);
  pipeline.sadd('infra:all', data.platformId);
  pipeline.sadd(`infra:env:${data.environment}`, data.platformId);
  await pipeline.exec();
  return cluster;
}

export async function findAll(): Promise<InfraCluster[]> {
  const ids = await redis.smembers('infra:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`infra:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter((c) => c?.platformId);
}

export async function findById(platformId: string): Promise<InfraCluster | null> {
  const h = await redis.hgetall(`infra:${platformId}`);
  return h?.platformId ? fromHash(h) : null;
}

export async function findByEnv(env: string): Promise<InfraCluster[]> {
  const ids = await redis.smembers(`infra:env:${env}`);
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`infra:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter((c) => c?.platformId);
}

export async function update(
  platformId: string,
  data: Partial<Omit<InfraCluster, 'platformId' | 'createdAt'>>,
): Promise<InfraCluster> {
  const existing = await findById(platformId);
  if (!existing) throw createError('Cluster not found', 404);
  const merged: InfraCluster = { ...existing, ...data };
  const pipeline = redis.pipeline();
  pipeline.hset(`infra:${platformId}`, merged as unknown as Record<string, string>);
  // If the environment changed, move the platformId between env-index sets.
  if (data.environment && data.environment !== existing.environment) {
    pipeline.srem(`infra:env:${existing.environment}`, platformId);
    pipeline.sadd(`infra:env:${data.environment}`, platformId);
  }
  await pipeline.exec();
  return merged;
}

export async function remove(platformId: string): Promise<void> {
  const existing = await findById(platformId);
  if (!existing) throw createError('Cluster not found', 404);
  const pipeline = redis.pipeline();
  pipeline.del(`infra:${platformId}`);
  pipeline.srem('infra:all', platformId);
  pipeline.srem(`infra:env:${existing.environment}`, platformId);
  await pipeline.exec();
}
