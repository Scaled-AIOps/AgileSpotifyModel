/**
 * Purpose: Redis-backed audit log of application mutations.
 * Usage:   Called from apps.routes.ts after a successful PATCH. Stores entries per appId; `getForApp(appId)` returns reverse-chronological history.
 * Goal:    Track who changed what on each application so reviewers can trace edits.
 * ToDo:    —
 */
import redis from '../config/redis';
import { generateId } from '../lib/id';

export interface AuditEntry {
  id: string;
  appId: string;
  userId: string;
  userEmail: string;
  changedAt: string;
  action: string;
  changes: Record<string, { from: string; to: string }>;
}

const MAX_ENTRIES = 200;

export async function record(entry: Omit<AuditEntry, 'id' | 'changedAt'>): Promise<AuditEntry> {
  const full: AuditEntry = { ...entry, id: generateId(), changedAt: new Date().toISOString() };
  const score = Date.now();
  const key = `audit:app:${entry.appId}`;
  await redis.zadd(key, score, JSON.stringify(full));
  await redis.zremrangebyrank(key, 0, -(MAX_ENTRIES + 1));
  return full;
}

export async function getForApp(appId: string): Promise<AuditEntry[]> {
  const entries = await redis.zrevrange(`audit:app:${appId}`, 0, 99);
  return entries.map((e) => JSON.parse(e) as AuditEntry);
}
