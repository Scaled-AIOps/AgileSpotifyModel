/**
 * Purpose: Role-rank-based CanActivate guard factory.
 * Usage:   Used as `canActivate: [roleGuard('TribeLead')]` on protected routes (currently /admin).
 * Goal:    Mirror the backend's authorize() role hierarchy on the frontend so unfit users never see the admin chrome.
 * ToDo:    —
 */
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import type { Role } from '../models/index';

const ROLE_RANK: Record<Role, number> = { Admin: 4, AgileCoach: 4, TribeLead: 3, PO: 2, ReleaseManager: 2, Member: 1 };

export function roleGuard(minimumRole: Role): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const role = auth.role();
    if (role && ROLE_RANK[role] >= ROLE_RANK[minimumRole]) return true;
    return router.createUrlTree(['/org']);
  };
}
