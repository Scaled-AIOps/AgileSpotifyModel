import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { featureFlagGuard } from './core/feature-flags/feature-flag.guard';

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
        path: 'work',
        canActivate: [featureFlagGuard('workTracking')],
        loadChildren: () => import('./features/work-tracking/work-tracking.routes').then((m) => m.workTrackingRoutes),
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
