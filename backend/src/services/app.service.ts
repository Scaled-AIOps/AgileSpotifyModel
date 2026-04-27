/**
 * Purpose: Redis-backed CRUD for Application records.
 * Usage:   Called from apps.routes.ts. Stores tags / platforms / urls as JSON-encoded strings and link arrays via lib/links.ts. Update returns a `diff` for the audit log.
 * Goal:    Persistence layer for the application registry; intentionally records what changed, not just the new value, to feed the audit trail.
 * ToDo:    Replace the `as unknown as App` casts in fromHash/toHash with a proper type guard.
 */
import redis from '../config/redis';
import { createError } from '../middleware/errorHandler';
import { coerceLinks, parseLinks, serialiseLinks } from '../lib/links';
import type { App, AppStatus, Link } from '../models/index';

function fromHash(h: Record<string, string>): App {
  return {
    ...(h as unknown as App),
    jira:        parseLinks(h.jira),
    confluence:  parseLinks(h.confluence),
    github:      parseLinks(h.github),
    mailingList: parseLinks(h.mailingList),
  };
}

function toHash(a: App): Record<string, string> {
  return {
    ...(a as unknown as Record<string, string>),
    jira:        serialiseLinks(a.jira),
    confluence:  serialiseLinks(a.confluence),
    github:      serialiseLinks(a.github),
    mailingList: serialiseLinks(a.mailingList),
  };
}

export async function create(data: {
  appId: string;
  description?: string;
  squadId: string;
  squadKey: string;
  status: AppStatus;
  tags: Record<string, string>;
  platforms: Record<string, string>;
  urls: Record<string, string>;
  jira?: unknown;
  confluence?: unknown;
  github?: unknown;
  mailingList?: unknown;
  probeHealth?: string;
  probeInfo?: string;
  probeLiveness?: string;
  probeReadiness?: string;
  javaVersion?: string;
  javaComplianceStatus?: string;
  artifactoryUrl?: string;
  xrayUrl?: string;
  compositionViewerUrl?: string;
  splunkUrl?: string;
}): Promise<App> {
  const app: App = {
    appId:                data.appId,
    description:          data.description          ?? '',
    squadId:              data.squadId,
    squadKey:             data.squadKey,
    status:               data.status,
    tags:                 JSON.stringify(data.tags),
    platforms:            JSON.stringify(data.platforms),
    urls:                 JSON.stringify(data.urls),
    jira:                 coerceLinks(data.jira),
    confluence:           coerceLinks(data.confluence),
    github:               coerceLinks(data.github),
    mailingList:          coerceLinks(data.mailingList),
    probeHealth:          data.probeHealth          ?? '',
    probeInfo:            data.probeInfo            ?? '',
    probeLiveness:        data.probeLiveness        ?? '',
    probeReadiness:       data.probeReadiness       ?? '',
    javaVersion:          data.javaVersion          ?? '',
    javaComplianceStatus: data.javaComplianceStatus ?? '',
    artifactoryUrl:       data.artifactoryUrl       ?? '',
    xrayUrl:              data.xrayUrl              ?? '',
    compositionViewerUrl: data.compositionViewerUrl ?? '',
    splunkUrl:            data.splunkUrl            ?? '',
    createdAt:            new Date().toISOString(),
  };
  const pipeline = redis.pipeline();
  pipeline.hset(`app:${data.appId}`, toHash(app));
  pipeline.sadd('apps:all', data.appId);
  if (data.squadId) pipeline.sadd(`squad:${data.squadId}:apps`, data.appId);
  await pipeline.exec();
  return app;
}

export async function findAll(): Promise<App[]> {
  const ids = await redis.smembers('apps:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`app:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter((a) => a?.appId);
}

export async function findById(appId: string): Promise<App | null> {
  const h = await redis.hgetall(`app:${appId}`);
  return h?.appId ? fromHash(h) : null;
}

export async function findBySquad(squadId: string): Promise<App[]> {
  const ids = await redis.smembers(`squad:${squadId}:apps`);
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`app:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter((a) => a?.appId);
}

type UpdateData = Partial<{
  description: string;
  status: AppStatus;
  javaVersion: string;
  javaComplianceStatus: string;
  artifactoryUrl: string;
  xrayUrl: string;
  compositionViewerUrl: string;
  splunkUrl: string;
  probeHealth: string;
  probeInfo: string;
  probeLiveness: string;
  probeReadiness: string;
  tags: Record<string, string>;
  jira: Link[];
  confluence: Link[];
  github: Link[];
  mailingList: Link[];
}>;

function safeParseTags(raw: string): Record<string, string> {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function update(appId: string, data: UpdateData): Promise<{ app: App; diff: Record<string, { from: string; to: string }> }> {
  const existing = await findById(appId);
  if (!existing) throw createError('App not found', 404);

  const diff: Record<string, { from: string; to: string }> = {};
  const merged: App = { ...existing };

  const SIMPLE_FIELDS = [
    'description', 'status', 'javaVersion', 'javaComplianceStatus',
    'artifactoryUrl', 'xrayUrl', 'compositionViewerUrl', 'splunkUrl',
    'probeHealth', 'probeInfo', 'probeLiveness', 'probeReadiness',
  ] as const;

  for (const field of SIMPLE_FIELDS) {
    const val = (data as any)[field];
    if (val !== undefined && val !== existing[field]) {
      diff[field] = { from: existing[field] ?? '', to: val };
      (merged as any)[field] = val;
    }
  }

  if (data.tags !== undefined) {
    const oldTags = safeParseTags(existing.tags);
    const newTags = data.tags;
    const allKeys = new Set([...Object.keys(oldTags), ...Object.keys(newTags)]);
    for (const k of allKeys) {
      if ((oldTags[k] ?? '') !== (newTags[k] ?? '')) {
        diff[`tags.${k}`] = { from: oldTags[k] ?? '', to: newTags[k] ?? '' };
      }
    }
    merged.tags = JSON.stringify(newTags);
  }

  for (const field of ['jira', 'confluence', 'github', 'mailingList'] as const) {
    if (data[field] !== undefined) {
      const oldLinks = existing[field];
      const newLinks = coerceLinks(data[field]);
      if (JSON.stringify(oldLinks) !== JSON.stringify(newLinks)) {
        diff[field] = { from: serialiseLinks(oldLinks), to: serialiseLinks(newLinks) };
      }
      merged[field] = newLinks;
    }
  }

  await redis.hset(`app:${appId}`, toHash(merged));
  return { app: merged, diff };
}

export async function remove(appId: string): Promise<void> {
  const existing = await findById(appId);
  if (!existing) throw createError('App not found', 404);
  const pipeline = redis.pipeline();
  pipeline.del(`app:${appId}`);
  pipeline.srem('apps:all', appId);
  if (existing.squadId) pipeline.srem(`squad:${existing.squadId}:apps`, appId);
  await pipeline.exec();
}
