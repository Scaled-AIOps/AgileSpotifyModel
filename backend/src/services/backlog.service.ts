import redis from '../config/redis';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import type { BacklogItem } from '../models/index';

function fromHash(h: Record<string, string>): BacklogItem {
  return { ...h, priority: Number(h.priority), storyPoints: Number(h.storyPoints) } as unknown as BacklogItem;
}

export async function create(squadId: string, data: Partial<BacklogItem>): Promise<BacklogItem> {
  const squadExists = await redis.exists(`squad:${squadId}`);
  if (!squadExists) throw createError('Squad not found', 404);

  const id = generateId();
  const now = new Date().toISOString();
  const item: BacklogItem = {
    id, squadId,
    title: data.title ?? '',
    description: data.description ?? '',
    type: data.type ?? 'Story',
    status: data.status ?? 'Backlog',
    priority: data.priority ?? 500,
    storyPoints: data.storyPoints ?? 0,
    sprintId: data.sprintId ?? '',
    assigneeId: data.assigneeId ?? '',
    epicId: data.epicId ?? '',
    createdAt: now, updatedAt: now,
  };

  const pipeline = redis.pipeline();
  pipeline.hset(`backlogitem:${id}`, item as unknown as Record<string, string>);
  pipeline.zadd(`squad:${squadId}:backlog`, item.priority, id);
  await pipeline.exec();
  return item;
}

export async function findBySquad(squadId: string): Promise<BacklogItem[]> {
  const ids = await redis.zrange(`squad:${squadId}:backlog`, 0, -1);
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`backlogitem:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter(Boolean);
}

export async function findById(id: string): Promise<BacklogItem | null> {
  const h = await redis.hgetall(`backlogitem:${id}`);
  return h?.id ? fromHash(h) : null;
}

export async function update(id: string, data: Partial<BacklogItem>): Promise<BacklogItem> {
  const existing = await findById(id);
  if (!existing) throw createError('Backlog item not found', 404);
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  const pipeline = redis.pipeline();
  pipeline.hset(`backlogitem:${id}`, updated as unknown as Record<string, string>);
  if (data.priority !== undefined) {
    pipeline.zadd(`squad:${updated.squadId}:backlog`, updated.priority, id);
  }
  await pipeline.exec();
  return updated;
}

export async function updateStatus(id: string, status: BacklogItem['status']): Promise<BacklogItem> {
  return update(id, { status });
}

export async function remove(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw createError('Backlog item not found', 404);
  const pipeline = redis.pipeline();
  pipeline.del(`backlogitem:${id}`);
  pipeline.zrem(`squad:${existing.squadId}:backlog`, id);
  if (existing.sprintId) pipeline.srem(`sprint:${existing.sprintId}:items`, id);
  await pipeline.exec();
}

export async function reorder(squadId: string, items: { id: string; priority: number }[]): Promise<void> {
  const pipeline = redis.pipeline();
  items.forEach(({ id, priority }) => {
    pipeline.zadd(`squad:${squadId}:backlog`, priority, id);
    pipeline.hset(`backlogitem:${id}`, { priority: String(priority), updatedAt: new Date().toISOString() });
  });
  await pipeline.exec();
}
