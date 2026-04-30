/**
 * Purpose: Redis-backed CRUD for the Certificate (TLS/X.509) registry.
 * Usage:   Called by certificate.routes.ts and the YAML seed loader. Indexed
 *          by environment via `cert:env:{env}` set so the dashboard can pull
 *          the per-environment expiry list cheaply.
 * Goal:    Persistence layer for cert *expiry monitoring* — we do not store
 *          private keys or issue certs from here.
 */
import redis from '../config/redis';
import { createError } from '../middleware/errorHandler';
import type { Certificate } from '../models/index';

function fromHash(h: Record<string, string>): Certificate {
  return h as unknown as Certificate;
}

export async function create(data: Omit<Certificate, 'createdAt'>): Promise<Certificate> {
  const cert: Certificate = { ...data, createdAt: new Date().toISOString() };
  const pipeline = redis.pipeline();
  pipeline.hset(`cert:${data.certId}`, cert as unknown as Record<string, string>);
  pipeline.sadd('cert:all', data.certId);
  pipeline.sadd(`cert:env:${data.environment}`, data.certId);
  await pipeline.exec();
  return cert;
}

export async function findAll(): Promise<Certificate[]> {
  const ids = await redis.smembers('cert:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`cert:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter((c) => c?.certId);
}

export async function findById(certId: string): Promise<Certificate | null> {
  const h = await redis.hgetall(`cert:${certId}`);
  return h?.certId ? fromHash(h) : null;
}

export async function findByEnv(env: string): Promise<Certificate[]> {
  const ids = await redis.smembers(`cert:env:${env}`);
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`cert:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter((c) => c?.certId);
}

export async function update(
  certId: string,
  data: Partial<Omit<Certificate, 'certId' | 'createdAt'>>,
): Promise<Certificate> {
  const existing = await findById(certId);
  if (!existing) throw createError('Certificate not found', 404);
  const merged: Certificate = { ...existing, ...data };
  const pipeline = redis.pipeline();
  pipeline.hset(`cert:${certId}`, merged as unknown as Record<string, string>);
  if (data.environment && data.environment !== existing.environment) {
    pipeline.srem(`cert:env:${existing.environment}`, certId);
    pipeline.sadd(`cert:env:${data.environment}`, certId);
  }
  await pipeline.exec();
  return merged;
}

export async function remove(certId: string): Promise<void> {
  const existing = await findById(certId);
  if (!existing) throw createError('Certificate not found', 404);
  const pipeline = redis.pipeline();
  pipeline.del(`cert:${certId}`);
  pipeline.srem('cert:all', certId);
  pipeline.srem(`cert:env:${existing.environment}`, certId);
  await pipeline.exec();
}
