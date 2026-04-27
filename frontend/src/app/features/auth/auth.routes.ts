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
