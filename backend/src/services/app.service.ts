import redis from '../config/redis';
import { createError } from '../middleware/errorHandler';
import type { App, AppStatus } from '../models/index';

interface AppRaw {
  appId: string;
  gitRepo: string;
  squadId: string;
  squadKey: string;
  status: AppStatus;
  tags: string;
  platforms: string;
  urls: string;
  probeHealth: string;
  probeInfo: string;
  probeLiveness: string;
  probeReadiness: string;
  javaVersion: string;
  javaComplianceStatus: string;
  artifactoryUrl: string;
  xrayUrl: string;
  compositionViewerUrl: string;
  splunkUrl: string;
  createdAt: string;
}

function fromHash(h: Record<string, string>): AppRaw {
  return h as unknown as AppRaw;
}

export async function create(data: {
  appId: string;
  gitRepo: string;
  squadId: string;
  squadKey: string;
  status: AppStatus;
  tags: Record<string, string>;
  platforms: Record<string, string>;
  urls: Record<string, string>;
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
}): Promise<AppRaw> {
  const app: AppRaw = {
    appId:                data.appId,
    gitRepo:              data.gitRepo,
    squadId:              data.squadId,
    squadKey:             data.squadKey,
    status:               data.status,
    tags:                 JSON.stringify(data.tags),
    platforms:            JSON.stringify(data.platforms),
    urls:                 JSON.stringify(data.urls),
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
  pipeline.hset(`app:${data.appId}`, app as unknown as Record<string, string>);
  pipeline.sadd('apps:all', data.appId);
  if (data.squadId) pipeline.sadd(`squad:${data.squadId}:apps`, data.appId);
  await pipeline.exec();
  return app;
}

export async function findAll(): Promise<AppRaw[]> {
  const ids = await redis.smembers('apps:all');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`app:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter((a) => a?.appId);
}

export async function findById(appId: string): Promise<AppRaw | null> {
  const h = await redis.hgetall(`app:${appId}`);
  return h?.appId ? fromHash(h) : null;
}

export async function findBySquad(squadId: string): Promise<AppRaw[]> {
  const ids = await redis.smembers(`squad:${squadId}:apps`);
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`app:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter((a) => a?.appId);
}

type UpdateData = Partial<{
  status: AppStatus;
  gitRepo: string;
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
}>;

function safeParseTags(raw: string): Record<string, string> {
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function update(appId: string, data: UpdateData): Promise<{ app: AppRaw; diff: Record<string, { from: string; to: string }> }> {
  const existing = await findById(appId);
  if (!existing) throw createError('App not found', 404);

  const diff: Record<string, { from: string; to: string }> = {};
  const patch: Partial<AppRaw> = {};

  const SIMPLE_FIELDS = [
    'status', 'gitRepo', 'javaVersion', 'javaComplianceStatus',
    'artifactoryUrl', 'xrayUrl', 'compositionViewerUrl', 'splunkUrl',
    'probeHealth', 'probeInfo', 'probeLiveness', 'probeReadiness',
  ] as const;

  for (const field of SIMPLE_FIELDS) {
    const val = (data as any)[field];
    if (val !== undefined && val !== existing[field]) {
      diff[field] = { from: existing[field] ?? '', to: val };
      (patch as any)[field] = val;
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
    patch.tags = JSON.stringify(newTags);
  }

  const updated = { ...existing, ...patch };
  await redis.hset(`app:${appId}`, updated as unknown as Record<string, string>);
  return { app: updated, diff };
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
