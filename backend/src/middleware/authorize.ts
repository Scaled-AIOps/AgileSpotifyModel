/**
 * Purpose: Role-rank-based authorisation middleware factory.
 * Usage:   `authorize('TribeLead')` returns a guard that admits any role whose rank ≥ TribeLead. Used per-route, e.g. `router.post('/', authorize('TribeLead'), ...)`.
 * Goal:    Encode the role hierarchy (Admin = AgileCoach > TribeLead > PO = ReleaseManager > Member) once and reuse it across routes.
 * ToDo:    —
 */
import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from './auth';

type Role = JwtPayload['role'];

const ROLE_RANK: Record<Role, number> = {
  Admin: 4,
  TribeLead: 3,
  AgileCoach: 4,
  PO: 2,
  ReleaseManager: 2,
  Member: 1,
};

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }
    const userRank = ROLE_RANK[req.user.role];
    const hasPermission = roles.some((r) => userRank >= ROLE_RANK[r]);
    if (!hasPermission) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
