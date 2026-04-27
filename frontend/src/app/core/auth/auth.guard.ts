import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  // Try refreshing the access token from the cookie
  const ok = await auth.refreshToken();
  if (ok) {
    await auth.loadCurrentUser();
    return true;
  }

  return router.createUrlTree(['/auth/login']);
};
