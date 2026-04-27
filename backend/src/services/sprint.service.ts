import redis from '../config/redis';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import type { Sprint } from '../models/index';

function fromHash(h: Record<string, string>): Sprint {
  return { ...h, velocity: Number(h.velocity ?? 0) } as unknown as Sprint;
}

export async function create(squadId: string, data: { name: string; goal: string; startDate: string; endDate: string }): Promise<Sprint> {
  const squadExists = await redis.exists(`squad:${squadId}`);
  if (!squadExists) throw createError('Squad not found', 404);

  const id = generateId();
  const now = new Date().toISOString();
  const sprint: Sprint = { id, squadId, name: data.name, goal: data.goal, status: 'Planning', startDate: data.startDate, endDate: data.endDate, velocity: 0, createdAt: now, updatedAt: now };

  const startTs = new Date(data.startDate).getTime();
  const pipeline = redis.pipeline();
  pipeline.hset(`sprint:${id}`, sprint as unknown as Record<string, string>);
  pipeline.zadd(`squad:${squadId}:sprints`, startTs, id);
  pipeline.sadd('sprints:all', id);
  await pipeline.exec();
  return sprint;
}

export async function findBySquad(squadId: string): Promise<Sprint[]> {
  const ids = await redis.zrange(`squad:${squadId}:sprints`, 0, -1, 'REV');
  if (!ids.length) return [];
  const pipeline = redis.pipeline();
  ids.forEach((id) => pipeline.hgetall(`sprint:${id}`));
  const results = await pipeline.exec();
  return (results ?? []).map(([, h]) => fromHash(h as Record<string, string>)).filter(Boolean);
}

export async function findActive(squadId: string): Promise<Sprint | null> {
  const id = await redis.get(`squad:${squadId}:activeSprint`);
  if (!id) return null;
  const h = await redis.hgetall(`sprint:${id}`);
  return h?.id ? fromHash(h) : null;
}

export async function findById(id: string): Promise<Sprint | null> {
  const h = await redis.hgetall(`sprint:${id}`);
  return h?.id ? fromHash(h) : null;
}

export async function update(id: string, data: Partial<Omit<Sprint, 'id' | 'squadId' | 'createdAt' | 'updatedAt' | 'velocity'>>): Promise<Sprint> {
  const existing = await findById(id);
  if (!existing) throw createError('Sprint not found', 404);
  const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
  await redis.hset(`sprint:${id}`, updated as unknown as Record<string, string>);
  return updated;
}

export async function start(squadId: string, sprintId: string): Promise<Sprint> {
  const active = await redis.get(`squad:${squadId}:activeSprint`);
  if (active) throw createError('A sprint is already active for this squad', 409);

  const sprint = await findById(sprintId);
  if (!sprint) throw createError('Sprint not found', 404);
  if (sprint.squadId !== squadId) throw createError('Sprint does not belong to this squad', 400);

  const updated = { ...sprint, status: 'Active' as const, updatedAt: new Date().toISOString() };
  const pipeline = redis.pipeline();
  pipeline.hset(`sprint:${sprintId}`, updated as unknown as Record<string, string>);
  pipeline.set(`squad:${squadId}:activeSprint`, sprintId);
  await pipeline.exec();
  return updated;
}

export async function complete(squadId: string, sprintId: string): Promise<Sprint> {
  const sprint = await findById(sprintId);
  if (!sprint) throw createError('Sprint not found', 404);
  if (sprint.squadId !== squadId) throw createError('Sprint does not belong to this squad', 400);

  // Compute velocity: sum of storyPoints for Done items
  const itemIds = await redis.smembers(`sprint:${sprintId}:items`);
  let velocity = 0;
  if (itemIds.length) {
    const pipeline = redis.pipeline();
    itemIds.forEach((id) => pipeline.hget(`backlogitem:${id}`, 'storyPoints'));
    pipeline.hgetall(`sprint:${sprintId}`); // dummy to check statuses
    const results = await pipeline.exec();

    const statusPipeline = redis.pipeline();
    itemIds.forEach((id) => statusPipeline.hget(`backlogitem:${id}`, 'status'));
    const statusResults = await statusPipeline.exec();

    itemIds.forEach((id, i) => {
      const status = statusResults?.[i]?.[1] as string;
      const pts = results?.[i]?.[1] as string;
      if (status === 'Done') velocity += Number(pts ?? 0);
    });
  }

  const updated = { ...sprint, status: 'Completed' as const, velocity, updatedAt: new Date().toISOString() };
  const pipeline = redis.pipeline();
  pipeline.hset(`sprint:${sprintId}`, updated as unknown as Record<string, string>);
  pipeline.del(`squad:${squadId}:activeSprint`);
  await pipeline.exec();
  return updated;
}

export async function remove(id: string): Promise<void> {
  const existing = await findById(id);
  if (!existing) throw createError('Sprint not found', 404);
  const pipeline = redis.pipeline();
  pipeline.del(`sprint:${id}`);
  pipeline.del(`sprint:${id}:items`);
  pipeline.zrem(`squad:${existing.squadId}:sprints`, id);
  pipeline.srem('sprints:all', id);
  const active = await redis.get(`squad:${existing.squadId}:activeSprint`);
  if (active === id) pipeline.del(`squad:${existing.squadId}:activeSprint`);
  await pipeline.exec();
}

export async function addItem(sprintId: string, itemId: string): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.sadd(`sprint:${sprintId}:items`, itemId);
  pipeline.hset(`backlogitem:${itemId}`, 'sprintId', sprintId);
  await pipeline.exec();
}

export async function removeItem(sprintId: string, itemId: string): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.srem(`sprint:${sprintId}:items`, itemId);
  pipeline.hset(`backlogitem:${itemId}`, 'sprintId', '');
  await pipeline.exec();
}

export async function getItems(sprintId: string): Promise<string[]> {
  return redis.smembers(`sprint:${sprintId}:items`);
}
