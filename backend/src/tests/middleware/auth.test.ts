import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate } from '../../middleware/auth';
import { env } from '../../config/env';

function makeReq(authHeader?: string): Partial<Request> {
  return { headers: { authorization: authHeader } } as Partial<Request>;
}
function makeRes(): Partial<Response> {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json   = vi.fn().mockReturnValue(res);
  return res;
}
const next: NextFunction = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('authenticate', () => {
  it('calls next() with a valid token', () => {
    const token = jwt.sign({ userId: 'u1', memberId: 'm1', role: 'Admin' }, env.JWT_SIGNING_KEY);
    const req = makeReq(`Bearer ${token}`) as Request;
    const res = makeRes() as Response;

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as any).user).toMatchObject({ userId: 'u1', role: 'Admin' });
  });

  it('returns 401 when Authorization header is missing', () => {
    const req = makeReq() as Request;
    const res = makeRes() as Response;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token is invalid', () => {
    const req = makeReq('Bearer invalid.token.here') as Request;
    const res = makeRes() as Response;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when header does not start with Bearer', () => {
    const req = makeReq('Basic sometoken') as Request;
    const res = makeRes() as Response;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when token is expired', () => {
    const token = jwt.sign({ userId: 'u1', memberId: 'm1', role: 'Member' }, env.JWT_SIGNING_KEY, { expiresIn: -1 });
    const req = makeReq(`Bearer ${token}`) as Request;
    const res = makeRes() as Response;

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
