import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPipeline = {
  hset: vi.fn().mockReturnThis(),
  set:  vi.fn().mockReturnThis(),
  sadd: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

vi.mock('../../config/redis', () => ({
  default: {
    get:      vi.fn(),
    set:      vi.fn().mockResolvedValue('OK'),
    hgetall:  vi.fn(),
    hset:     vi.fn().mockResolvedValue(1),
    del:      vi.fn().mockResolvedValue(1),
    sadd:     vi.fn().mockResolvedValue(1),
    pipeline: vi.fn(() => mockPipeline),
  },
}));

vi.mock('../../lib/id', () => ({
  generateId: vi.fn()
    .mockReturnValueOnce('user-id-1')
    .mockReturnValueOnce('member-id-1')
    .mockImplementation(() => 'fallback-id'),
}));

import redis from '../../config/redis';
import { register, login, refresh, logout, getMe, changePasscode } from '../../services/auth.service';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

beforeEach(() => vi.clearAllMocks());

describe('register', () => {
  beforeEach(() => {
    (redis.get as any).mockResolvedValue(null); // email not taken
  });

  it('creates a user and returns access + refresh tokens', async () => {
    const result = await register('alice@example.com', 'Password1!', 'Alice', 'Admin');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.user.email).toBe('alice@example.com');
    expect(result.user.role).toBe('Admin');
  });

  it('throws 409 when email is already registered', async () => {
    (redis.get as any).mockResolvedValue('existing-user-id');
    await expect(register('taken@example.com', 'Password1!', 'Bob', 'Member')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('stores refresh token in redis', async () => {
    await register('alice@example.com', 'Password1!', 'Alice', 'Admin');
    expect(redis.set).toHaveBeenCalled();
  });
});

describe('login', () => {
  it('returns tokens for valid credentials', async () => {
    const { hashPasscode } = await import('../../lib/crypto');
    const hash = await hashPasscode('correct-pass');
    (redis.get as any).mockResolvedValue('user-id-1');
    (redis.hgetall as any).mockResolvedValue({
      id: 'user-id-1', email: 'alice@example.com', passcodeHash: hash,
      role: 'Admin', memberId: 'member-id-1', createdAt: new Date().toISOString(),
    });

    const result = await login('alice@example.com', 'correct-pass');
    expect(result.accessToken).toBeTruthy();
    expect(result.user.email).toBe('alice@example.com');
  });

  it('throws 401 for unknown email', async () => {
    (redis.get as any).mockResolvedValue(null);
    await expect(login('unknown@example.com', 'pass')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for wrong passcode', async () => {
    const { hashPasscode } = await import('../../lib/crypto');
    const hash = await hashPasscode('correct');
    (redis.get as any).mockResolvedValue('uid');
    (redis.hgetall as any).mockResolvedValue({ id: 'uid', passcodeHash: hash, role: 'Member', memberId: 'mid', createdAt: '' });
    await expect(login('x@x.com', 'wrong')).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('refresh', () => {
  it('returns a new access token for a valid refresh token', async () => {
    const refreshToken = jwt.sign({ userId: 'uid' }, env.JWT_REFRESH_KEY, { expiresIn: '7d' });
    (redis.get as any).mockResolvedValue(refreshToken);
    (redis.hgetall as any).mockResolvedValue({ role: 'Member', memberId: 'mid' });

    const result = await refresh(refreshToken);
    expect(result.accessToken).toBeTruthy();
  });

  it('throws 401 for a token that does not match stored token', async () => {
    const tok = jwt.sign({ userId: 'uid' }, env.JWT_REFRESH_KEY);
    (redis.get as any).mockResolvedValue('different-token');
    await expect(refresh(tok)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 for an invalid JWT', async () => {
    await expect(refresh('not.a.jwt')).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('logout', () => {
  it('deletes the refresh token from redis', async () => {
    await logout('uid');
    expect(redis.del).toHaveBeenCalledWith('refresh:uid');
  });
});

describe('getMe', () => {
  it('returns the user when found', async () => {
    (redis.hgetall as any).mockResolvedValue({ id: 'uid', email: 'a@b.com', role: 'Admin', memberId: 'mid', createdAt: '' });
    const user = await getMe('uid');
    expect(user?.email).toBe('a@b.com');
  });

  it('returns null when user not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    const user = await getMe('nonexistent');
    expect(user).toBeNull();
  });
});

describe('changePasscode', () => {
  it('changes passcode when current is correct', async () => {
    const { hashPasscode } = await import('../../lib/crypto');
    const hash = await hashPasscode('OldPass1!');
    (redis.hgetall as any).mockResolvedValue({ passcodeHash: hash });
    await expect(changePasscode('uid', 'OldPass1!', 'NewPass1!')).resolves.toBeUndefined();
    expect(redis.hset).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalled();
  });

  it('throws 400 when current passcode is wrong', async () => {
    const { hashPasscode } = await import('../../lib/crypto');
    const hash = await hashPasscode('OldPass1!');
    (redis.hgetall as any).mockResolvedValue({ passcodeHash: hash });
    await expect(changePasscode('uid', 'WrongOld!', 'NewPass1!')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when user not found', async () => {
    (redis.hgetall as any).mockResolvedValue({});
    await expect(changePasscode('uid', 'any', 'new')).rejects.toMatchObject({ statusCode: 404 });
  });
});
