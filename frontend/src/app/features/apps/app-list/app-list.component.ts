import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AppsApi } from '../../../core/api/apps.api';
import { AuthService } from '../../../core/auth/auth.service';
import { MemberApi } from '../../../core/api/member.api';
import type { App, AppStatus } from '../../../core/models/index';

const STATUS_CLASS: Record<AppStatus, string> = {
  'active':                    'badge-success',
  'inactive':                  'badge-muted',
  'marked-for-decommissioning': 'badge-warn',
  'failed':                    'badge-danger',
};
const STATUS_LABEL: Record<AppStatus, string> = {
  'active':                    'Active',
  'inactive':                  'Inactive',
  'marked-for-decommissioning': 'Decommissioning',
  'failed':                    'Failed',
};
const ALL_STATUSES: AppStatus[] = ['active', 'inactive', 'marked-for-decommissioning', 'failed'];

type SortField = 'appId' | 'squadKey' | 'status' | 'javaVersion' | 'pillar' | 'criticality';

interface ColDef { key: string; label: string; visible: boolean; }

const DEFAULT_COLS: ColDef[] = [
  { key: 'appId',        label: 'App',         visible: true  },
  { key: 'squadKey',     label: 'Squad',        visible: true  },
  { key: 'status',       label: 'Status',       visible: true  },
  { key: 'java',         label: 'Java',         visible: true  },
  { key: 'pillar',       label: 'Pillar',       visible: true  },
  { key: 'criticality',  label: 'Criticality',  visible: true  },
  { key: 'github',       label: 'GitHub',       visible: false },
  { key: 'artifactory',  label: 'Artifactory',  visible: false },
  { key: 'splunk',       label: 'Splunk',       visible: false },
];

const PAGE_SIZES = [10, 25, 50, 100];

