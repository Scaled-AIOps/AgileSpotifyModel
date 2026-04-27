import { Routes } from '@angular/router';

export const workTrackingRoutes: Routes = [
  { path: '', redirectTo: 'squads', pathMatch: 'full' },
  {
    path: 'squads',
    loadComponent: () => import('./squad-picker/squad-picker.component').then((m) => m.SquadPickerComponent),
  },
  {
    path: 'squads/:squadId/backlog',
    loadComponent: () => import('./backlog/backlog.component').then((m) => m.BacklogComponent),
  },
  {
    path: 'squads/:squadId/sprint',
    loadComponent: () => import('./sprint-board/sprint-board.component').then((m) => m.SprintBoardComponent),
  },
];
