import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SquadApi } from '../../../core/api/squad.api';
import type { Squad } from '../../../core/models/index';

@Component({
  selector: 'app-squad-picker',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title">
          <h1>Work Tracking</h1>
          <div class="page-sub">Select a squad to manage its backlog and sprints.</div>
        </div>
      </div>

      <div class="card-grid">
        @for (squad of squads; track squad.id) {
          <div class="card">
            <div class="card-body">
              <div style="font-weight:600;margin-bottom:4px">{{ squad.name }}</div>
              @if (squad.missionStatement) {
                <div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:8px">{{ squad.missionStatement }}</div>
              }
            </div>
            <div class="card-footer-row">
              <a class="btn btn-ghost btn-sm" [routerLink]="['/work/squads', squad.id, 'backlog']">Backlog</a>
              <a class="btn btn-primary btn-sm" [routerLink]="['/work/squads', squad.id, 'sprint']">Sprint</a>
            </div>
          </div>
        }
        @empty {
          <div class="empty-state">
            <div class="empty-icon">◫</div>
            <div class="empty-title">No squads found.</div>
            <div class="empty-sub">Create squads from the org directory first.</div>
          </div>
        }
      </div>
    }
  `,
})
export class SquadPickerComponent implements OnInit {
  private squadApi = inject(SquadApi);
  squads: Squad[] = [];
  loading = true;

  async ngOnInit() {
    this.squads = await firstValueFrom(this.squadApi.getAll());
    this.loading = false;
  }
}
