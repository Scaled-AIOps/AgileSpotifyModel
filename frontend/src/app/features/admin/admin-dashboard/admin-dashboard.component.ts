import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { OrgApi, HeadcountEntry } from '../../../core/api/org.api';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title"><h1>Admin Dashboard</h1></div>
        <div style="display:flex;gap:8px">
          @if (isFullAdmin) {
            <a class="btn btn-ghost" routerLink="/admin/flags">Feature Flags</a>
          }
          <a class="btn btn-primary" routerLink="/admin/members">Manage Members</a>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-body">
          <div style="font-weight:600;margin-bottom:16px;color:var(--text-strong)">Headcount by Tribe</div>
          <div class="bar-chart">
            @for (tribe of headcount; track tribe.id) {
              <div class="bar-row">
                <div class="bar-label">{{ tribe.name }}</div>
                <div class="bar-track">
                  <div class="bar-fill" [style.width]="barWidth(tribe.memberCount)"></div>
                </div>
                <div class="bar-value">{{ tribe.memberCount }}</div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="card-grid">
        @for (tribe of headcount; track tribe.id) {
          <div class="card">
            <div class="card-body">
              <div style="font-weight:600;margin-bottom:2px">{{ tribe.name }}</div>
              <div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:10px">{{ tribe.memberCount }} members</div>
              <ul class="squad-list">
                @for (sq of tribe.squads; track sq.id) {
                  <li><span>{{ sq.name }}</span><span class="sq-count">{{ sq.memberCount }}</span></li>
                }
              </ul>
            </div>
          </div>
        }
        @empty {
          <div class="empty-state"><div class="empty-icon">◉</div><div class="empty-title">No tribes found</div></div>
        }
      </div>
    }
  `,
  styles: [`
    .bar-chart { display: flex; flex-direction: column; gap: 10px; }
    .bar-row { display: flex; align-items: center; gap: 10px; }
    .bar-label { width: 160px; font-size: 0.85rem; color: var(--text); text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-track { flex: 1; height: 22px; background: var(--surface-bg); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--blue-500); border-radius: 4px; transition: width 0.4s; }
    .bar-value { width: 32px; font-size: 0.85rem; font-weight: 600; color: var(--text-strong); }
    .squad-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .squad-list li { display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text-muted); }
    .sq-count { font-weight: 600; color: var(--text); }
  `],
})
export class AdminDashboardComponent implements OnInit {
  private orgApi = inject(OrgApi);
  private auth = inject(AuthService);
  get isFullAdmin() { const r = this.auth.currentUser()?.role; return r === 'Admin' || r === 'AgileCoach'; }

  headcount: HeadcountEntry[] = [];
  loading = true;
  private maxCount = 1;

  async ngOnInit() {
    this.headcount = await firstValueFrom(this.orgApi.getHeadcount());
    this.maxCount = Math.max(1, ...this.headcount.map((t) => t.memberCount));
    this.loading = false;
  }

  barWidth(count: number): string {
    return `${Math.round((count / this.maxCount) * 100)}%`;
  }
}
