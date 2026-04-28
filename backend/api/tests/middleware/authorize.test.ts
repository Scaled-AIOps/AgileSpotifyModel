import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authorize } from '../../middleware/authorize';
import type { JwtPayload } from '../../middleware/auth';

function makeRes(): Partial<Response> {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json   = vi.fn().mockReturnValue(res);
  return res;
}
const next: NextFunction = vi.fn();

function makeReq(user?: Partial<JwtPayload>): Partial<Request> {
  return { user } as Partial<Request>;
}

beforeEach(() => vi.clearAllMocks());

describe('authorize', () => {
  it('calls next() when user has sufficient role', () => {
    const req = makeReq({ role: 'Admin', userId: 'u1', memberId: 'm1' }) as Request;
    authorize('Member')(req, makeRes() as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('calls next() when user has exact required role', () => {
    const req = makeReq({ role: 'TribeLead', userId: 'u1', memberId: 'm1' }) as Request;
    authorize('TribeLead')(req, makeRes() as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns 403 when user has insufficient role', () => {
    const res = makeRes() as Response;
    const req = makeReq({ role: 'Member', userId: 'u1', memberId: 'm1' }) as Request;
    authorize('Admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when user is not set', () => {
    const res = makeRes() as Response;
    const req = makeReq(undefined) as Request;
    authorize('Member')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('AgileCoach has Admin-level rank', () => {
    const req = makeReq({ role: 'AgileCoach', userId: 'u1', memberId: 'm1' }) as Request;
    authorize('Admin')(req, makeRes() as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('ReleaseManager can satisfy PO requirement', () => {
    const req = makeReq({ role: 'ReleaseManager', userId: 'u1', memberId: 'm1' }) as Request;
    authorize('PO')(req, makeRes() as Response, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