@Component({
  selector: 'app-app-list',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title">
          <h1>Applications</h1>
          <div class="page-sub">{{ sorted.length }} of {{ sourcePool.length }} apps</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          @if (canManage) {
            <a class="btn btn-primary btn-sm" routerLink="/apps/new">+ Register App</a>
          }
          <a class="btn btn-ghost btn-sm" routerLink="/apps/infra">Infra Clusters</a>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="search-box">
            <span class="search-icon">⌕</span>
            <input class="search-input" type="text" placeholder="Search apps, squad, tags…"
                   [(ngModel)]="query" (ngModelChange)="onQueryChange()" />
            @if (query) {
              <button class="search-clear" (click)="clearQuery()">✕</button>
            }
          </div>

          <div class="filter-chips">
            <button class="chip" [class.active]="!activeStatus" (click)="setStatus(null)">All</button>
            @for (s of statuses; track s) {
              <button class="chip" [class.active]="activeStatus === s" (click)="setStatus(s)">
                {{ statusLabel(s) }} <span class="chip-count">{{ countByStatus(s) }}</span>
              </button>
            }
          </div>
        </div>

        <div class="toolbar-right">
          <!-- Page size -->
          <label class="page-size-label">
            Show
            <select class="page-size-select" [(ngModel)]="pageSize" (ngModelChange)="onPageSizeChange()">
              @for (ps of pageSizes; track ps) { <option [value]="ps">{{ ps }}</option> }
            </select>
          </label>

          <!-- Column chooser toggle -->
          <div class="col-chooser-wrap" (click)="$event.stopPropagation()">
            <button class="btn btn-ghost btn-sm col-chooser-btn"
                    (click)="colMenuOpen = !colMenuOpen">
              ⊞ Columns
            </button>
            @if (colMenuOpen) {
              <div class="col-menu">
                <div class="col-menu-title">Visible columns</div>
                @for (col of cols; track col.key) {
                  <label class="col-row">
                    <input type="checkbox" [(ngModel)]="col.visible" />
                    <span>{{ col.label }}</span>
                  </label>
                }
              </div>
            }
          </div>

          <!-- Export dropdown -->
          <div class="col-chooser-wrap" (click)="$event.stopPropagation()">
            <button class="btn btn-ghost btn-sm" (click)="exportMenuOpen = !exportMenuOpen">
              ↓ Export
            </button>
            @if (exportMenuOpen) {
              <div class="col-menu export-menu">
                <div class="col-menu-title">Export {{ sorted.length }} apps</div>
                <button class="export-item" (click)="exportData('csv'); exportMenuOpen = false">
                  <span class="export-fmt">CSV</span> Spreadsheet
                </button>
                <button class="export-item" (click)="exportData('json'); exportMenuOpen = false">
                  <span class="export-fmt">JSON</span> Machine-readable
                </button>
                <button class="export-item" (click)="exportData('yaml'); exportMenuOpen = false">
                  <span class="export-fmt">YAML</span> Config-friendly
                </button>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Scope toggle -->
      @if (mySquadId) {
        <div class="scope-bar">
          <button class="scope-btn" [class.active]="!showAll" (click)="setScope(false)">My squad</button>
          <button class="scope-btn" [class.active]="showAll"  (click)="setScope(true)">All apps</button>
        </div>
      }

      <!-- Table -->
      <div class="card" style="margin-top:0.75rem;overflow-x:auto">
        <table class="table">
          <thead>
            <tr>
              @if (col('appId').visible) {
                <th class="sortable" (click)="sortBy('appId')">
                  App {{ sortIcon('appId') }}
                </th>
              }
              @if (col('squadKey').visible) {
                <th class="sortable" (click)="sortBy('squadKey')">
                  Squad {{ sortIcon('squadKey') }}
                </th>
              }
              @if (col('status').visible) {
                <th class="sortable" (click)="sortBy('status')">
                  Status {{ sortIcon('status') }}
                </th>
              }
              @if (col('java').visible) {
                <th class="sortable" (click)="sortBy('javaVersion')">
                  Java {{ sortIcon('javaVersion') }}
                </th>
              }
              @if (col('pillar').visible) {
                <th class="sortable" (click)="sortBy('pillar')">
                  Pillar {{ sortIcon('pillar') }}
                </th>
              }
              @if (col('criticality').visible) {
                <th class="sortable" (click)="sortBy('criticality')">
                  Criticality {{ sortIcon('criticality') }}
                </th>
              }
              @if (col('github').visible) {
                <th>GitHub</th>
              }
              @if (col('artifactory').visible) {
                <th>Artifactory</th>
              }
              @if (col('splunk').visible) {
                <th>Splunk</th>
              }
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (app of page; track app.appId) {
              <tr>
                @if (col('appId').visible) {
                  <td>
                    <div style="font-weight:600;font-family:var(--font-mono,monospace);font-size:0.85rem">{{ app.appId }}</div>
                  </td>
                }
                @if (col('squadKey').visible) {
                  <td style="color:var(--text-muted);font-size:0.875rem">{{ app.squadKey }}</td>
                }
                @if (col('status').visible) {
                  <td><span class="badge {{ statusClass(app.status) }}">{{ statusLabel(app.status) }}</span></td>
                }
                @if (col('java').visible) {
                  <td>
                    @if (app.javaVersion) {
                      <div style="white-space:nowrap">
                        <span class="java-ver">Java {{ app.javaVersion }}</span>
                        @if (app.javaComplianceStatus) {
                          <span class="badge {{ javaClass(app.javaComplianceStatus) }} badge-xs" style="margin-left:4px">{{ app.javaComplianceStatus }}</span>
                        }
                      </div>
                    } @else {
                      <span style="color:var(--text-muted);font-size:0.8rem">—</span>
                    }
                  </td>
                }
                @if (col('pillar').visible) {
                  <td style="color:var(--text-muted);font-size:0.875rem">{{ pillar(app) }}</td>
                }
                @if (col('criticality').visible) {
                  <td><span class="badge {{ critClass(app) }}">{{ crit(app) }}</span></td>
                }
                @if (col('github').visible) {
                  <td>
                    @if (app.github?.length) {
                      @for (g of app.github; track g.url; let i = $index) {
                        @if (i > 0) { <span class="text-muted">, </span> }
                        <a class="link-muted" [href]="g.url" target="_blank" rel="noopener" [title]="g.url">{{ g.description || repoShort(g.url) }}</a>
                      }
                    } @else { <span class="text-muted">—</span> }
                  </td>
                }
                @if (col('artifactory').visible) {
                  <td>
                    @if (app.artifactoryUrl) {
                      <a class="link-muted" [href]="app.artifactoryUrl" target="_blank" rel="noopener">↗</a>
                    } @else { <span class="text-muted">—</span> }
                  </td>
                }
                @if (col('splunk').visible) {
                  <td>
                    @if (app.splunkUrl) {
                      <a class="link-muted" [href]="app.splunkUrl" target="_blank" rel="noopener">↗</a>
                    } @else { <span class="text-muted">—</span> }
                  </td>
                }
                <td style="text-align:right">
                  <a class="btn btn-ghost btn-sm" [routerLink]="['/apps', app.appId]">Details</a>
                </td>
              </tr>
            }
            @empty {
              <tr>
                <td [attr.colspan]="visibleColCount + 1"
                    style="text-align:center;color:var(--text-muted);padding:2rem">
                  No apps match your filters.
                </td>
              </tr>
            }
          </tbody>
        </table>

        <!-- Pagination footer -->
        <div class="table-footer">
          <div class="pagination-info">
            @if (sorted.length > 0) {
              {{ pageStart + 1 }}–{{ pageEnd }} of {{ sorted.length }}
            }
          </div>
          <div class="pagination-controls">
            <button class="page-btn" [disabled]="currentPage === 1" (click)="goPage(currentPage - 1)">‹</button>
            @for (p of pageNumbers; track p) {
              <button class="page-btn" [class.current]="p === currentPage" (click)="goPage(p)">{{ p }}</button>
            }
            <button class="page-btn" [disabled]="currentPage === totalPages" (click)="goPage(currentPage + 1)">›</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .toolbar { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; justify-content: space-between; }
    .toolbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1; }
    .toolbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

    .search-box { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-card); min-width: 220px; }
    .search-box:focus-within { border-color: var(--blue-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .search-icon { font-size: 1rem; color: var(--text-muted); flex-shrink: 0; }
    .search-input { flex: 1; border: none; outline: none; background: transparent; font-size: 0.88rem; color: var(--text-strong); }
    .search-input::placeholder { color: var(--text-muted); }
    .search-clear { border: none; background: none; cursor: pointer; color: var(--text-muted); font-size: 0.75rem; padding: 0 2px; }

    .filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { padding: 3px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid var(--border); background: var(--surface-bg); color: var(--text-muted); cursor: pointer; transition: all 150ms; white-space: nowrap; }
    .chip:hover { border-color: var(--blue-400); color: var(--blue-600); }
    .chip.active { background: var(--blue-600); border-color: var(--blue-600); color: #fff; }
    .chip-count { opacity: 0.75; margin-left: 3px; }

    .page-size-label { font-size: 0.82rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
    .page-size-select { font-size: 0.82rem; padding: 3px 6px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-card); color: var(--text-strong); }

    /* Column chooser */
    .col-chooser-wrap { position: relative; }
    .col-menu { position: absolute; top: calc(100% + 6px); right: 0; min-width: 180px; background: var(--surface-card); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 200; padding: 10px; }
    .col-menu-title { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 8px; padding: 0 4px; }
    .col-row { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text); padding: 4px; border-radius: 4px; cursor: pointer; }
    .col-row:hover { background: var(--surface-bg); }
    .col-row input { cursor: pointer; }

    /* Scope toggle */
    .scope-bar { display: flex; gap: 0; margin-top: 10px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; width: fit-content; }
    .scope-btn { padding: 5px 16px; font-size: 0.82rem; font-weight: 600; border: none; background: transparent; color: var(--text-muted); cursor: pointer; transition: all 120ms; }
    .scope-btn.active { background: var(--blue-600); color: #fff; }
    .scope-btn:hover:not(.active) { background: var(--surface-bg); }

    /* Sortable */
    .sortable { cursor: pointer; user-select: none; white-space: nowrap; }
    .sortable:hover { color: var(--blue-600); }

    .java-ver { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); }
    .badge-xs { font-size: 0.68rem; padding: 1px 6px; }
    .link-muted { font-size: 0.8rem; color: var(--blue-600); text-decoration: none; }
    .link-muted:hover { text-decoration: underline; }
    .text-muted { color: var(--text-muted); font-size: 0.8rem; }

    /* Export menu */
    .export-menu { min-width: 200px; }
    .export-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 7px 8px; background: none; border: none; border-radius: 6px; font-size: 0.85rem; color: var(--text); cursor: pointer; text-align: left; }
    .export-item:hover { background: var(--surface-bg); }
    .export-fmt { font-family: var(--font-mono, monospace); font-size: 0.75rem; font-weight: 700; background: var(--blue-50); color: var(--blue-700); border: 1px solid var(--blue-100); border-radius: 4px; padding: 1px 6px; min-width: 40px; text-align: center; }

    /* Pagination */
    .table-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid var(--border); flex-wrap: wrap; gap: 8px; }
    .pagination-info { font-size: 0.82rem; color: var(--text-muted); }
    .pagination-controls { display: flex; gap: 4px; align-items: center; }
    .page-btn { padding: 3px 9px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface-card); color: var(--text); font-size: 0.82rem; cursor: pointer; transition: all 120ms; min-width: 32px; }
    .page-btn:hover:not([disabled]):not(.current) { border-color: var(--blue-400); color: var(--blue-600); }
    .page-btn.current { background: var(--blue-600); color: #fff; border-color: var(--blue-600); font-weight: 600; }
    .page-btn[disabled] { opacity: 0.35; cursor: default; }
  `],
})
export class AppListComponent implements OnInit {
  private appsApi   = inject(AppsApi);
  private auth      = inject(AuthService);
  private memberApi = inject(MemberApi);
  private route     = inject(ActivatedRoute);

  myApps:   App[] = [];
  allApps:  App[] = [];
  loading   = true;
  loadingAll = false;
  showAll   = false;
  mySquadId: string | null = null;

  query = '';
  activeStatus: AppStatus | null = null;
  readonly statuses = ALL_STATUSES;

  sortField: SortField = 'appId';
  sortDir: 'asc' | 'desc' = 'asc';

  currentPage = 1;
  pageSize    = 25;
  readonly pageSizes = PAGE_SIZES;

  cols: ColDef[] = DEFAULT_COLS.map((c) => ({ ...c }));
  colMenuOpen  = false;
  exportMenuOpen = false;

  get canManage() {
    const r = this.auth.currentUser()?.role;
    return r === 'Admin' || r === 'AgileCoach' || r === 'TribeLead';
  }

  get sourcePool(): App[] { return this.showAll ? this.allApps : this.myApps; }

  get filtered(): App[] {
    const q = this.query.toLowerCase();
    return this.sourcePool.filter((a) => {
      const t = this.parseTags(a);
      const matchQ = !q || a.appId.toLowerCase().includes(q)
        || a.squadKey.toLowerCase().includes(q)
        || (t['pillar'] ?? '').toLowerCase().includes(q)
        || (t['criticality'] ?? '').toLowerCase().includes(q)
        || (a.javaVersion ?? '').toLowerCase().includes(q);
      const matchS = !this.activeStatus || a.status === this.activeStatus;
      return matchQ && matchS;
    });
  }

  get sorted(): App[] {
    const f = this.sortField;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...this.filtered].sort((a, b) => {
      const av = this.sortVal(a, f);
      const bv = this.sortVal(b, f);
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }

  private sortVal(app: App, field: SortField): string {
    const t = this.parseTags(app);
    switch (field) {
      case 'appId':      return app.appId ?? '';
      case 'squadKey':   return app.squadKey ?? '';
      case 'status':     return app.status ?? '';
      case 'javaVersion': return app.javaVersion ?? '';
      case 'pillar':     return t['pillar'] ?? '';
      case 'criticality': return t['criticality'] ?? '';
      default: return '';
    }
  }

  get totalPages(): number { return Math.max(1, Math.ceil(this.sorted.length / this.pageSize)); }
  get pageStart():  number { return (this.currentPage - 1) * this.pageSize; }
  get pageEnd():    number { return Math.min(this.pageStart + this.pageSize, this.sorted.length); }
  get page():       App[]  { return this.sorted.slice(this.pageStart, this.pageEnd); }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const cur   = this.currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: number[] = [1];
    if (cur > 3) pages.push(-1);
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
    if (cur < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }

  get visibleColCount(): number { return this.cols.filter((c) => c.visible).length; }

  col(key: string): ColDef { return this.cols.find((c) => c.key === key)!; }

  async ngOnInit() {
    const user = this.auth.currentUser();
    const wideRole = user?.role === 'Admin' || user?.role === 'AgileCoach' || user?.role === 'TribeLead';

    if (!wideRole && user?.memberId) {
      try {
        const member = await firstValueFrom(this.memberApi.getById(user.memberId));
        this.mySquadId = member.squadId || null;
      } catch { /* ignore */ }
    }

    if (wideRole || !this.mySquadId) {
      this.showAll = true;
      this.allApps = await firstValueFrom(this.appsApi.getAll());
    } else {
      this.myApps = await firstValueFrom(this.appsApi.getBySquad(this.mySquadId));
    }

    this.loading = false;

    const squadParam = this.route.snapshot.queryParamMap.get('squad');
    if (squadParam) {
      this.query = squadParam;
      if (!this.showAll && this.allApps.length === 0) {
        this.loadingAll = true;
        this.allApps = await firstValueFrom(this.appsApi.getAll());
        this.loadingAll = false;
      }
      this.showAll = true;
    }
  }

  async setScope(all: boolean) {
    if (all && !this.allApps.length) {
      this.loadingAll = true;
      this.allApps = await firstValueFrom(this.appsApi.getAll());
      this.loadingAll = false;
    }
    this.showAll = all;
    this.currentPage = 1;
  }

  setStatus(s: AppStatus | null) { this.activeStatus = s; this.currentPage = 1; }
  onQueryChange()  { this.currentPage = 1; }
  clearQuery()     { this.query = ''; this.currentPage = 1; }
  onPageSizeChange() { this.currentPage = 1; }

  goPage(p: number) {
    if (p < 1 || p > this.totalPages) return;
    this.currentPage = p;
  }

  sortBy(field: SortField) {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir   = 'asc';
    }
    this.currentPage = 1;
  }

  sortIcon(field: SortField): string {
    if (this.sortField !== field) return '⇅';
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  countByStatus(s: AppStatus) { return this.sourcePool.filter((a) => a.status === s).length; }
  statusClass(s: AppStatus)   { return STATUS_CLASS[s] ?? ''; }
  statusLabel(s: AppStatus)   { return STATUS_LABEL[s] ?? s; }
  repoShort(url: string)      { return url.replace(/https?:\/\/(www\.)?github\.com\//, ''); }

  private parseTags(app: App): Record<string, string> {
    try { return typeof app.tags === 'string' ? JSON.parse(app.tags) : (app.tags as any) ?? {}; } catch { return {}; }
  }
  pillar(app: App)    { return this.parseTags(app)['pillar']      ?? '—'; }
  crit(app: App)      { return this.parseTags(app)['criticality'] ?? '—'; }
  critClass(app: App) {
    const c = this.parseTags(app)['criticality'];
    if (c === 'critical') return 'badge-danger';
    if (c === 'high')     return 'badge-story';
    if (c === 'medium')   return 'badge-warn';
    return 'badge-muted';
  }
  javaClass(s: string) {
    return s === 'compliant' ? 'badge-success' : s === 'exempt' ? 'badge-muted' : 'badge-danger';
  }

  exportData(format: 'csv' | 'json' | 'yaml') {
    const rows = this.sorted.map((a) => {
      const t = this.parseTags(a);
      return {
        appId:               a.appId ?? '',
        squadKey:            a.squadKey ?? '',
        status:              a.status ?? '',
        javaVersion:         a.javaVersion ?? '',
        javaComplianceStatus: a.javaComplianceStatus ?? '',
        pillar:              t['pillar'] ?? '',
        criticality:         t['criticality'] ?? '',
        github:              (a.github ?? []).map((l) => l.url).join('; '),
        artifactoryUrl:      a.artifactoryUrl ?? '',
        splunkUrl:           a.splunkUrl ?? '',
      };
    });

    let content: string;
    let mime: string;
    let ext: string;

    if (format === 'csv') {
      const headers = ['appId', 'squadKey', 'status', 'javaVersion', 'javaComplianceStatus', 'pillar', 'criticality', 'github', 'artifactoryUrl', 'splunkUrl'];
      const escape  = (v: string) => `"${v.replace(/"/g, '""')}"`;
      content = [headers.join(','), ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(','))].join('\r\n');
      mime = 'text/csv';
      ext  = 'csv';
    } else if (format === 'json') {
      content = JSON.stringify(rows, null, 2);
      mime = 'application/json';
      ext  = 'json';
    } else {
      content = rows.map((r) =>
        '- ' + Object.entries(r)
          .map(([k, v], i) => (i === 0 ? `${k}: ${this.yamlStr(v)}` : `  ${k}: ${this.yamlStr(v)}`))
          .join('\n')
      ).join('\n');
      mime = 'text/yaml';
      ext  = 'yaml';
    }

    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `apps-export.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private yamlStr(v: string): string {
    if (!v) return "''";
    if (/[:#\[\]{}&*!|>'"%@`,]/.test(v) || v.includes('\n')) return `'${v.replace(/'/g, "''")}'`;
    return v;
  }
}
