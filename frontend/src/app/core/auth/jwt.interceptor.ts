/**
 * Purpose: Functional HttpInterceptorFn that attaches the access token + handles 401.
 * Usage:   Registered in app.config.ts via `provideHttpClient(withInterceptors([jwtInterceptor]))`. On 401 (non-/auth/) it transparently refreshes the token and retries the request.
 * Goal:    Make every API call automatically authenticated and let expired tokens self-heal without bothering the caller.
 * ToDo:    Coalesce concurrent 401s so only one /auth/refresh call is in flight at a time.
 */
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { from } from 'rxjs';
import { AuthService } from './auth.service';

export const jwtInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const auth = inject(AuthService);
  const token = auth.getAccessToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !req.url.includes('/auth/')) {
        return from(auth.refreshToken()).pipe(
          switchMap((ok) => {
            if (!ok) return throwError(() => err);
            const newToken = auth.getAccessToken();
            const retried = newToken
              ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
              : req;
            return next(retried);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
