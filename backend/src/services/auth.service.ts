import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import redis from '../config/redis';
import { hashPassword, comparePassword } from '../lib/crypto';
import { generateId } from '../lib/id';
import { createError } from '../middleware/errorHandler';
import type { User, Role } from '../models/index';

const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function signAccess(userId: string, memberId: string, role: Role): string {
  return jwt.sign({ userId, memberId, role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

function signRefresh(userId: string): string {
  return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export async function register(email: string, password: string, name: string, role: Role): Promise<{ accessToken: string; refreshToken: string; user: Omit<User, 'passwordHash'> }> {
  const existingId = await redis.get(`user:email:${email}`);
  if (existingId) throw createError('Email already registered', 409);

  const id = generateId();
  const memberId = generateId();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const pipeline = redis.pipeline();
  pipeline.hset(`user:${id}`, { id, email, passwordHash, role, memberId, createdAt: now });
  pipeline.set(`user:email:${email}`, id);
  pipeline.sadd('users:all', id);
  // Create corresponding member record
  pipeline.hset(`member:${memberId}`, {
    id: memberId, name, email, avatarUrl: '', role, squadId: '', squadRole: '', chapterId: '', createdAt: now, updatedAt: now,
  });
  pipeline.set(`member:email:${email}`, memberId);
  pipeline.sadd('members:all', memberId);
  await pipeline.exec();

  const accessToken = signAccess(id, memberId, role);
  const refreshToken = signRefresh(id);
  await redis.set(`refresh:${id}`, refreshToken, 'EX', REFRESH_TTL);

  return {
    accessToken,
    refreshToken,
    user: { id, email, role, memberId, createdAt: now },
  };
}

export async function login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; user: Omit<User, 'passwordHash'> }> {
  const userId = await redis.get(`user:email:${email}`);
  if (!userId) throw createError('Invalid credentials', 401);

  const data = await redis.hgetall(`user:${userId}`);
  if (!data?.passwordHash) throw createError('Invalid credentials', 401);

  const valid = await comparePassword(password, data.passwordHash);
  if (!valid) throw createError('Invalid credentials', 401);

  const role = data.role as Role;
  const accessToken = signAccess(userId, data.memberId ?? '', role);
  const refreshToken = signRefresh(userId);
  await redis.set(`refresh:${userId}`, refreshToken, 'EX', REFRESH_TTL);

  return {
    accessToken,
    refreshToken,
    user: { id: userId, email, role, memberId: data.memberId, createdAt: data.createdAt },
  };
}

export async function refresh(token: string): Promise<{ accessToken: string }> {
  let payload: { userId: string };
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
  } catch {
    throw createError('Invalid refresh token', 401);
  }

  const stored = await redis.get(`refresh:${payload.userId}`);
  if (stored !== token) throw createError('Refresh token revoked', 401);

  const data = await redis.hgetall(`user:${payload.userId}`);
  if (!data?.role) throw createError('User not found', 401);

  const accessToken = signAccess(payload.userId, data.memberId ?? '', data.role as Role);
  return { accessToken };
}

export async function logout(userId: string): Promise<void> {
  await redis.del(`refresh:${userId}`);
}

export async function getMe(userId: string): Promise<Omit<User, 'passwordHash'> | null> {
  const data = await redis.hgetall(`user:${userId}`);
  if (!data?.id) return null;
  return { id: data.id, email: data.email, role: data.role as Role, memberId: data.memberId, createdAt: data.createdAt };
}

export async function loginByEmail(email: string): Promise<{ accessToken: string; refreshToken: string; user: Omit<User, 'passwordHash'> }> {
  const userId = await redis.get(`user:email:${email.toLowerCase()}`);
  if (!userId) throw createError('No account found for this email. Ask an admin to create one.', 401);

  const data = await redis.hgetall(`user:${userId}`);
  if (!data?.id) throw createError('User not found', 404);

  const role = data.role as Role;
  const accessToken = signAccess(userId, data.memberId ?? '', role);
  const refreshToken = signRefresh(userId);
  await redis.set(`refresh:${userId}`, refreshToken, 'EX', REFRESH_TTL);

  return {
    accessToken,
    refreshToken,
    user: { id: userId, email: data.email, role, memberId: data.memberId, createdAt: data.createdAt },
  };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const data = await redis.hgetall(`user:${userId}`);
  if (!data?.passwordHash) throw createError('User not found', 404);

  const valid = await comparePassword(currentPassword, data.passwordHash);
  if (!valid) throw createError('Current password is incorrect', 400);

  const newHash = await hashPassword(newPassword);
  await redis.hset(`user:${userId}`, 'passwordHash', newHash);
  // Invalidate all sessions
  await redis.del(`refresh:${userId}`);
}
