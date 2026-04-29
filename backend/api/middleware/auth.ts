/**
 * Purpose: JWT authentication middleware + `JwtPayload` type.
 * Usage:   `router.use(authenticate)` is called at the top of every routes file; it verifies `Authorization: Bearer <token>` and attaches `req.user`.
 * Goal:    Single chokepoint for token verification so every protected route gets the same parsing rules and 401 error format.
 * ToDo:    Surface specific JWT failure causes (expired vs malformed) for clearer 401 messages.
 */
import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env, ingestToken } from '../config/env';

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

/** Constant-time compare for the ingest token. */
function ingestTokenMatches(presented: string): boolean {
  if (presented.length !== ingestToken.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(ingestToken));
}

/**
 * Authentication middleware for ingest endpoints (POST/PATCH on apps + deploy
 * events). Accepts EITHER a valid user JWT (treated like the normal `authenticate`)
 * OR the shared `INGEST_API_KEY` bearer (acts as a synthetic Admin principal so
 * downstream `authorize()` and `resolveEditable()` checks pass). Use sparingly —
 * mount only on the ingest routes, not on read-only ones.
 */
export function authenticateOrIngest(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = header.slice(7);

  // Try ingest API key first — cheap constant-time string compare.
  if (ingestTokenMatches(token)) {
    req.user = { userId: 'ingest', memberId: 'ingest', role: 'Admin' };
    next();
    return;
  }

  // Otherwise fall back to JWT verification.
  try {
    req.user = jwt.verify(token, env.JWT_SIGNING_KEY) as JwtPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
