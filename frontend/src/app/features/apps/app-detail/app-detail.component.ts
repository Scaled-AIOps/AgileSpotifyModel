/**
 * Purpose: Application detail + inline edit page.
 * Usage:   Routed at /apps/:appId. Read view shows status, tags, links (Link[]), tools row, deployment timeline, audit log; edit mode shows the same fields as forms / repeaters.
 * Goal:    One screen to view, mutate, and audit a single application.
 * ToDo:    Add inline edit for the four Link[] sections shown in read mode (currently edit panel is below).
 */
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AppsApi } from '../../../core/api/apps.api';
import { LinkListComponent } from '../../../shared/link-list/link-list.component';
import { LinkRepeaterComponent } from '../../../shared/link-repeater/link-repeater.component';
import { AppChartComponent } from '../app-chart/app-chart.component';
import type { AppWithDeploys, AppDeployment, AppStatus, DeployState, AuditEntry, Link } from '../../../core/models/index';

const STATUS_CLASS: Record<AppStatus, string> = {
  'active':                    'badge-success',
  'inactive':                  'badge-muted',
  'marked-for-decommissioning': 'badge-warn',
  'failed':                    'badge-danger',
};

const DEPLOY_CLASS: Record<DeployState, string> = {
  success:    'badge-success',
  failed:     'badge-danger',
  pending:    'badge-warn',
  rolledback: 'badge-epic',
};

const ENVS = ['local', 'dev', 'int', 'uat', 'prd'] as const;

