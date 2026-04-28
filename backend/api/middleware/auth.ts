/**
 * Purpose: JWT authentication middleware + `JwtPayload` type.
 * Usage:   `router.use(authenticate)` is called at the top of every routes file; it verifies `Authorization: Bearer <token>` and attaches `req.user`.
 * Goal:    Single chokepoint for token verification so every protected route gets the same parsing rules and 401 error format.
 * ToDo:    Surface specific JWT failure causes (expired vs malformed) for clearer 401 messages.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  memberId: string;
  role: 'Admin' | 'TribeLead' | 'PO' | 'AgileCoach' | 'ReleaseManager' | 'Member';
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.JWT_SIGNING_KEY) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
