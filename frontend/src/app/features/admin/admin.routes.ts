import { Routes } from '@angular/router';
import { roleGuard } from '../../core/auth/role.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-dashboard/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
  },
  {
    path: 'members',
    loadComponent: () => import('./member-list/member-list.component').then((m) => m.MemberListComponent),
  },
  {
    path: 'members/new',
    loadComponent: () => import('./member-form/member-form.component').then((m) => m.MemberFormComponent),
  },
  {
    path: 'members/:id',
    loadComponent: () => import('./member-form/member-form.component').then((m) => m.MemberFormComponent),
  },
  {
    path: 'flags',
    canActivate: [roleGuard('Admin')],
    loadComponent: () => import('./feature-flags/feature-flags.component').then((m) => m.FeatureFlagsComponent),
  },
];