@Component({
  selector: 'app-app-detail',
  standalone: true,
  imports: [RouterLink, FormsModule, LinkListComponent, LinkRepeaterComponent, AppChartComponent],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else if (loadError) {
      <div class="empty-state">
        <div class="empty-icon">⚠</div>
        <div class="empty-title">{{ loadError }}</div>
        <div class="empty-sub"><a routerLink="/apps">← Back to Applications</a></div>
      </div>
    }
    @else if (app) {
      <div class="page-header">
        <div class="page-title">
          <h1 style="font-family:var(--font-mono,monospace)">{{ app.appId }}</h1>
          <div class="page-sub breadcrumb">
            <a class="crumb crumb-link" [routerLink]="['/org/squads', app.squadId]">{{ app.squadKey }}</a>
            <span class="crumb-sep">›</span>
            <span class="crumb">{{ statusLabel(app.status) }}</span>
          </div>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <span class="badge {{ statusClass(app.status) }}">{{ statusLabel(app.status) }}</span>
          @if (app.editable && !editMode) {
            <button class="btn btn-ghost btn-sm" (click)="enterEdit()">Edit</button>
          }
          @if (editMode) {
            <button class="btn btn-primary btn-sm" [disabled]="saving" (click)="save()">
              @if (saving) { <span class="spinner"></span> } Save
            </button>
            <button class="btn btn-ghost btn-sm" [disabled]="saving" (click)="cancelEdit()">Cancel</button>
          }
        </div>
      </div>

      @if (saveError) {
        <div class="alert-error">{{ saveError }}</div>
      }

      <!-- View mode: meta cards -->
      @if (!editMode) {
        <div class="meta-row">
          @if (tags['criticality']) {
            <div class="meta-card">
              <div class="meta-label">Criticality</div>
              <div class="meta-value"><span class="badge {{ critClass }}">{{ tags['criticality'] }}</span></div>
            </div>
          }
          @if (tags['pillar']) {
            <div class="meta-card">
              <div class="meta-label">Pillar</div>
              <div class="meta-value">{{ tags['pillar'] }}</div>
            </div>
          }
          @if (app.javaVersion) {
            <div class="meta-card">
              <div class="meta-label">Java</div>
              <div class="meta-value">
                Java {{ app.javaVersion }}
                @if (app.javaComplianceStatus) {
                  <span class="badge {{ javaClass(app.javaComplianceStatus) }}" style="margin-left:6px;font-size:0.7rem">{{ app.javaComplianceStatus }}</span>
                }
              </div>
            </div>
          }
          @if (tags['sunset']) {
            <div class="meta-card">
              <div class="meta-label">Sunset</div>
              <div class="meta-value" style="color:var(--warn,#b45309)">{{ tags['sunset'] }}</div>
            </div>
          }
          @if (app.probeHealth) {
            <div class="meta-card">
              <div class="meta-label">Health probe</div>
              <div class="meta-value mono">{{ app.probeHealth }}</div>
            </div>
          }
        </div>

        <!-- Tools & Links -->
        @if (hasTools) {
          <div class="tools-row">
            @if (app.artifactoryUrl) {
              <a class="tool-btn" [href]="app.artifactoryUrl" target="_blank" rel="noopener">
                <span class="tool-icon">📦</span> Artifactory
              </a>
            }
            @if (app.xrayUrl) {
              <a class="tool-btn" [href]="app.xrayUrl" target="_blank" rel="noopener">
                <span class="tool-icon">🔍</span> X-Ray
              </a>
            }
            @if (app.compositionViewerUrl) {
              <a class="tool-btn" [href]="app.compositionViewerUrl" target="_blank" rel="noopener">
                <span class="tool-icon">⛓</span> Composition
              </a>
            }
            @if (app.splunkUrl) {
              <a class="tool-btn" [href]="app.splunkUrl" target="_blank" rel="noopener">
                <span class="tool-icon">📋</span> Splunk Logs
              </a>
            }
          </div>
        }

        @if (hasLinks) {
          <div class="link-grid">
            <app-link-list label="Jira"        [links]="app.jira"></app-link-list>
            <app-link-list label="Confluence"  [links]="app.confluence"></app-link-list>
            <app-link-list label="GitHub"      [links]="app.github"></app-link-list>
            <app-link-list label="Mailing list" [links]="app.mailingList"></app-link-list>
            <app-link-list label="Links"       [links]="app.links"></app-link-list>
          </div>
        }
      }

      <!-- Edit mode: inline form -->
      @if (editMode) {
        <div class="edit-form card">
          <div class="edit-section-title">Application Info</div>
          <div class="edit-grid">
            <label class="edit-field">
              <span>Status</span>
              <select class="value-input" [(ngModel)]="ef.status">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="marked-for-decommissioning">Decommissioning</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <label class="edit-field" style="grid-column:1 / -1">
              <span>Description</span>
              <textarea class="value-input" rows="2" [(ngModel)]="ef.description" placeholder="Short description of what this app does"></textarea>
            </label>
          </div>

          <div class="edit-section-title" style="margin-top:1rem">Tags</div>
          <div class="edit-grid">
            <label class="edit-field">
              <span>Criticality</span>
              <select class="value-input" [(ngModel)]="ef.criticality">
                <option value="">—</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label class="edit-field">
              <span>Pillar</span>
              <input class="value-input" type="text" [(ngModel)]="ef.pillar" placeholder="e.g. platform" />
            </label>
            <label class="edit-field">
              <span>Sunset</span>
              <input class="value-input" type="text" [(ngModel)]="ef.sunset" placeholder="e.g. 2026-Q3" />
            </label>
          </div>

          <div class="edit-section-title" style="margin-top:1rem">Java</div>
          <div class="edit-grid">
            <label class="edit-field">
              <span>Java Version</span>
              <input class="value-input" type="text" [(ngModel)]="ef.javaVersion" placeholder="e.g. 17" />
            </label>
            <label class="edit-field">
              <span>Compliance</span>
              <select class="value-input" [(ngModel)]="ef.javaComplianceStatus">
                <option value="">—</option>
                <option value="compliant">Compliant</option>
                <option value="non-compliant">Non-compliant</option>
                <option value="exempt">Exempt</option>
              </select>
            </label>
          </div>

          <div class="edit-section-title" style="margin-top:1rem">Tool Links</div>
          <div class="edit-grid">
            <label class="edit-field">
              <span>Artifactory URL</span>
              <input class="value-input" type="url" [(ngModel)]="ef.artifactoryUrl" placeholder="https://…" />
            </label>
            <label class="edit-field">
              <span>X-Ray URL</span>
              <input class="value-input" type="url" [(ngModel)]="ef.xrayUrl" placeholder="https://…" />
            </label>
            <label class="edit-field">
              <span>Composition Viewer URL</span>
              <input class="value-input" type="url" [(ngModel)]="ef.compositionViewerUrl" placeholder="https://…" />
            </label>
            <label class="edit-field">
              <span>Splunk Logs URL</span>
              <input class="value-input" type="url" [(ngModel)]="ef.splunkUrl" placeholder="https://…" />
            </label>
          </div>

          <div class="edit-section-title" style="margin-top:1rem">Documentation & Repos</div>
          <div class="repeater-stack">
            <app-link-repeater label="Jira"        urlPlaceholder="https://jira.example.com/projects/…"
              [links]="ef.jira"        (linksChange)="ef.jira = $event"></app-link-repeater>
            <app-link-repeater label="Confluence"  urlPlaceholder="https://confluence.example.com/display/…"
              [links]="ef.confluence"  (linksChange)="ef.confluence = $event"></app-link-repeater>
            <app-link-repeater label="GitHub"      urlPlaceholder="https://github.com/org/repo"
              [links]="ef.github"      (linksChange)="ef.github = $event"></app-link-repeater>
            <app-link-repeater label="Mailing list" urlPlaceholder="team@example.com"
              [links]="ef.mailingList" (linksChange)="ef.mailingList = $event"></app-link-repeater>
            <app-link-repeater label="Links" urlPlaceholder="https://confluence.example.com/page"
              [links]="ef.links" (linksChange)="ef.links = $event"></app-link-repeater>
          </div>
        </div>
      }

      <!-- Platform deployments across envs (per cloud) -->
      @for (cloud of clouds; track cloud.key) {
        @if (cloudHasAny(cloud.key)) {
          <div class="cloud-header">
            <h3 style="margin-top:1.5rem">{{ cloud.label }} Deployments</h3>
            @if (chartFor(cloud.key); as ch) {
              <span class="chart-chip mono">chart: {{ ch }}</span>
            }
            @if (buildChartFor(cloud.key); as bc) {
              <span class="chart-chip mono">build: {{ bc }}</span>
            }
          </div>
          <div class="env-grid">
            @for (env of envs; track env) {
              @if (hasPlatform(cloud.key, env) || (cloud.key === 'ocp' && getLatest(env))) {
                <div class="env-card" [class.has-deploy]="cloud.key === 'ocp' && !!getLatest(env)">
                  <div class="env-tag">{{ env }}</div>
                  @if (getPlatform(cloud.key, env); as p) {
                    <div class="env-platform mono">{{ p }}</div>
                  }
                  @if (getUrl(cloud.key, env); as u) {
                    <a class="env-url mono" [href]="u" target="_blank" rel="noopener">{{ u }}</a>
                  }
                  @if (cloud.key === 'ocp' && getLatest(env); as d) {
                    <div class="deploy-block">
                      <div class="deploy-row">
                        <span class="badge {{ deployClass(d.state) }}">{{ d.state }}</span>
                        <span class="deploy-version">v{{ d.version }}</span>
                      </div>
                      <div class="deploy-meta">{{ d.deployedBy }} · {{ fmtDate(d.deployedAt) }}</div>
                      @if (d.notes) { <div class="deploy-notes">{{ d.notes }}</div> }
                      @if (d.changeRequest) { <div class="deploy-meta">CR: {{ d.changeRequest }}</div> }
                      @if (d.javaVersion) {
                        <div class="deploy-meta">
                          Java {{ d.javaVersion }}
                          @if (d.javaComplianceStatus) {
                            · <span class="badge {{ javaClass(d.javaComplianceStatus) }}">{{ d.javaComplianceStatus }}</span>
                          }
                        </div>
                      }
                      @if (d.xray) {
                        <a class="btn btn-ghost btn-sm" style="margin-top:6px" [href]="d.xray" target="_blank" rel="noopener">X-Ray ↗</a>
                      }
                    </div>
                  } @else if (cloud.key === 'ocp') {
                    <div class="deploy-empty">Not deployed</div>
                  }
                </div>
              }
            }
          </div>
        }
      }

      <!-- Deployment topology chart (collapsible D3 tree) -->
      <div class="chart-header">
        <h3 style="margin-top:1.5rem;margin-bottom:0">Deployment Chart</h3>
        <button class="btn btn-ghost btn-sm" (click)="showChart = !showChart">
          {{ showChart ? 'Hide' : 'Show' }}
        </button>
      </div>
      @if (showChart) {
        <div class="card chart-card">
          <app-app-chart
            [appId]="app.appId"
            [ocp]="app.ocp"
            [gcp]="app.gcp"
            [history]="history">
          </app-app-chart>
        </div>
      }

      <!-- Full deploy history per env -->
      @for (env of envs; track env) {
        @if (history[env].length > 1) {
          <h3 style="margin-top:1.5rem">{{ env.toUpperCase() }} History</h3>
          <div class="card">
            <table class="table">
              <thead><tr><th>Version</th><th>State</th><th>Branch</th><th>Deployed by</th><th>Date</th><th>CR</th><th>Notes</th></tr></thead>
              <tbody>
                @for (d of history[env]; track d.deployedAt + ':' + d.version + ':' + $index) {
                  <tr>
                    <td class="mono">{{ d.version }}</td>
                    <td><span class="badge {{ deployClass(d.state) }}">{{ d.state }}</span></td>
                    <td class="mono" style="font-size:0.8rem;color:var(--text-muted)">{{ d.branch }}</td>
                    <td style="color:var(--text-muted);font-size:0.875rem">{{ d.deployedBy }}</td>
                    <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">{{ fmtDate(d.deployedAt) }}</td>
                    <td style="font-size:0.8rem">
                      @if (d.changeRequest) {
                        <span class="badge badge-epic" style="font-family:var(--font-mono,monospace);font-size:0.72rem">{{ d.changeRequest }}</span>
                      }
                    </td>
                    <td style="color:var(--text-muted);font-size:0.8rem">{{ d.notes }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- Audit log -->
      @if (auditLog.length) {
        <h3 style="margin-top:1.5rem">Change Log</h3>
        <div class="card">
          <table class="table">
            <thead><tr><th>When</th><th>Who</th><th>Field</th><th>From</th><th>To</th></tr></thead>
            <tbody>
              @for (entry of auditLog; track entry.id) {
                @for (change of changesOf(entry); track change.field; let first = $first) {
                  <tr [class.audit-group-first]="first">
                    <td style="white-space:nowrap;color:var(--text-muted);font-size:0.8rem">
                      @if (first) { {{ fmtDate(entry.changedAt) }} }
                    </td>
                    <td style="font-size:0.82rem;color:var(--text-muted)">
                      @if (first) { {{ entry.userEmail }} }
                    </td>
                    <td class="mono" style="font-size:0.8rem">{{ change.field }}</td>
                    <td style="font-size:0.8rem;color:var(--text-muted);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ change.from || '—' }}</td>
                    <td style="font-size:0.8rem;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ change.to || '—' }}</td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
  styles: [`
    .breadcrumb { display: flex; align-items: center; gap: 4px; }
    .crumb { font-size: 0.82rem; color: var(--text-muted); }
    .crumb-link { color: var(--blue-600); text-decoration: none; }
    .crumb-link:hover { text-decoration: underline; }
    .crumb-sep { color: var(--border); }

    .alert-error { margin: 0.5rem 0; padding: 0.6rem 0.9rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #991b1b; font-size: 0.85rem; }

    .meta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 0.5rem; }
    .meta-card { background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 16px; }
    .meta-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 4px; }
    .meta-value { font-size: 0.9rem; font-weight: 600; color: var(--text-strong); }
    .mono { font-family: var(--font-mono, monospace); font-size: 0.82rem; }

    .tools-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 1rem; }
    .tool-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 14px; border-radius: 6px; font-size: 0.82rem; font-weight: 600;
      background: var(--surface-card); border: 1px solid var(--border);
      color: var(--blue-700); text-decoration: none;
      transition: border-color 120ms, background 120ms;
    }
    .tool-btn:hover { border-color: var(--blue-400); background: var(--blue-50); text-decoration: none; }
    .tool-icon { font-style: normal; }

    .edit-form { margin-top: 0.75rem; padding: 1.25rem 1.5rem; }
    .edit-section-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 0.6rem; }
    .repeater-stack { display: flex; flex-direction: column; gap: 14px; }
    .link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 1.25rem; padding: 14px 16px; background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); }
    .edit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
    .edit-field { display: flex; flex-direction: column; gap: 4px; span { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); } }

    .cloud-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .chart-header { display: flex; align-items: center; gap: 12px; }
    .chart-card { padding: 12px 16px; margin-top: 0.75rem; }
    .chart-chip { font-size: 0.7rem; padding: 2px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text-muted); background: var(--surface-card); }
    .env-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 0.75rem; }
    .env-card { background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
    .env-card.has-deploy { border-color: var(--blue-300); }
    .env-tag { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 4px; }
    .env-platform { font-size: 0.78rem; color: var(--text-muted); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .env-url { display: block; font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 8px; max-width: 100%; }
    .env-url:hover { text-decoration: underline; }
    .deploy-block { margin-top: 6px; }
    .deploy-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .deploy-version { font-family: var(--font-mono,monospace); font-size: 0.82rem; font-weight: 600; color: var(--text-strong); }
    .deploy-meta { font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; }
    .deploy-notes { font-size: 0.75rem; color: var(--text-muted); font-style: italic; margin-top: 2px; }
    .deploy-empty { font-size: 0.82rem; color: var(--text-muted); margin-top: 6px; }

    .audit-group-first td { border-top: 1px solid var(--border); }
    tr:first-child.audit-group-first td { border-top: none; }
  `],
})
export class AppDetailComponent implements OnInit {
  private route   = inject(ActivatedRoute);
  private appsApi = inject(AppsApi);

  app:      AppWithDeploys | null = null;
  history:  Record<string, AppDeployment[]> = Object.fromEntries(ENVS.map((e) => [e, []]));
  showChart = true;
  auditLog: AuditEntry[] = [];
  loading   = true;
  editMode  = false;
  saving    = false;
  saveError = '';
  loadError = '';
  readonly envs = ENVS;

  ef = {
    status: '' as AppStatus,
    description: '',
    criticality: '',
    pillar: '',
    sunset: '',
    javaVersion: '',
    javaComplianceStatus: '',
    artifactoryUrl: '',
    xrayUrl: '',
    compositionViewerUrl: '',
    splunkUrl: '',
    jira:        [] as Link[],
    confluence:  [] as Link[],
    github:      [] as Link[],
    mailingList: [] as Link[],
    links:       [] as Link[],
  };

  get hasTools() {
    return !!(this.app?.artifactoryUrl || this.app?.xrayUrl || this.app?.compositionViewerUrl || this.app?.splunkUrl);
  }

  get hasLinks(): boolean {
    const a = this.app;
    if (!a) return false;
    return (a.jira?.length ?? 0) + (a.confluence?.length ?? 0) +
           (a.github?.length ?? 0) + (a.mailingList?.length ?? 0) +
           (a.links?.length ?? 0) > 0;
  }

  get tags(): Record<string, string> {
    if (!this.app) return {};
    try { return typeof this.app.tags === 'string' ? JSON.parse(this.app.tags) : (this.app.tags as any) ?? {}; } catch { return {}; }
  }

  get platforms(): Record<string, string> {
    if (!this.app) return {};
    try { return typeof this.app.platforms === 'string' ? JSON.parse(this.app.platforms) : (this.app.platforms as any) ?? {}; } catch { return {}; }
  }

  get urls(): Record<string, string> {
    if (!this.app) return {};
    try { return typeof this.app.urls === 'string' ? JSON.parse(this.app.urls) : (this.app.urls as any) ?? {}; } catch { return {}; }
  }

  async ngOnInit() {
    const appId = this.route.snapshot.paramMap.get('appId')!;
    try {
      this.app = await firstValueFrom(this.appsApi.getById(appId));
    } catch {
      this.loadError = `Application "${appId}" not found.`;
      this.loading = false;
      return;
    }

    const envsWithDeploys = ENVS.filter((env) => this.app?.latestDeploys?.[env]);
    await Promise.all(envsWithDeploys.map(async (env) => {
      this.history[env] = await firstValueFrom(this.appsApi.getDeployHistory(appId, env));
    }));

    this.auditLog = await firstValueFrom(this.appsApi.getAuditLog(appId));
    this.loading = false;
  }

  enterEdit() {
    const t = this.tags;
    this.ef = {
      status:               this.app!.status,
      description:          this.app!.description ?? '',
      criticality:          t['criticality'] ?? '',
      pillar:               t['pillar'] ?? '',
      sunset:               t['sunset'] ?? '',
      javaVersion:          this.app!.javaVersion ?? '',
      javaComplianceStatus: this.app!.javaComplianceStatus ?? '',
      artifactoryUrl:       this.app!.artifactoryUrl ?? '',
      xrayUrl:              this.app!.xrayUrl ?? '',
      compositionViewerUrl: this.app!.compositionViewerUrl ?? '',
      splunkUrl:            this.app!.splunkUrl ?? '',
      jira:        [...(this.app!.jira ?? [])],
      confluence:  [...(this.app!.confluence ?? [])],
      github:      [...(this.app!.github ?? [])],
      mailingList: [...(this.app!.mailingList ?? [])],
      links:       [...(this.app!.links ?? [])],
    };
    this.saveError = '';
    this.editMode = true;
  }

  cancelEdit() {
    this.editMode = false;
    this.saveError = '';
  }

  async save() {
    this.saving = true;
    this.saveError = '';
    try {
      const existingTags = { ...this.tags };
      if (this.ef.criticality) existingTags['criticality'] = this.ef.criticality; else delete existingTags['criticality'];
      if (this.ef.pillar)      existingTags['pillar']      = this.ef.pillar;      else delete existingTags['pillar'];
      if (this.ef.sunset)      existingTags['sunset']      = this.ef.sunset;      else delete existingTags['sunset'];

      const patch: Record<string, unknown> = {
        status:               this.ef.status,
        description:          this.ef.description,
        javaVersion:          this.ef.javaVersion,
        javaComplianceStatus: this.ef.javaComplianceStatus,
        artifactoryUrl:       this.ef.artifactoryUrl,
        xrayUrl:              this.ef.xrayUrl,
        compositionViewerUrl: this.ef.compositionViewerUrl,
        splunkUrl:            this.ef.splunkUrl,
        tags:                 existingTags,
        jira:                 this.ef.jira,
        confluence:           this.ef.confluence,
        github:               this.ef.github,
        mailingList:          this.ef.mailingList,
        links:                this.ef.links,
      };

      const updated = await firstValueFrom(this.appsApi.updateApp(this.app!.appId, patch));
      this.app = { ...this.app!, ...updated };
      this.auditLog = await firstValueFrom(this.appsApi.getAuditLog(this.app!.appId));
      this.editMode = false;
    } catch (err: any) {
      const apiErr  = err?.error?.error ?? '';
      const details = err?.error?.details;
      const detail  = details && typeof details === 'object'
        ? Object.entries(details).map(([k, v]) => `${k}: ${(v as string[])?.join('; ') ?? v}`).join(' • ')
        : '';
      this.saveError = [apiErr, detail].filter(Boolean).join(' — ') || 'Save failed. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  readonly clouds: { key: 'ocp' | 'gcp'; label: string }[] = [
    { key: 'ocp', label: 'OCP' },
    { key: 'gcp', label: 'GCP' },
  ];

  cloudHasAny(cloud: 'ocp' | 'gcp'): boolean {
    const block = this.app?.[cloud];
    if (!block) return false;
    for (const env of ENVS) {
      if (this.hasPlatform(cloud, env)) return true;
    }
    return !!(block.buildChart || block.chart);
  }

  hasPlatform(cloud: 'ocp' | 'gcp', env: string): boolean {
    return !!(this.getPlatform(cloud, env) || this.getUrl(cloud, env));
  }

  getPlatform(cloud: 'ocp' | 'gcp', env: string): string {
    const block = this.app?.[cloud] ?? {};
    return (block as any)[`${env}Platform`] ?? this.platforms[`${env}Platform`] ?? '';
  }

  getUrl(cloud: 'ocp' | 'gcp', env: string): string {
    const block = this.app?.[cloud] ?? {};
    return (block as any)[`${env}Url`] ?? this.urls[`${env}Url`] ?? '';
  }

  chartFor(cloud: 'ocp' | 'gcp'): string { return this.app?.[cloud]?.chart ?? ''; }
  buildChartFor(cloud: 'ocp' | 'gcp'): string { return this.app?.[cloud]?.buildChart ?? ''; }

  getLatest(env: string): AppDeployment | null { return this.app?.latestDeploys?.[env] ?? null; }

  changesOf(entry: AuditEntry): { field: string; from: string; to: string }[] {
    return Object.entries(entry.changes).map(([field, v]) => ({ field, from: v.from, to: v.to }));
  }

  statusClass(s: AppStatus)  { return STATUS_CLASS[s] ?? ''; }
  statusLabel(s: AppStatus) {
    const m: Record<AppStatus, string> = { active: 'Active', inactive: 'Inactive', 'marked-for-decommissioning': 'Decommissioning', failed: 'Failed' };
    return m[s] ?? s;
  }

  deployClass(s: DeployState) { return DEPLOY_CLASS[s] ?? ''; }

  get critClass() {
    const c = this.tags['criticality'];
    if (c === 'critical') return 'badge-danger';
    if (c === 'high')     return 'badge-story';
    if (c === 'medium')   return 'badge-warn';
    return 'badge-muted';
  }

  javaClass(s: string) {
    return s === 'compliant' ? 'badge-success' : s === 'exempt' ? 'badge-muted' : 'badge-danger';
  }

  fmtDate(iso: string) {
    try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return iso; }
  }
}
