/**
 * Purpose: Route table for the org-directory feature module.
 * Usage:   Lazy-loaded by app.routes.ts under /org.
 * Goal:    Group all hierarchy-browsing routes (tree, domain, tribe, squad, chapter, guild).
 * ToDo:    —
 */
import { Routes } from '@angular/router';

export const orgDirectoryRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./org-context/org-context.component').then((m) => m.OrgContextComponent),
  },
  {
    path: 'domains/:id',
    loadComponent: () => import('./domain-detail/domain-detail.component').then((m) => m.DomainDetailComponent),
  },
  {
    path: 'tribes/:id',
    loadComponent: () => import('./tribe-detail/tribe-detail.component').then((m) => m.TribeDetailComponent),
  },
  {
    path: 'squads/:id',
    loadComponent: () => import('./squad-detail/squad-detail.component').then((m) => m.SquadDetailComponent),
  },
  {
    path: 'chapters/:id',
    loadComponent: () => import('./chapter-detail/chapter-detail.component').then((m) => m.ChapterDetailComponent),
  },
  {
    path: 'guilds',
    loadComponent: () => import('./guild-list/guild-list.component').then((m) => m.GuildListComponent),
  },
  {
    path: 'guilds/:id',
    loadComponent: () => import('./guild-detail/guild-detail.component').then((m) => m.GuildDetailComponent),
  },
];
