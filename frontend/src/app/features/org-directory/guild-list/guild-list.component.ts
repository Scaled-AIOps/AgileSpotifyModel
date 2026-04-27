import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GuildApi } from '../../../core/api/guild.api';
import type { Guild } from '../../../core/models/index';

@Component({
  selector: 'app-guild-list',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header"><div class="page-title"><h1>Guilds</h1></div></div>
      <div class="card-grid">
        @for (g of guilds; track g.id) {
          <div class="card">
            <div class="card-body">
              <div style="font-weight:600;margin-bottom:0.25rem">{{ g.name }}</div>
              <div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.75rem">{{ g.description }}</div>
            </div>
            <div class="card-footer-row">
              <a class="btn btn-primary btn-sm" [routerLink]="['/org/guilds', g.id]">View Guild</a>
            </div>
          </div>
        }
        @empty {
          <div class="empty-state"><div class="empty-icon">⬡</div><div class="empty-title">No guilds yet</div></div>
        }
      </div>
    }
  `,
})
export class GuildListComponent implements OnInit {
  private guildApi = inject(GuildApi);
  guilds: Guild[] = [];
  loading = true;

  async ngOnInit() {
    this.guilds = await firstValueFrom(this.guildApi.getAll());
    this.loading = false;
  }
}
