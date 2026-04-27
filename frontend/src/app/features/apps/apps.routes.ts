/**
 * Purpose: Route table for the application registry feature.
 * Usage:   Lazy-loaded by app.routes.ts under /apps.
 * Goal:    Group app list, detail, registration, and infra cluster routes.
 * ToDo:    —
 */
import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

export const appsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./app-list/app-list.component').then((m) => m.AppListComponent),
  },
  {
    path: 'new',
    canActivate: [roleGuard('TribeLead')],
    loadComponent: () => import('./app-form/app-form.component').then((m) => m.AppFormComponent),
  },
  {
    path: 'infra',
    loadComponent: () => import('./infra-clusters/infra-clusters.component').then((m) => m.InfraClustersComponent),
  },
  {
    path: ':appId',
    loadComponent: () => import('./app-detail/app-detail.component').then((m) => m.AppDetailComponent),
  },
];
