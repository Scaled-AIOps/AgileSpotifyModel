/**
 * Purpose: Top-level route table for the SPA.
 * Usage:   Imported by app.config.ts via `provideRouter(routes, ...)`. Defines /auth (no guard) plus the authenticated shell with /dashboard, /apps, /org, /admin children.
 * Goal:    Keep the URL layout in one file; lazy-loads each feature module.
 * ToDo:    —
 */
import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/apps', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'org',
        loadChildren: () => import('./features/org-directory/org-directory.routes').then((m) => m.orgDirectoryRoutes),
      },
      {
        path: 'apps',
        loadChildren: () => import('./features/apps/apps.routes').then((m) => m.appsRoutes),
      },
      {
        path: 'admin',
        canActivate: [roleGuard('TribeLead')],
        loadChildren: () => import('./features/admin/admin.routes').then((m) => m.adminRoutes),
      },
    ],
  },
  { path: '**', redirectTo: '/apps' },
];
