import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { createError, errorHandler, notFound } from '../../middleware/errorHandler';

function makeRes(): Partial<Response> {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json   = vi.fn().mockReturnValue(res);
  return res;
}

describe('createError', () => {
  it('creates an Error with a statusCode', () => {
    const err = createError('Not found', 404);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Not found');
    expect(err.statusCode).toBe(404);
  });
});

describe('errorHandler', () => {
  it('returns the error message for 4xx errors', () => {
    const res = makeRes() as Response;
    const err = createError('Bad request', 400);
    errorHandler(err, {} as Request, res, {} as NextFunction);
    expect(res.status).toHaveBeenCalledWith(400);
    expect((res.json as any).mock.calls[0][0]).toEqual({ error: 'Bad request' });
  });

  it('returns generic message for 500 errors', () => {
    const res = makeRes() as Response;
    const err = new Error('Something broke') as any;
    errorHandler(err, {} as Request, res, {} as NextFunction);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((res.json as any).mock.calls[0][0]).toEqual({ error: 'Internal server error' });
  });
});

describe('notFound', () => {
  it('returns 404', () => {
    const res = makeRes() as Response;
    notFound({} as Request, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect((res.json as any).mock.calls[0][0]).toEqual({ error: 'Not found' });
  });
});
