/**
 * Purpose: Role-aware home page.
 * Usage:   Routed at /dashboard. Renders fleet / tribe / squad health depending on the current user's role; offers a global search and quick links.
 * Goal:    First page after login, surfacing the most useful info for each role.
 * ToDo:    —
 */
import { Component, OnInit, inject, HostListener } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/auth/auth.service';
import { MemberApi } from '../../core/api/member.api';
import { SquadApi } from '../../core/api/squad.api';
import { TribeApi } from '../../core/api/tribe.api';
import { OrgApi, HeadcountEntry } from '../../core/api/org.api';
import { AppsApi } from '../../core/api/apps.api';
import type { Member, Squad, Tribe, Role, App } from '../../core/models/index';

interface TribeSquadRow { squad: Squad; memberCount: number; apps: App[]; }
interface SearchResult { id: string; type: 'app' | 'member'; primary: string; secondary: string; route: any[]; }
interface AppHealth { active: number; inactive: number; failed: number; decom: number; total: number; javaOk: number; javaFail: number; xrayOk: number; xrayFail: number; }

const ROLE_LABEL: Record<Role, string> = {
  Admin: 'Admin', TribeLead: 'Tribe Lead', PO: 'Product Owner',
  AgileCoach: 'Agile Coach', ReleaseManager: 'Release Manager', Member: 'Member',
};
const ROLE_CLASS: Record<Role, string> = {
  Admin: 'badge-danger', TribeLead: 'badge-story', PO: 'badge-warn',
  AgileCoach: 'badge-success', ReleaseManager: 'badge-epic', Member: 'badge-muted',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslateModule],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <!-- Greeting header -->
      <div class="greeting">
        <div class="greeting-left">
          <div class="greeting-avatar">{{ initials }}</div>
          <div>
            <h1 class="greeting-name">{{ 'dashboard.welcome' | translate: { name: (member?.name ?? user?.email) } }}</h1>
            <div class="greeting-meta">
              <span class="badge" [class]="roleClass">{{ roleLabel }}</span>
              @if (member?.squadId && squad) {
                <span class="greeting-dot">·</span>
                <a [routerLink]="['/org/squads', squad.id]" class="greeting-squad">{{ squad.name }}</a>
              }
              @if (role === 'TribeLead' && tribe) {
                <span class="greeting-dot">·</span>
                <a [routerLink]="['/org/tribes', tribe.id]" class="greeting-squad">{{ tribe.name }}</a>
              }
            </div>
          </div>
        </div>
        <!-- Quick search -->
        <div class="search-wrap" (click)="$event.stopPropagation()">
          <div class="search-box" [class.search-active]="searchOpen">
            <span class="search-icon">⌕</span>
            <input
              class="search-input"
              type="text"
              [placeholder]="'dashboard.search_placeholder' | translate"
              [(ngModel)]="searchQuery"
              (ngModelChange)="onSearch($event)"
              (focus)="searchOpen = searchQuery.length > 0"
              autocomplete="off"
            />
            @if (searchQuery) {
              <button class="search-clear" (click)="clearSearch()">✕</button>
            }
          </div>
          @if (searchOpen && searchResults.length) {
            <div class="search-dropdown">
              @for (r of searchResults; track r.id) {
                <div class="search-result" (click)="navigate(r)">
                  <span class="search-type" [class]="r.type === 'app' ? 'type-app' : 'type-member'">
                    {{ (r.type === 'app' ? 'dashboard.search_type.app' : 'dashboard.search_type.member') | translate }}
                  </span>
                  <div class="search-info">
                    <div class="search-primary">{{ r.primary }}</div>
                    @if (r.secondary) { <div class="search-secondary">{{ r.secondary }}</div> }
                  </div>
                </div>
              }
            </div>
          }
          @if (searchOpen && searchQuery.length >= 2 && !searchResults.length) {
            <div class="search-dropdown search-empty">{{ 'dashboard.search_no_results' | translate: { query: searchQuery } }}</div>
          }
        </div>
      </div>

      <!-- ── Admin / AgileCoach ─────────────────────────────────────────── -->
      @if (role === 'Admin' || role === 'AgileCoach') {
        <div class="metric-grid">
          <div class="metric"><div class="metric-value">{{ orgStats.members }}</div><div class="metric-label">{{ 'dashboard.metric.members' | translate }}</div></div>
          <div class="metric"><div class="metric-value">{{ orgStats.tribes }}</div><div class="metric-label">{{ 'dashboard.metric.tribes' | translate }}</div></div>
          <div class="metric"><div class="metric-value">{{ orgStats.squads }}</div><div class="metric-label">{{ 'dashboard.metric.squads' | translate }}</div></div>
          <div class="metric"><div class="metric-value">{{ orgStats.avgPerTribe }}</div><div class="metric-label">{{ 'dashboard.metric.avg_per_tribe' | translate }}</div></div>
        </div>

        <div class="dash-grid">
          <div class="card dash-wide">
            <div class="card-body">
              <div class="section-title">{{ 'dashboard.section.headcount_by_tribe' | translate }}</div>
              <div class="bar-chart">
                @for (t of headcount; track t.id) {
                  <div class="bar-row">
                    <div class="bar-label">{{ t.name }}</div>
                    <div class="bar-track"><div class="bar-fill" [style.width]="barWidth(t.memberCount)"></div></div>
                    <div class="bar-value">{{ t.memberCount }}</div>
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <div class="section-title">{{ 'dashboard.section.squad_breakdown' | translate }}</div>
              @for (t of headcount; track t.id) {
                <div class="tribe-block">
                  <div class="tribe-name">{{ t.name }}</div>
                  @for (sq of t.squads; track sq.id) {
                    <div class="squad-row">
                      <span>{{ sq.name }}</span>
                      <span class="squad-count">{{ sq.memberCount }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- App Fleet Health -->
        @if (fleetHealth.total > 0) {
          <div class="section-title" style="margin:20px 0 12px">{{ 'dashboard.section.fleet_health' | translate }}</div>
          <div class="health-summary-grid">
            <div class="health-tile health-tile-ok">
              <div class="health-tile-value">{{ fleetHealth.active }}</div>
              <div class="health-tile-label">{{ 'dashboard.tile.active' | translate }}</div>
            </div>
            <div class="health-tile" [class.health-tile-danger]="fleetHealth.failed > 0" [class.health-tile-ok]="fleetHealth.failed === 0">
              <div class="health-tile-value">{{ fleetHealth.failed }}</div>
              <div class="health-tile-label">{{ 'dashboard.tile.failed' | translate }}</div>
            </div>
            <div class="health-tile" [class.health-tile-warn]="fleetHealth.inactive > 0" [class.health-tile-ok]="fleetHealth.inactive === 0">
              <div class="health-tile-value">{{ fleetHealth.inactive }}</div>
              <div class="health-tile-label">{{ 'dashboard.tile.inactive' | translate }}</div>
            </div>
            <div class="health-tile" [class.health-tile-warn]="fleetHealth.decom > 0" [class.health-tile-ok]="fleetHealth.decom === 0">
              <div class="health-tile-value">{{ fleetHealth.decom }}</div>
              <div class="health-tile-label">{{ 'dashboard.tile.decom' | translate }}</div>
            </div>
            <div class="health-tile" [class.health-tile-danger]="fleetHealth.javaFail > 0" [class.health-tile-ok]="fleetHealth.javaFail === 0">
              <div class="health-tile-value">{{ fleetHealth.javaFail }}</div>
              <div class="health-tile-label">{{ 'dashboard.tile.java_non_compliant' | translate }}</div>
            </div>
            <div class="health-tile" [class.health-tile-warn]="fleetHealth.xrayFail > 0" [class.health-tile-ok]="fleetHealth.xrayFail === 0">
              <div class="health-tile-value">{{ fleetHealth.xrayFail }}</div>
              <div class="health-tile-label">{{ 'dashboard.tile.no_xray_scan' | translate }}</div>
            </div>
          </div>

          <div class="card" style="margin-top:16px">
            <div class="card-body">
              <div class="section-title" style="margin-bottom:14px">{{ 'dashboard.section.compliance' | translate }}</div>
              <div class="compliance-row">
                <div class="compliance-item">
                  <div class="compliance-label">{{ 'dashboard.section.java_compliance' | translate }}</div>
                  <div class="compliance-bar-wrap">
                    <div class="compliance-bar compliance-bar-ok"  [style.width]="compliancePct(fleetHealth.javaOk,  fleetHealth.total)"></div>
                    <div class="compliance-bar compliance-bar-bad" [style.width]="compliancePct(fleetHealth.javaFail, fleetHealth.total)"></div>
                  </div>
                  <div class="compliance-legend">
                    <span class="cl-ok">{{ 'dashboard.compliance_legend.compliant' | translate: { n: fleetHealth.javaOk } }}</span>
                    <span class="cl-bad">{{ (fleetHealth.javaFail !== 1 ? 'dashboard.compliance_legend.issues' : 'dashboard.compliance_legend.issue') | translate: { n: fleetHealth.javaFail } }}</span>
                  </div>
                </div>
                <div class="compliance-item">
                  <div class="compliance-label">{{ 'dashboard.section.xray_scans' | translate }}</div>
                  <div class="compliance-bar-wrap">
                    <div class="compliance-bar compliance-bar-ok"  [style.width]="compliancePct(fleetHealth.xrayOk,  fleetHealth.total)"></div>
                    <div class="compliance-bar compliance-bar-bad" [style.width]="compliancePct(fleetHealth.xrayFail, fleetHealth.total)"></div>
                  </div>
                  <div class="compliance-legend">
                    <span class="cl-ok">{{ 'dashboard.compliance_legend.scanned' | translate: { n: fleetHealth.xrayOk } }}</span>
                    <span class="cl-bad">{{ 'dashboard.compliance_legend.missing' | translate: { n: fleetHealth.xrayFail } }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        }

        <div class="quick-links">
          <a class="btn btn-primary" routerLink="/admin/members">{{ 'dashboard.actions.manage_members' | translate }}</a>
          <a class="btn btn-ghost" routerLink="/admin/flags">{{ 'dashboard.actions.feature_flags' | translate }}</a>
          <a class="btn btn-ghost" routerLink="/org">{{ 'dashboard.actions.org_directory' | translate }}</a>
          <a class="btn btn-ghost" routerLink="/apps">{{ 'dashboard.actions.all_apps' | translate }}</a>
        </div>

      <!-- ── Tribe Lead ────────────────────────────────────────────────── -->
      } @else if (role === 'TribeLead') {
        @if (tribe) {
          <div class="metric-grid">
            <div class="metric"><div class="metric-value">{{ tribeSquads.length }}</div><div class="metric-label">{{ 'dashboard.metric.squads' | translate }}</div></div>
            <div class="metric"><div class="metric-value">{{ tribeTotalMembers }}</div><div class="metric-label">{{ 'dashboard.metric.members' | translate }}</div></div>
            <div class="metric"><div class="metric-value">{{ tribeHealth.total }}</div><div class="metric-label">{{ 'dashboard.metric.applications' | translate }}</div></div>
            <div class="metric" [class.metric-warn]="tribeHealth.failed > 0">
              <div class="metric-value">{{ tribeHealth.failed }}</div>
              <div class="metric-label">{{ 'dashboard.metric.apps_failing' | translate }}</div>
            </div>
          </div>

          <div class="section-title" style="margin-bottom:12px">{{ 'dashboard.section.squads_in' | translate: { tribe: tribe.name } }}</div>
          <div class="card-grid">
            @for (row of tribeSquads; track row.squad.id) {
              <div class="card">
                <div class="card-body">
                  <div style="font-weight:600;margin-bottom:4px">{{ row.squad.name }}</div>
                  <div style="color:var(--text-muted);font-size:0.82rem;margin-bottom:10px">{{ row.squad.missionStatement }}</div>
                  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                    <span class="badge badge-muted">{{ 'org.members_count' | translate: { n: row.memberCount } }}</span>
                    @if (row.apps.length) {
                      @if (squadFailedCount(row.apps) > 0) {
                        <span class="badge badge-danger">{{ squadFailedCount(row.apps) }} failed</span>
                      } @else {
                        <span class="badge badge-success">{{ row.apps.length }} apps OK</span>
                      }
                    }
                  </div>
                  <!-- App health micro-bar -->
                  @if (row.apps.length) {
                    <div class="app-micro-row">
                      @for (a of row.apps; track a.appId) {
                        <span class="app-micro-dot app-dot-{{ a.status }}" [title]="a.appId + ': ' + a.status"></span>
                      }
                    </div>
                  }
                </div>
                <div class="card-footer-row">
                  <a class="btn btn-ghost btn-sm" [routerLink]="['/org/squads', row.squad.id]">{{ 'dashboard.actions.view_squad' | translate }}</a>
                  <a class="btn btn-primary btn-sm" [routerLink]="['/apps']" [queryParams]="{ squad: row.squad.key }">{{ 'dashboard.actions.squad_apps' | translate }}</a>
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state"><div class="empty-icon">◉</div><div class="empty-title">{{ 'dashboard.no_tribe' | translate }}</div></div>
        }

      <!-- ── Member / PO / SM / ReleaseManager ────────────────────────── -->
      } @else {
        @if (squad) {
          <div class="metric-grid">
            <div class="metric">
              <div class="metric-value">{{ squadApps.length || '—' }}</div>
              <div class="metric-label">{{ 'dashboard.metric.applications' | translate }}</div>
            </div>
            <div class="metric" [class.metric-warn]="squadHealth.failed > 0">
              <div class="metric-value">{{ squadApps.length ? squadHealth.failed : '—' }}</div>
              <div class="metric-label">{{ 'dashboard.metric.failed' | translate }}</div>
            </div>
            <div class="metric" [class.metric-warn]="squadHealth.javaFail > 0">
              <div class="metric-value">{{ squadApps.length ? squadHealth.javaFail : '—' }}</div>
              <div class="metric-label">{{ 'dashboard.metric.java_issues' | translate }}</div>
            </div>
            <div class="metric" [class.metric-warn]="squadHealth.xrayFail > 0">
              <div class="metric-value">{{ squadApps.length ? squadHealth.xrayFail : '—' }}</div>
              <div class="metric-label">{{ 'dashboard.metric.no_xray' | translate }}</div>
            </div>
          </div>

          <!-- App Health Table -->
          @if (squadApps.length > 0) {
            <div class="card" style="margin-bottom:16px">
              <div class="card-body">
                <div class="section-title" style="margin-bottom:14px">
                  {{ 'dashboard.section.app_health' | translate }}
                  <span class="section-count">{{ squadApps.length }}</span>
                </div>
                <table class="app-health-table">
                  <thead>
                    <tr>
                      <th>{{ 'dashboard.table.application' | translate }}</th>
                      <th>{{ 'dashboard.table.running' | translate }}</th>
                      <th>{{ 'dashboard.table.java' | translate }}</th>
                      <th>{{ 'dashboard.table.xray' | translate }}</th>
                      <th>{{ 'dashboard.table.criticality' | translate }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (a of squadApps; track a.appId) {
                      <tr [class.row-problem]="a.status === 'failed' || a.status === 'inactive'">
                        <td>
                          <a class="app-link" [routerLink]="['/apps', a.appId]">{{ a.appId }}</a>
                        </td>
                        <td>
                          <span class="badge {{ runningClass(a.status) }}">{{ runningLabel(a.status) }}</span>
                        </td>
                        <td>
                          @if (a.javaComplianceStatus) {
                            <span class="badge {{ javaClass(a.javaComplianceStatus) }}">{{ a.javaComplianceStatus }}</span>
                          } @else {
                            <span class="badge badge-muted">—</span>
                          }
                        </td>
                        <td>
                          @if (a.xrayUrl) {
                            <a class="xray-chip xray-ok" [href]="a.xrayUrl" target="_blank" rel="noopener">✓ Scanned</a>
                          } @else {
                            <span class="xray-chip xray-miss">No scan</span>
                          }
                        </td>
                        <td>
                          @if (appCrit(a)) {
                            <span class="badge {{ appCritClass(a) }}">{{ appCrit(a) }}</span>
                          } @else {
                            <span style="color:var(--text-muted)">—</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div class="card-footer-row">
                <a class="btn btn-ghost btn-sm" [routerLink]="['/apps']" [queryParams]="{ squad: squad.key }">{{ 'dashboard.actions.all_squad_apps' | translate }}</a>
              </div>
            </div>
          }

          <div class="quick-links" style="margin-top:0">
            <a class="btn btn-ghost" [routerLink]="['/org/squads', squad.id]">{{ 'dashboard.actions.view_squad' | translate }}</a>
          </div>

        } @else {
          <div class="empty-state">
            <div class="empty-icon">◫</div>
            <div class="empty-title">{{ 'dashboard.no_squad' | translate }}</div>
            <div class="empty-sub">{{ 'dashboard.no_squad_sub' | translate }}</div>
          </div>
        }
      }
    }
  `,
  styles: [`
    .greeting { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; margin-bottom: 1.75rem; flex-wrap: wrap; }

    /* Quick search */
    .search-wrap { position: relative; flex-shrink: 0; }
    .search-box { display: flex; align-items: center; gap: 6px; height: 38px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-card); transition: border-color 150ms, box-shadow 150ms; min-width: 260px; }
    .search-box.search-active, .search-box:focus-within { border-color: var(--blue-400); box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
    .search-icon { font-size: 1rem; color: var(--text-muted); flex-shrink: 0; }
    .search-input { flex: 1; border: none; outline: none; background: transparent; font-size: 0.88rem; color: var(--text-strong); }
    .search-input::placeholder { color: var(--text-muted); }
    .search-clear { border: none; background: none; cursor: pointer; color: var(--text-muted); font-size: 0.75rem; padding: 0 2px; line-height: 1; }
    .search-clear:hover { color: var(--text-strong); }
    .search-dropdown { position: absolute; top: calc(100% + 6px); right: 0; min-width: 320px; background: var(--surface-card); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 200; overflow: hidden; }
    .search-empty { padding: 12px 16px; font-size: 0.85rem; color: var(--text-muted); }
    .search-result { display: flex; align-items: center; gap: 10px; padding: 9px 14px; cursor: pointer; transition: background 100ms; border-bottom: 1px solid var(--border); }
    .search-result:last-child { border-bottom: none; }
    .search-result:hover { background: var(--blue-50); }
    .search-type { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.06em; padding: 2px 5px; border-radius: 4px; flex-shrink: 0; }
    .type-app { background: #dbeafe; color: #1d4ed8; }
    .type-member { background: #d1fae5; color: #065f46; }
    .search-primary { font-size: 0.88rem; font-weight: 600; color: var(--text-strong); }
    .search-secondary { font-size: 0.75rem; color: var(--text-muted); margin-top: 1px; }
    .greeting-left { display: flex; align-items: center; gap: 14px; }
    .greeting-avatar { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, var(--blue-600), var(--blue-800)); color: #fff; font-size: 1.35rem; font-weight: 700; display: grid; place-items: center; flex-shrink: 0; }
    .greeting-name { font-size: 1.35rem; font-weight: 700; color: var(--text-strong); margin: 0 0 6px; }
    .greeting-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .greeting-dot { color: var(--text-muted); }
    .greeting-squad { font-size: 0.85rem; color: var(--blue-600); font-weight: 500; text-decoration: none; }
    .greeting-squad:hover { text-decoration: underline; }

    .section-title { font-weight: 600; font-size: 0.9rem; color: var(--text-strong); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
    .section-count { background: var(--surface-bg); color: var(--text-muted); font-size: 0.72rem; font-weight: 600; padding: 1px 6px; border-radius: 999px; border: 1px solid var(--border); }

    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 1.5rem; }
    .metric { background: var(--surface-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px 18px; }
    .metric-warn { border-color: #fca5a5; background: #fff7f7; }
    .metric-value { font-size: 1.6rem; font-weight: 700; color: var(--text-strong); line-height: 1.1; }
    .metric-warn .metric-value { color: #dc2626; }
    .metric-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-top: 4px; }

    .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 0; }
    .dash-wide { grid-column: span 2; }
    @media (max-width: 900px) { .dash-grid { grid-template-columns: 1fr; } .dash-wide { grid-column: span 1; } }

    /* Admin chart */
    .bar-chart { display: flex; flex-direction: column; gap: 10px; }
    .bar-row { display: flex; align-items: center; gap: 10px; }
    .bar-label { width: 180px; font-size: 0.85rem; color: var(--text); text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bar-track { flex: 1; height: 22px; background: var(--surface-bg); border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--blue-500); border-radius: 4px; transition: width 0.4s; }
    .bar-value { width: 28px; font-size: 0.85rem; font-weight: 600; color: var(--text-strong); }

    .tribe-block { margin-bottom: 12px; }
    .tribe-name { font-weight: 600; font-size: 0.82rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .squad-row { display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text); padding: 2px 0; }
    .squad-count { font-weight: 600; color: var(--text-strong); }

    .quick-links { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }

    /* Fleet health tiles */
    .health-summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-bottom: 0; }
    .health-tile { background: var(--surface-card); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; text-align: center; }
    .health-tile-ok { border-color: #bbf7d0; background: #f0fdf4; }
    .health-tile-ok .health-tile-value { color: #16a34a; }
    .health-tile-danger { border-color: #fca5a5; background: #fff7f7; }
    .health-tile-danger .health-tile-value { color: #dc2626; }
    .health-tile-warn { border-color: #fde68a; background: #fffbeb; }
    .health-tile-warn .health-tile-value { color: #d97706; }
    .health-tile-value { font-size: 1.5rem; font-weight: 700; line-height: 1.1; }
    .health-tile-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-top: 4px; }

    /* Compliance bars */
    .compliance-row { display: flex; flex-direction: column; gap: 16px; }
    .compliance-item { }
    .compliance-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
    .compliance-bar-wrap { display: flex; height: 14px; border-radius: 4px; overflow: hidden; background: var(--surface-bg); }
    .compliance-bar { height: 100%; transition: width 0.4s; }
    .compliance-bar-ok  { background: #22c55e; }
    .compliance-bar-bad { background: #f87171; }
    .compliance-legend { display: flex; gap: 16px; margin-top: 5px; }
    .cl-ok  { font-size: 0.75rem; color: #16a34a; font-weight: 600; }
    .cl-bad { font-size: 0.75rem; color: #dc2626; font-weight: 600; }

    /* App micro dots (tribe lead cards) */
    .app-micro-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
    .app-micro-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; cursor: default; }
    .app-dot-active                   { background: #22c55e; }
    .app-dot-inactive                 { background: #94a3b8; }
    .app-dot-failed                   { background: #ef4444; }
    .app-dot-marked-for-decommissioning { background: #f59e0b; }

    /* App health table */
    .app-health-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .app-health-table th { text-align: left; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); padding: 0 10px 8px 0; border-bottom: 1px solid var(--border); }
    .app-health-table td { padding: 8px 10px 8px 0; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .app-health-table tr:last-child td { border-bottom: none; }
    .app-health-table tr.row-problem td:first-child { border-left: 3px solid #ef4444; padding-left: 7px; }
    .app-link { color: var(--blue-600); font-weight: 600; font-family: var(--font-mono, monospace); font-size: 0.82rem; text-decoration: none; }
    .app-link:hover { text-decoration: underline; }
    .xray-chip { font-size: 0.72rem; font-weight: 600; padding: 2px 7px; border-radius: 999px; text-decoration: none; white-space: nowrap; }
    .xray-ok { background: #dcfce7; color: #166534; }
    .xray-miss { background: #f1f5f9; color: #94a3b8; }
  `],
})
export class DashboardComponent implements OnInit {
  private auth = inject(AuthService);
  private memberApi = inject(MemberApi);
  private squadApi = inject(SquadApi);
  private tribeApi = inject(TribeApi);
  private orgApi = inject(OrgApi);
  private appsApi = inject(AppsApi);
  private router = inject(Router);

  loading = true;

  user = this.auth.currentUser();
  role = this.user?.role as Role | null;
  member: Member | null = null;
  squad: Squad | null = null;
  tribe: Tribe | null = null;
  headcount: HeadcountEntry[] = [];
  tribeSquads: TribeSquadRow[] = [];
  squadApps: App[] = [];
  private allAppsFleet: App[] = [];

  get initials() { return (this.member?.name ?? this.user?.email ?? 'U').charAt(0).toUpperCase(); }
  get roleLabel() { return ROLE_LABEL[this.role as Role] ?? this.role ?? ''; }
  get roleClass() { return ROLE_CLASS[this.role as Role] ?? 'badge-muted'; }
  formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  // Admin stats
  orgStats = { members: 0, tribes: 0, squads: 0, avgPerTribe: 0 };
  private maxHeadcount = 1;
  barWidth(n: number) { return `${Math.round((n / this.maxHeadcount) * 100)}%`; }

  // App health
  get squadHealth(): AppHealth { return this.computeHealth(this.squadApps); }
  get appFailedCount() { return this.squadApps.filter((a) => a.status === 'failed' || a.status === 'inactive').length; }
  get fleetHealth(): AppHealth { return this.computeHealth(this.allAppsFleet); }
  get tribeHealth(): AppHealth { return this.computeHealth(this.tribeSquads.flatMap((r) => r.apps)); }

  private computeHealth(apps: App[]): AppHealth {
    const h: AppHealth = { active: 0, inactive: 0, failed: 0, decom: 0, total: apps.length, javaOk: 0, javaFail: 0, xrayOk: 0, xrayFail: 0 };
    for (const a of apps) {
      if (a.status === 'active')                      h.active++;
      else if (a.status === 'inactive')               h.inactive++;
      else if (a.status === 'failed')                 h.failed++;
      else if (a.status === 'marked-for-decommissioning') h.decom++;
      const jc = a.javaComplianceStatus;
      if (jc === 'compliant' || jc === 'exempt')      h.javaOk++;
      else if (jc)                                    h.javaFail++;
      if (a.xrayUrl)  h.xrayOk++; else h.xrayFail++;
    }
    return h;
  }

  compliancePct(n: number, total: number): string {
    return total ? `${Math.round((n / total) * 100)}%` : '0%';
  }

  squadFailedCount(apps: App[]) { return apps.filter((a) => a.status === 'failed').length; }

  runningLabel(status: string): string {
    if (status === 'active')                      return 'Active';
    if (status === 'inactive')                    return 'Inactive';
    if (status === 'failed')                      return 'Failed';
    if (status === 'marked-for-decommissioning')  return 'Decom';
    return status;
  }
  runningClass(status: string): string {
    if (status === 'active')                      return 'badge-success';
    if (status === 'failed')                      return 'badge-danger';
    if (status === 'marked-for-decommissioning')  return 'badge-warn';
    return 'badge-muted';
  }
  javaClass(s: string): string {
    return s === 'compliant' ? 'badge-success' : s === 'exempt' ? 'badge-muted' : 'badge-danger';
  }
  private parseTags(app: App): Record<string, string> {
    try { return typeof app.tags === 'string' ? JSON.parse(app.tags) : (app.tags as any) ?? {}; } catch { return {}; }
  }
  appCrit(app: App): string { return this.parseTags(app)['criticality'] ?? ''; }
  appCritClass(app: App): string {
    const c = this.parseTags(app)['criticality'];
    if (c === 'critical') return 'badge-danger';
    if (c === 'high')     return 'badge-story';
    if (c === 'medium')   return 'badge-warn';
    return 'badge-muted';
  }

  // Quick search
  searchQuery = '';
  searchOpen = false;
  searchResults: SearchResult[] = [];
  private allApps: App[] = [];
  private allMembers: Member[] = [];
  private searchDataLoaded = false;

  @HostListener('document:click')
  closeSearch() { this.searchOpen = false; }

  private async ensureSearchData() {
    if (this.searchDataLoaded) return;
    [this.allApps, this.allMembers] = await Promise.all([
      firstValueFrom(this.appsApi.getAll()),
      firstValueFrom(this.memberApi.getAll()),
    ]);
    this.searchDataLoaded = true;
  }

  async onSearch(q: string) {
    this.searchQuery = q;
    if (q.length < 2) { this.searchOpen = false; this.searchResults = []; return; }
    await this.ensureSearchData();
    const lower = q.toLowerCase();

    const appResults: SearchResult[] = this.allApps
      .filter((a) => a.appId.toLowerCase().includes(lower) || (a.squadKey ?? '').toLowerCase().includes(lower))
      .slice(0, 5)
      .map((a) => ({ id: a.appId, type: 'app', primary: a.appId, secondary: a.squadKey ?? '', route: ['/apps', a.appId] }));

    const canAdmin = this.role === 'Admin' || this.role === 'AgileCoach' || this.role === 'TribeLead';
    const memberResults: SearchResult[] = this.allMembers
      .filter((m) => m.name.toLowerCase().includes(lower) || m.email.toLowerCase().includes(lower))
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        type: 'member' as const,
        primary: m.name,
        secondary: m.email,
        route: canAdmin
          ? ['/admin/members', m.id]
          : m.squadId ? ['/org/squads', m.squadId] : ['/org'],
      }));

    this.searchResults = [...appResults, ...memberResults].slice(0, 8);
    this.searchOpen = true;
  }

  navigate(r: SearchResult) {
    this.clearSearch();
    this.router.navigate(r.route);
  }

  clearSearch() {
    this.searchQuery = '';
    this.searchResults = [];
    this.searchOpen = false;
  }

  // Tribe lead stats
  get tribeTotalMembers() { return this.tribeSquads.reduce((s, r) => s + r.memberCount, 0); }

  async ngOnInit() {
    if (!this.user) { this.loading = false; return; }
    this.member = await firstValueFrom(this.memberApi.getById(this.user.memberId));

    if (this.role === 'Admin' || this.role === 'AgileCoach') {
      await this.loadAdminData();
    } else if (this.role === 'TribeLead') {
      await this.loadTribeLeadData();
    } else {
      await this.loadSquadData();
    }

    this.loading = false;
  }

  private async loadAdminData() {
    const [headcount, allApps] = await Promise.all([
      firstValueFrom(this.orgApi.getHeadcount()),
      firstValueFrom(this.appsApi.getAll()),
    ]);
    this.headcount = headcount;
    this.allAppsFleet = allApps;
    this.maxHeadcount = Math.max(1, ...this.headcount.map((t) => t.memberCount));
    const totalMembers = this.headcount.reduce((s, t) => s + t.memberCount, 0);
    const totalSquads = this.headcount.reduce((s, t) => s + t.squads.length, 0);
    this.orgStats = {
      members: totalMembers,
      tribes: this.headcount.length,
      squads: totalSquads,
      avgPerTribe: this.headcount.length ? Math.round(totalMembers / this.headcount.length) : 0,
    };
  }

  private async loadTribeLeadData() {
    const tribes = await firstValueFrom(this.tribeApi.getAll());
    this.tribe = tribes.find((t) => t.leadMemberId === this.member!.id) ?? null;
    if (!this.tribe) return;

    const squadIds = await firstValueFrom(this.tribeApi.getSquads(this.tribe.id));
    const rows = await Promise.all(
      squadIds.map(async (sid: string): Promise<TribeSquadRow> => {
        const [sq, memberIds, apps] = await Promise.all([
          firstValueFrom(this.squadApi.getById(sid)),
          firstValueFrom(this.squadApi.getMembers(sid)),
          firstValueFrom(this.appsApi.getBySquad(sid)),
        ]);
        return { squad: sq, memberCount: memberIds.length, apps };
      })
    );
    this.tribeSquads = rows;
  }

  private async loadSquadData() {
    const squadId = this.member?.squadId;
    if (!squadId) return;

    const [sq, apps] = await Promise.all([
      firstValueFrom(this.squadApi.getById(squadId)),
      firstValueFrom(this.appsApi.getBySquad(squadId)),
    ]);
    this.squad = sq;
    this.squadApps = apps;
  }
}
