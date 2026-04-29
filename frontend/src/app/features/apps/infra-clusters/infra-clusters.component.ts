/**
 * Purpose: Infra-cluster list + detail page.
 * Usage:   Routed at /apps/infra. Browse OpenShift / EKS / etc. clusters and the apps deployed on each.
 * Goal:    Surface the platform layer beneath the application registry.
 * ToDo:    —
 */
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KeyValuePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { AppsApi } from '../../../core/api/apps.api';
import type { InfraCluster, InfraStatus } from '../../../core/models/index';

const ENV_CLASS: Record<string, string> = {
  prd: 'badge-danger', uat: 'badge-warn', int: 'badge-story', dev: 'badge-success', local: 'badge-muted',
};

const STATUS_CLASS: Record<InfraStatus, string> = {
  'active':                    'badge-success',
  'inactive':                  'badge-muted',
  'marked-for-decommissioning': 'badge-warn',
  'failed':                    'badge-danger',
};

@Component({
  selector: 'app-infra-clusters',
  standalone: true,
  imports: [RouterLink, FormsModule, KeyValuePipe, TranslateModule],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'apps.infra.title' | translate }}</h1>
          <div class="page-sub">{{ 'apps.infra.count' | translate: { shown: filtered.length, total: clusters.length } }}</div>
        </div>
        <a class="btn btn-ghost btn-sm" routerLink="/apps">{{ 'apps.infra.applications' | translate }}</a>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">⌕</span>
          <input class="search-input" type="text" [placeholder]="'apps.infra.search_placeholder' | translate"
                 [(ngModel)]="query" (ngModelChange)="applyFilter()" />
          @if (query) { <button class="search-clear" (click)="clearQuery()">✕</button> }
        </div>

        <div class="filter-chips">
          <button class="chip" [class.active]="!activeEnv" (click)="setEnv(null)">{{ 'common.all' | translate }}</button>
          @for (e of envs; track e) {
            <button class="chip" [class.active]="activeEnv === e" (click)="setEnv(e)">{{ e }}</button>
          }
        </div>
      </div>

      <div class="cluster-grid" style="margin-top:1rem">
        @for (c of filtered; track c.platformId) {
          <div class="cluster-card">
            <div class="cluster-header">
              <div class="cluster-name">{{ c.name }}</div>
              <span class="badge {{ envClass(c.environment) }}">{{ c.environment }}</span>
            </div>
            <div class="cluster-id mono">{{ c.platformId }}</div>

            <div class="cluster-body">
              <div class="cluster-row">
                <span class="cluster-key">{{ 'apps.infra.status' | translate }}</span>
                <span class="cluster-val"><span class="badge {{ statusClass(c.status) }}">{{ statusLabelKey(c.status) | translate }}</span></span>
              </div>
              @if (c.platform) {
                <div class="cluster-row">
                  <span class="cluster-key">{{ 'apps.infra.platform' | translate }}</span>
                  <span class="cluster-val">{{ c.platform }}</span>
                </div>
              }
              @if (c.platformType) {
                <div class="cluster-row">
                  <span class="cluster-key">{{ 'apps.infra.type' | translate }}</span>
                  <span class="cluster-val">{{ c.platformType }}</span>
                </div>
              }
              @if (c.clusterId) {
                <div class="cluster-row">
                  <span class="cluster-key">{{ 'apps.infra.cluster' | translate }}</span>
                  <span class="cluster-val mono">{{ c.clusterId }}</span>
                </div>
              }
              @if (c.host) {
                <div class="cluster-row">
                  <span class="cluster-key">{{ 'apps.infra.host' | translate }}</span>
                  <span class="cluster-val mono host-val">{{ c.host }}</span>
                </div>
              }
              @if (c.routeHostName) {
                <div class="cluster-row">
                  <span class="cluster-key">{{ 'apps.infra.route' | translate }}</span>
                  <span class="cluster-val mono host-val">{{ c.routeHostName }}</span>
                </div>
              }
              @if (parsedTags(c) | keyvalue; as tagEntries) {
                @if (tagEntries.length) {
                  <div class="cluster-row" style="align-items:flex-start">
                    <span class="cluster-key">{{ 'apps.infra.tags' | translate }}</span>
                    <span class="cluster-val" style="display:flex;gap:4px;flex-wrap:wrap">
                      @for (t of tagEntries; track t.key) {
                        <span class="tag-chip">{{ t.key }}: {{ t.value }}</span>
                      }
                    </span>
                  </div>
                }
              }
            </div>
          </div>
        }
        @empty {
          <div class="empty-state" style="grid-column:1/-1">
            <div class="empty-icon">◫</div>
            <div class="empty-title">{{ 'apps.infra.no_match' | translate }}</div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .search-box { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-card); min-width: 220px; }
    .search-box:focus-within { border-color: var(--blue-400); }
    .search-icon { font-size: 1rem; color: var(--text-muted); }
    .search-input { flex: 1; border: none; outline: none; background: transparent; font-size: 0.88rem; color: var(--text-strong); }
    .search-input::placeholder { color: var(--text-muted); }
    .search-clear { border: none; background: none; cursor: pointer; color: var(--text-muted); font-size: 0.75rem; padding: 0 2px; }
    .filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { padding: 3px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid var(--border); background: var(--surface-bg); color: var(--text-muted); cursor: pointer; transition: all 150ms; }
    .chip:hover { border-color: var(--blue-400); color: var(--blue-600); }
    .chip.active { background: var(--blue-600); border-color: var(--blue-600); color: #fff; }

    .cluster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
    .cluster-card { background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
    .cluster-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    .cluster-name { font-weight: 600; font-size: 0.95rem; color: var(--text-strong); }
    .cluster-id { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 12px; }
    .cluster-body { display: flex; flex-direction: column; gap: 6px; }
    .cluster-row { display: flex; gap: 8px; font-size: 0.82rem; }
    .cluster-key { width: 70px; flex-shrink: 0; color: var(--text-muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; padding-top: 1px; }
    .cluster-val { color: var(--text-strong); flex: 1; }
    .mono { font-family: var(--font-mono, monospace); }
    .host-val { font-size: 0.78rem; word-break: break-all; }
    .tag-chip { font-size: 0.72rem; background: var(--surface-bg); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; color: var(--text-muted); }
  `],
})
export class InfraClustersComponent implements OnInit {
  private appsApi = inject(AppsApi);

  clusters: InfraCluster[] = [];
  filtered: InfraCluster[] = [];
  loading = true;
  query   = '';
  envs:   string[] = [];
  activeEnv: string | null = null;

  async ngOnInit() {
    this.clusters = await firstValueFrom(this.appsApi.getAllClusters());
    this.envs = [...new Set(this.clusters.map((c) => c.environment).filter(Boolean))].sort();
    this.applyFilter();
    this.loading = false;
  }

  setEnv(e: string | null) { this.activeEnv = e; this.applyFilter(); }
  clearQuery()              { this.query = ''; this.applyFilter(); }

  applyFilter() {
    const q = this.query.toLowerCase();
    this.filtered = this.clusters.filter((c) => {
      const matchQ = !q
        || c.name.toLowerCase().includes(q)
        || c.platformId.toLowerCase().includes(q)
        || (c.host ?? '').toLowerCase().includes(q)
        || (c.platform ?? '').toLowerCase().includes(q);
      const matchE = !this.activeEnv || c.environment === this.activeEnv;
      return matchQ && matchE;
    });
  }

  envClass(e: string)   { return ENV_CLASS[e] ?? 'badge-muted'; }

  statusClass(s: InfraStatus | undefined) { return s ? (STATUS_CLASS[s] ?? 'badge-muted') : 'badge-muted'; }
  statusLabelKey(s: InfraStatus | undefined): string {
    if (!s) return 'apps.infra.status_opt.active';
    if (s === 'marked-for-decommissioning') return 'apps.infra.status_opt.decommissioning';
    return 'apps.infra.status_opt.' + s;
  }

  parsedTags(c: InfraCluster): Record<string, string> {
    try { return c.tags ? JSON.parse(c.tags) : {}; } catch { return {}; }
  }
}
