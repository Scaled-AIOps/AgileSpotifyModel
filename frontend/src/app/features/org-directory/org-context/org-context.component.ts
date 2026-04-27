/**
 * Purpose: Default /org page — your context.
 * Usage:   Routed at /org. Shows the squad / tribe / domain chain the current user belongs to and a Global View button.
 * Goal:    Give every user a personalised landing page in the org directory; Global View is the escape hatch for browsing other parts of the org.
 * ToDo:    —
 */
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { MemberApi } from '../../../core/api/member.api';
import { SquadApi } from '../../../core/api/squad.api';
import { TribeApi } from '../../../core/api/tribe.api';
import { ApiService } from '../../../core/api/api.service';
import { AppsApi } from '../../../core/api/apps.api';
import { FeatureFlagsService } from '../../../core/feature-flags/feature-flags.service';
import { OrgTreeComponent } from '../org-tree/org-tree.component';
import type { Member, Squad, Tribe, Domain, SubDomain } from '../../../core/models/index';

@Component({
  selector: 'app-org-context',
  standalone: true,
  imports: [RouterLink, OrgTreeComponent],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title">
          <h1>Org Directory</h1>
          @if (!showGlobal && breadcrumb.length) {
            <div class="page-sub breadcrumb">
              @for (crumb of breadcrumb; track crumb.label; let last = $last) {
                <span class="crumb">{{ crumb.label }}</span>
                @if (!last) { <span class="crumb-sep">›</span> }
              }
            </div>
          }
        </div>
      </div>

      @if (showGlobal) {
        <app-org-tree />
      } @else {
        @if (!member?.squadId && role !== 'TribeLead') {
          <div class="empty-state">
            <div class="empty-icon">◉</div>
            <div class="empty-title">You are not assigned to a squad or tribe yet.</div>
            <div class="empty-sub">Use the global view to explore the full organisation.</div>
          </div>
        } @else {
          <div class="context-chain">

            <!-- Domain -->
            @if (domain) {
              <div class="chain-node">
                <div class="chain-card" [class.mine]="false">
                  <div class="chain-type-tag">Domain</div>
                  <div class="chain-name">{{ domain.name }}</div>
                  @if (domain.description) {
                    <div class="chain-desc">{{ domain.description }}</div>
                  }
                  <a class="btn btn-ghost btn-sm chain-link" [routerLink]="['/org/domains', domain.id]">View Domain</a>
                </div>
              </div>
              <div class="chain-connector"></div>
            }

            <!-- SubDomain -->
            @if (subdomain) {
              <div class="chain-node">
                <div class="chain-card">
                  <div class="chain-type-tag subdomain">Sub-Domain</div>
                  <div class="chain-name">{{ subdomain.name }}</div>
                  @if (subdomain.description) {
                    <div class="chain-desc">{{ subdomain.description }}</div>
                  }
                </div>
              </div>
              <div class="chain-connector"></div>
            }

            <!-- Tribe -->
            @if (tribe) {
              <div class="chain-node">
                <div class="chain-card" [class.mine]="role === 'TribeLead'">
                  @if (role === 'TribeLead') { <div class="mine-badge">You lead this</div> }
                  <div class="chain-type-tag tribe">Tribe</div>
                  <div class="chain-name">{{ tribe.name }}</div>
                  @if (tribe.description) {
                    <div class="chain-desc">{{ tribe.description }}</div>
                  }
                  @if (tribeLeadName) {
                    <div class="chain-lead">Lead: <strong>{{ tribeLeadName }}</strong></div>
                  }
                  <a class="btn btn-ghost btn-sm chain-link" [routerLink]="['/org/tribes', tribe.id]">View Tribe</a>
                </div>
              </div>
              @if (squad) { <div class="chain-connector"></div> }
            }

            <!-- Squad -->
            @if (squad) {
              <div class="chain-node">
                <div class="chain-card mine">
                  <div class="mine-badge">Your Squad</div>
                  <div class="chain-type-tag squad">Squad</div>
                  <div class="chain-name">{{ squad.name }}</div>
                  @if (squad.missionStatement) {
                    <div class="chain-desc">{{ squad.missionStatement }}</div>
                  }
                  @if (squadLeadName) {
                    <div class="chain-lead">Lead: <strong>{{ squadLeadName }}</strong></div>
                  }
                  <div class="squad-stats">
                    <span class="stat-pill">{{ memberCount }} members</span>
                    @if (flags.isEnabled('appRegistry') && appCount > 0) {
                      <span class="stat-pill">{{ appCount }} apps</span>
                    }
                  </div>
                  <div class="chain-actions">
                    <a class="btn btn-ghost btn-sm" [routerLink]="['/org/squads', squad.id]">View Squad</a>
                    @if (flags.isEnabled('appRegistry') && appCount > 0) {
                      <a class="btn btn-ghost btn-sm" [routerLink]="['/org/squads', squad.id]" fragment="apps">Apps ↗</a>
                    }
                  </div>
                </div>
              </div>
            }

          </div>
        }
      }
    }

    <!-- Floating toggle -->
    <button class="global-fab" [class.active]="showGlobal" (click)="showGlobal = !showGlobal" [title]="showGlobal ? 'My context' : 'Global view'">
      @if (showGlobal) {
        <span class="fab-icon">⊙</span>
        <span class="fab-label">My Context</span>
      } @else {
        <span class="fab-icon">⊕</span>
        <span class="fab-label">Global View</span>
      }
    </button>
  `,
  styles: [`
    :host { display: block; position: relative; min-height: 100%; }

    .breadcrumb { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
    .crumb { font-size: 0.82rem; color: var(--text-muted); }
    .crumb-sep { color: var(--border); font-size: 0.9rem; }

    /* Chain layout */
    .context-chain { display: flex; flex-direction: column; align-items: center; padding-bottom: 80px; }
    .chain-node { width: 100%; max-width: 540px; }
    .chain-connector { width: 2px; height: 28px; background: var(--border); margin: 0 auto; }

    /* Chain cards */
    .chain-card {
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px 20px;
      position: relative;
      transition: border-color 150ms;
    }
    .chain-card.mine {
      border-color: var(--blue-400);
      box-shadow: 0 0 0 3px rgba(59,130,246,0.08);
    }
    .mine-badge {
      position: absolute;
      top: -10px;
      left: 16px;
      background: var(--blue-600);
      color: #fff;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 999px;
    }

    .chain-type-tag {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .chain-type-tag.subdomain { color: #7c3aed; }
    .chain-type-tag.tribe     { color: #0891b2; }
    .chain-type-tag.squad     { color: var(--blue-600); }

    .chain-name { font-size: 1.1rem; font-weight: 700; color: var(--text-strong); margin-bottom: 4px; }
    .chain-desc { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px; }
    .chain-lead { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 8px; }
    .chain-link { margin-top: 4px; }

    .squad-stats { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
    .stat-pill {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 2px 9px;
      border-radius: 999px;
      background: var(--surface-bg);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .chain-actions { display: flex; gap: 8px; }

    /* Floating toggle FAB */
    .global-fab {
      position: fixed;
      bottom: 28px;
      right: 32px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: var(--blue-700);
      color: #fff;
      border: none;
      border-radius: 999px;
      padding: 10px 18px 10px 14px;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      transition: background 150ms, transform 150ms;
      z-index: 100;
    }
    .global-fab:hover { background: var(--blue-800); transform: translateY(-1px); }
    .global-fab.active { background: var(--blue-500); }
    .fab-icon { font-size: 1rem; }
    .fab-label { letter-spacing: 0.02em; }
  `],
})
export class OrgContextComponent implements OnInit {
  private auth    = inject(AuthService);
  private memberApi = inject(MemberApi);
  private squadApi  = inject(SquadApi);
  private tribeApi  = inject(TribeApi);
  private api       = inject(ApiService);
  private appsApi   = inject(AppsApi);
  readonly flags    = inject(FeatureFlagsService);

  loading = true;
  showGlobal = false;

  user   = this.auth.currentUser();
  role   = this.user?.role ?? null;
  member: Member | null = null;
  squad:  Squad  | null = null;
  tribe:  Tribe  | null = null;
  subdomain: SubDomain | null = null;
  domain:    Domain    | null = null;
  memberCount = 0;
  appCount    = 0;
  tribeLeadName  = '';
  squadLeadName  = '';

  get breadcrumb() {
    const crumbs: { label: string }[] = [];
    if (this.domain)    crumbs.push({ label: this.domain.name });
    if (this.subdomain) crumbs.push({ label: this.subdomain.name });
    if (this.tribe)     crumbs.push({ label: this.tribe.name });
    if (this.squad)     crumbs.push({ label: this.squad.name });
    return crumbs;
  }

  async ngOnInit() {
    if (!this.user) { this.loading = false; return; }

    this.member = await firstValueFrom(this.memberApi.getById(this.user.memberId));

    const squadId = this.member.squadId;
    if (squadId) {
      await this.loadSquadChain(squadId);
    } else if (this.role === 'TribeLead') {
      await this.loadTribeChain();
    }

    this.loading = false;
  }

  private async loadSquadChain(squadId: string) {
    const [sq, memberIds] = await Promise.all([
      firstValueFrom(this.squadApi.getById(squadId)),
      firstValueFrom(this.squadApi.getMembers(squadId)),
    ]);
    this.squad = sq;
    this.memberCount = memberIds.length;

    if (this.flags.isEnabled('appRegistry')) {
      try {
        const apps = await firstValueFrom(this.appsApi.getBySquad(squadId));
        this.appCount = apps.length;
      } catch { /* flag on but data absent */ }
    }

    if (sq.leadMemberId) {
      const lead = await firstValueFrom(this.memberApi.getById(sq.leadMemberId));
      this.squadLeadName = lead.name;
    }

    await this.loadTribeById(sq.tribeId);
  }

  private async loadTribeChain() {
    const tribes = await firstValueFrom(this.tribeApi.getAll());
    const mine = tribes.find((t) => t.leadMemberId === this.member!.id);
    if (mine) await this.loadTribeById(mine.id);
  }

  private async loadTribeById(tribeId: string) {
    this.tribe = await firstValueFrom(this.tribeApi.getById(tribeId));

    if (this.tribe.leadMemberId) {
      const lead = await firstValueFrom(this.memberApi.getById(this.tribe.leadMemberId));
      this.tribeLeadName = lead.name;
    }

    if (this.tribe.subdomainId) {
      this.subdomain = await firstValueFrom(this.api.get<SubDomain>(`/subdomains/${this.tribe.subdomainId}`));
    }

    const domainId = this.subdomain?.domainId ?? this.tribe.domainId;
    if (domainId) {
      this.domain = await firstValueFrom(this.api.get<Domain>(`/domains/${domainId}`));
    }
  }
}
