/**
 * Purpose: TLS certificate registry page (expiry monitoring).
 * Usage:   Routed at /apps/certificates. Browse certs, filter by env / status /
 *          expiry bucket, sort by days-until-expiry.
 * Goal:    Surface certificates approaching renewal so operators don't get
 *          paged by an outage caused by an expired cert. Issuance is out of
 *          scope.
 */
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KeyValuePipe, SlicePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { AppsApi } from '../../../core/api/apps.api';
import type { Certificate, CertificateStatus } from '../../../core/models/index';

const ENV_CLASS: Record<string, string> = {
  prd: 'badge-danger', uat: 'badge-warn', int: 'badge-story', dev: 'badge-success', local: 'badge-muted',
};

type ExpiryBucket = 'expired' | 'critical' | 'warning' | 'ok';

const BUCKET_CLASS: Record<ExpiryBucket, string> = {
  expired:  'badge-danger',
  critical: 'badge-danger',
  warning:  'badge-warn',
  ok:       'badge-success',
};

const STATUS_CLASS: Record<CertificateStatus, string> = {
  'active':          'badge-success',
  'pending-renewal': 'badge-warn',
  'revoked':         'badge-muted',
};

const DAY_MS = 86_400_000;

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [RouterLink, FormsModule, KeyValuePipe, SlicePipe, TranslateModule],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'apps.certs.title' | translate }}</h1>
          <div class="page-sub">{{ 'apps.certs.count' | translate: { shown: filtered.length, total: certs.length } }}</div>
        </div>
        <a class="btn btn-ghost btn-sm" routerLink="/apps">{{ 'apps.certs.applications' | translate }}</a>
      </div>

      <!-- Headline counters -->
      <div class="kpi-row">
        <button class="kpi" [class.active]="!activeBucket" (click)="setBucket(null)">
          <span class="kpi-num">{{ certs.length }}</span>
          <span class="kpi-label">{{ 'apps.certs.kpi.total' | translate }}</span>
        </button>
        <button class="kpi danger" [class.active]="activeBucket === 'expired'" (click)="setBucket('expired')">
          <span class="kpi-num">{{ kpi.expired }}</span>
          <span class="kpi-label">{{ 'apps.certs.kpi.expired' | translate }}</span>
        </button>
        <button class="kpi danger" [class.active]="activeBucket === 'critical'" (click)="setBucket('critical')">
          <span class="kpi-num">{{ kpi.critical }}</span>
          <span class="kpi-label">{{ 'apps.certs.kpi.critical' | translate }}</span>
        </button>
        <button class="kpi warn" [class.active]="activeBucket === 'warning'" (click)="setBucket('warning')">
          <span class="kpi-num">{{ kpi.warning }}</span>
          <span class="kpi-label">{{ 'apps.certs.kpi.warning' | translate }}</span>
        </button>
        <button class="kpi ok" [class.active]="activeBucket === 'ok'" (click)="setBucket('ok')">
          <span class="kpi-num">{{ kpi.ok }}</span>
          <span class="kpi-label">{{ 'apps.certs.kpi.ok' | translate }}</span>
        </button>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="search-box">
          <span class="search-icon">⌕</span>
          <input class="search-input" type="text" [placeholder]="'apps.certs.search_placeholder' | translate"
                 [(ngModel)]="query" (ngModelChange)="applyFilter()" />
          @if (query) { <button class="search-clear" (click)="clearQuery()">✕</button> }
        </div>

        <div class="filter-chips">
          <button class="chip" [class.active]="!activeEnv" (click)="setEnv(null)">{{ 'common.all' | translate }}</button>
          @for (e of envs; track e) {
            <button class="chip" [class.active]="activeEnv === e" (click)="setEnv(e)">{{ e }}</button>
          }
        </div>

        <div class="filter-chips status-chips">
          <button class="chip" [class.active]="!activeStatus" (click)="setStatus(null)">{{ 'common.all' | translate }}</button>
          @for (s of statuses; track s) {
            <button class="chip" [class.active]="activeStatus === s" (click)="setStatus(s)">
              {{ statusLabelKey(s) | translate }}
            </button>
          }
        </div>
      </div>

      <div class="cert-grid" style="margin-top:1rem">
        @for (c of filtered; track c.certId) {
          <div class="cert-card" [class.cert-expired]="bucketOf(c) === 'expired' || c.status === 'revoked'">
            <div class="cert-header">
              <div class="cert-name">{{ c.commonName }}</div>
              <span class="badge {{ envClass(c.environment) }}">{{ c.environment }}</span>
            </div>
            <div class="cert-id mono">{{ c.certId }}</div>

            <div class="cert-body">
              <div class="cert-row expiry-row">
                <span class="cert-key">{{ 'apps.certs.expiry' | translate }}</span>
                <span class="cert-val">
                  <span class="badge {{ bucketClass(c) }}">
                    {{ daysLabel(c) }}
                  </span>
                  <span class="expiry-date mono">{{ c.notAfter | slice:0:10 }}</span>
                </span>
              </div>

              <div class="cert-row">
                <span class="cert-key">{{ 'apps.certs.status' | translate }}</span>
                <span class="cert-val">
                  <span class="badge {{ statusClass(c.status) }}">{{ statusLabelKey(c.status) | translate }}</span>
                  @if (c.autoRenewal === 'true') {
                    <span class="auto-renew-chip">{{ 'apps.certs.auto_renewal' | translate }}</span>
                  }
                </span>
              </div>

              <div class="cert-row">
                <span class="cert-key">{{ 'apps.certs.issuer' | translate }}</span>
                <span class="cert-val issuer-val">{{ c.issuer }}</span>
              </div>

              @if (parsedSans(c).length) {
                <div class="cert-row" style="align-items:flex-start">
                  <span class="cert-key">{{ 'apps.certs.sans' | translate }}</span>
                  <span class="cert-val" style="display:flex;gap:4px;flex-wrap:wrap">
                    @for (s of parsedSans(c); track s) {
                      <span class="san-chip mono">{{ s }}</span>
                    }
                  </span>
                </div>
              }

              <div class="cert-row">
                <span class="cert-key">{{ 'apps.certs.serial' | translate }}</span>
                <span class="cert-val mono fp-val">{{ c.serialNumber }}</span>
              </div>

              <div class="cert-row">
                <span class="cert-key">{{ 'apps.certs.fingerprint' | translate }}</span>
                <span class="cert-val mono fp-val">{{ shortFp(c.fingerprintSha256) }}</span>
              </div>

              @if (parsedTags(c) | keyvalue; as tagEntries) {
                @if (tagEntries.length) {
                  <div class="cert-row" style="align-items:flex-start">
                    <span class="cert-key">{{ 'apps.certs.tags' | translate }}</span>
                    <span class="cert-val" style="display:flex;gap:4px;flex-wrap:wrap">
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
            <div class="empty-title">{{ 'apps.certs.no_match' | translate }}</div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .search-box { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-card); min-width: 240px; }
    .search-box:focus-within { border-color: var(--blue-400); }
    .search-icon { font-size: 1rem; color: var(--text-muted); }
    .search-input { flex: 1; border: none; outline: none; background: transparent; font-size: 0.88rem; color: var(--text-strong); }
    .search-input::placeholder { color: var(--text-muted); }
    .search-clear { border: none; background: none; cursor: pointer; color: var(--text-muted); font-size: 0.75rem; padding: 0 2px; }
    .filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .status-chips { padding-left: 12px; border-left: 1px solid var(--border); }
    .chip { padding: 3px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid var(--border); background: var(--surface-bg); color: var(--text-muted); cursor: pointer; transition: all 150ms; }
    .chip:hover { border-color: var(--blue-400); color: var(--blue-600); }
    .chip.active { background: var(--blue-600); border-color: var(--blue-600); color: #fff; }

    .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 1rem; }
    .kpi { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-card); cursor: pointer; transition: border-color 150ms, box-shadow 150ms; text-align: left; }
    .kpi:hover { border-color: var(--blue-400); }
    .kpi.active { border-color: var(--blue-600); box-shadow: 0 0 0 2px rgba(59,130,246,0.18); }
    .kpi.danger.active { border-color: var(--red-600, #dc2626); box-shadow: 0 0 0 2px rgba(220,38,38,0.18); }
    .kpi.warn.active   { border-color: #d97706; box-shadow: 0 0 0 2px rgba(217,119,6,0.18); }
    .kpi.ok.active     { border-color: #059669; box-shadow: 0 0 0 2px rgba(5,150,105,0.18); }
    .kpi-num { font-size: 1.4rem; font-weight: 700; color: var(--text-strong); }
    .kpi-label { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .kpi.danger .kpi-num { color: var(--red-600, #dc2626); }
    .kpi.warn .kpi-num   { color: #d97706; }
    .kpi.ok .kpi-num     { color: #059669; }

    .cert-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px; }
    .cert-card { background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; }
    .cert-card.cert-expired { opacity: 0.65; border-style: dashed; }
    .cert-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px; }
    .cert-name { font-weight: 600; font-size: 0.95rem; color: var(--text-strong); word-break: break-all; }
    .cert-id { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 12px; }
    .cert-body { display: flex; flex-direction: column; gap: 6px; }
    .cert-row { display: flex; gap: 8px; font-size: 0.82rem; }
    .cert-key { width: 90px; flex-shrink: 0; color: var(--text-muted); font-weight: 600; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; padding-top: 1px; }
    .cert-val { color: var(--text-strong); flex: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .expiry-row .cert-val { font-weight: 600; }
    .expiry-date { font-size: 0.75rem; color: var(--text-muted); }
    .issuer-val { word-break: break-word; font-size: 0.78rem; }
    .fp-val { font-size: 0.7rem; word-break: break-all; }
    .mono { font-family: var(--font-mono, monospace); }
    .san-chip { font-size: 0.72rem; background: var(--surface-bg); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; }
    .auto-renew-chip { font-size: 0.7rem; background: rgba(5,150,105,0.12); color: #059669; border-radius: 4px; padding: 1px 6px; font-weight: 600; }
    .tag-chip { font-size: 0.72rem; background: var(--surface-bg); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; color: var(--text-muted); }
  `],
})
export class CertificatesComponent implements OnInit {
  private appsApi = inject(AppsApi);

  certs: Certificate[] = [];
  filtered: Certificate[] = [];
  loading = true;
  query = '';
  envs: string[] = [];
  activeEnv: string | null = null;
  readonly statuses: CertificateStatus[] = ['active', 'pending-renewal', 'revoked'];
  activeStatus: CertificateStatus | null = null;
  activeBucket: ExpiryBucket | null = null;
  kpi = { expired: 0, critical: 0, warning: 0, ok: 0 };

  async ngOnInit() {
    this.certs = await firstValueFrom(this.appsApi.getAllCertificates());
    this.envs = [...new Set(this.certs.map((c) => c.environment).filter(Boolean))].sort();
    this.recomputeKpi();
    this.applyFilter();
    this.loading = false;
  }

  setEnv(e: string | null)              { this.activeEnv = e; this.applyFilter(); }
  setStatus(s: CertificateStatus | null){ this.activeStatus = s; this.applyFilter(); }
  setBucket(b: ExpiryBucket | null)     { this.activeBucket = b; this.applyFilter(); }
  clearQuery()                          { this.query = ''; this.applyFilter(); }

  applyFilter() {
    const q = this.query.toLowerCase();
    this.filtered = this.certs
      .filter((c) => {
        const matchQ = !q
          || c.certId.toLowerCase().includes(q)
          || c.commonName.toLowerCase().includes(q)
          || c.issuer.toLowerCase().includes(q)
          || (c.subjectAltNames ?? '').toLowerCase().includes(q);
        const matchE = !this.activeEnv || c.environment === this.activeEnv;
        const matchS = !this.activeStatus || c.status === this.activeStatus;
        const matchB = !this.activeBucket || this.bucketOf(c) === this.activeBucket;
        return matchQ && matchE && matchS && matchB;
      })
      // Sort by days-until-expiry ascending — soonest renewals at the top.
      .sort((a, b) => Date.parse(a.notAfter) - Date.parse(b.notAfter));
  }

  recomputeKpi() {
    this.kpi = { expired: 0, critical: 0, warning: 0, ok: 0 };
    for (const c of this.certs) this.kpi[this.bucketOf(c)]++;
  }

  envClass(e: string)   { return ENV_CLASS[e] ?? 'badge-muted'; }
  bucketClass(c: Certificate) { return BUCKET_CLASS[this.bucketOf(c)]; }
  statusClass(s: CertificateStatus) { return STATUS_CLASS[s] ?? 'badge-muted'; }
  statusLabelKey(s: CertificateStatus): string {
    return s === 'pending-renewal' ? 'apps.certs.status_opt.pending' : 'apps.certs.status_opt.' + s;
  }

  daysUntil(c: Certificate): number {
    return Math.floor((Date.parse(c.notAfter) - Date.now()) / DAY_MS);
  }

  bucketOf(c: Certificate): ExpiryBucket {
    const days = this.daysUntil(c);
    if (days < 0)   return 'expired';
    if (days <= 30) return 'critical';
    if (days <= 90) return 'warning';
    return 'ok';
  }

  daysLabel(c: Certificate): string {
    const days = this.daysUntil(c);
    if (days < 0)  return `Expired ${-days}d ago`;
    if (days === 0) return 'Expires today';
    if (days === 1) return 'Expires in 1 day';
    return `Expires in ${days} days`;
  }

  shortFp(fp: string): string {
    // Compact long fingerprints to first/last 16 hex chars.
    const compact = (fp ?? '').replace(/:/g, '');
    if (compact.length <= 32) return fp;
    return `${compact.slice(0, 16)}…${compact.slice(-16)}`;
  }

  parsedSans(c: Certificate): string[] {
    try { return c.subjectAltNames ? JSON.parse(c.subjectAltNames) : []; } catch { return []; }
  }

  parsedTags(c: Certificate): Record<string, string> {
    try { return c.tags ? JSON.parse(c.tags) : {}; } catch { return {}; }
  }
}
