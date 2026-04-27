/**
 * Purpose: Zod request-body validation middleware.
 * Usage:   `validate(schema)` returns an Express middleware that parses + replaces `req.body` with the schema-coerced value, or 400s with the field errors.
 * Goal:    Move all input shape enforcement out of route handlers so handlers can trust their inputs.
 * ToDo:    —
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten().fieldErrors });
      return;
    }
    req.body = result.data;
    next();
  };
}
