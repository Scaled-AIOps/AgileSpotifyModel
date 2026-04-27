import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate';

function makeRes(): Partial<Response> {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json   = vi.fn().mockReturnValue(res);
  return res;
}
const next: NextFunction = vi.fn();

const schema = z.object({
  name: z.string().min(1),
  age:  z.number().int().positive(),
});

beforeEach(() => vi.clearAllMocks());

describe('validate', () => {
  it('calls next() and sets req.body to parsed data when valid', () => {
    const req = { body: { name: 'Alice', age: 30 } } as Request;
    const res = makeRes() as Response;

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('returns 400 with field errors when validation fails', () => {
    const req = { body: { name: '', age: -1 } } as Request;
    const res = makeRes() as Response;

    validate(schema)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.error).toBe('Validation failed');
    expect(payload.details).toBeDefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('applies schema transforms (coercion)', () => {
    const coercingSchema = z.object({ count: z.coerce.number() });
    const req = { body: { count: '5' } } as Request;
    validate(coercingSchema)(req, makeRes() as Response, next);
    expect(req.body.count).toBe(5);
  });
});
