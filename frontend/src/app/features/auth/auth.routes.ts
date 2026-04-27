/**
 * Purpose: Route table for the auth feature module.
 * Usage:   Lazy-loaded by app.routes.ts under /auth.
 * Goal:    Group login + OAuth callback routes in one feature.
 * ToDo:    —
 */
import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'callback',
    loadComponent: () => import('./oauth-callback/oauth-callback.component').then((m) => m.OAuthCallbackComponent),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
