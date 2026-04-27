import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SquadApi } from '../../../core/api/squad.api';
import { MemberApi } from '../../../core/api/member.api';
import { AppsApi } from '../../../core/api/apps.api';
import { AuthService } from '../../../core/auth/auth.service';
import { FeatureFlagsService } from '../../../core/feature-flags/feature-flags.service';
import { ConfigService } from '../../../core/config/config.service';
import { SQUAD_ROLES } from '../../../core/models/index';
import type { Squad, Member, App, AppStatus } from '../../../core/models/index';

const APP_STATUS_CLASS: Record<AppStatus, string> = {
  'active':                    'badge-success',
  'inactive':                  'badge-muted',
  'marked-for-decommissioning': 'badge-warn',
  'failed':                    'badge-danger',
};

@Component({
  selector: 'app-squad-detail',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else if (squad) {
      <div class="page-header">
        <div class="page-title">
          <h1>{{ squad.name }}</h1>
          <div class="page-sub">{{ squad.missionStatement }}</div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          @if (squad.jira) { <a class="btn btn-ghost btn-sm" [href]="squad.jira" target="_blank" rel="noopener">Jira ↗</a> }
          @if (squad.confluence) { <a class="btn btn-ghost btn-sm" [href]="squad.confluence" target="_blank" rel="noopener">Confluence ↗</a> }
        </div>
      </div>

      <div class="meta-row">
        @if (squad.po) {
          <div class="meta-card">
            <div class="meta-label">Product Owner</div>
            <div class="meta-value">{{ squad.po }}</div>
          </div>
        }
        @if (squad.sm) {
          <div class="meta-card">
            <div class="meta-label">Scrum Master</div>
            <div class="meta-value">{{ squad.sm }}</div>
          </div>
        }
        @if (squad.tier) {
          <div class="meta-card">
            <div class="meta-label">Tier</div>
            <div class="meta-value"><span class="badge {{ tierClass(squad.tier) }}">Tier {{ squad.tier }}</span></div>
          </div>
        }
        @if (squad.mailingList) {
          <div class="meta-card">
            <div class="meta-label">Mailing List</div>
            <div class="meta-value mono">{{ squad.mailingList }}</div>
          </div>
        }
      </div>

      <!-- Members section -->
      <div class="section-header">
        <h3>Members ({{ members.length }})</h3>
        @if (canManage()) {
          <button class="btn btn-sm {{ managing ? 'btn-primary' : 'btn-ghost' }}"
                  (click)="managing = !managing">
            {{ managing ? 'Done' : 'Manage Members' }}
          </button>
        }
      </div>

      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              @if (managing) { <th></th> }
            </tr>
          </thead>
          <tbody>
            @for (m of members; track m.id) {
              <tr>
                <td style="font-weight:500">{{ m.name }}</td>
                <td style="color:var(--text-muted)">{{ m.email }}</td>
                <td>
                  @if (managing) {
                    <select class="role-select" [ngModel]="m.squadRole"
                            (ngModelChange)="onRoleChange(m, $event)">
                      <option value="">— unassigned —</option>
                      @for (r of squadRoles; track r) {
                        <option [value]="r">{{ r }}</option>
                      }
                    </select>
                  } @else {
                    @if (m.squadRole) {
                      <span class="badge badge-role">{{ m.squadRole }}</span>
                    } @else {
                      <span style="color:var(--text-muted);font-size:0.8rem">—</span>
                    }
                  }
                </td>
                @if (managing) {
                  <td style="text-align:right">
                    <button class="btn btn-danger btn-sm" (click)="removeMember(m)">Remove</button>
                  </td>
                }
              </tr>
            }
            @empty {
              <tr><td [attr.colspan]="managing ? 4 : 3" style="text-align:center;color:var(--text-muted)">No members yet.</td></tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Add member panel -->
      @if (managing) {
        <div class="add-panel card">
          <div class="add-panel-title">Add a member</div>
          <div class="add-row">
            <input class="add-input" type="email" placeholder="Email address"
                   [(ngModel)]="addEmail" (ngModelChange)="onEmailInput()" />
            @if (addEmail && !emailMatch && !emailNew) {
              <span class="lookup-hint">Searching…</span>
            }
            @if (emailMatch) {
              <span class="lookup-found">✓ {{ emailMatch.name }}</span>
            }
            @if (emailNew) {
              <input class="add-input" type="text" placeholder="Full name"
                     [(ngModel)]="addName" />
            }
            <select class="role-select" [(ngModel)]="addRole">
              <option value="">— squad role —</option>
              @for (r of squadRoles; track r) {
                <option [value]="r">{{ r }}</option>
              }
            </select>
            <button class="btn btn-primary btn-sm"
                    [disabled]="!canSubmitAdd || adding"
                    (click)="addMember()">
              @if (adding) { <span class="spinner"></span> }
              @else if (emailNew) { Create & Add }
              @else { Add }
            </button>
          </div>
          @if (addError) { <div class="error-msg">{{ addError }}</div> }
          @if (tempPassword && config.basicEnabled()) {
            <div class="temp-pass">
              Temporary password for {{ addEmail }}: <code>{{ tempPassword }}</code>
              <span style="color:var(--text-muted);margin-left:6px">(share with the new member)</span>
            </div>
          }
        </div>
      }

      @if (flags.isEnabled('appRegistry') && apps.length) {
        <h3 style="margin-top:1.5rem">Apps ({{ apps.length }})</h3>
        <div class="card">
          <table class="table">
            <thead><tr><th>App</th><th>Status</th><th>Criticality</th><th></th></tr></thead>
            <tbody>
              @for (app of apps; track app.appId) {
                <tr>
                  <td>
                    <span style="font-family:var(--font-mono,monospace);font-weight:600;font-size:0.85rem">{{ app.appId }}</span>
                  </td>
                  <td><span class="badge {{ appStatusClass(app.status) }}">{{ appStatusLabel(app.status) }}</span></td>
                  <td>
                    @if (appCrit(app); as c) {
                      <span class="badge {{ appCritClass(c) }}">{{ c }}</span>
                    }
                  </td>
                  <td style="text-align:right">
                    <a class="btn btn-ghost btn-sm" [routerLink]="['/apps', app.appId]">Details</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
  styles: [`
    .meta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .meta-card { background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 16px; }
    .meta-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 4px; }
    .meta-value { font-size: 0.88rem; font-weight: 600; color: var(--text-strong); }
    .mono { font-family: var(--font-mono, monospace); font-size: 0.82rem; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
    .section-header h3 { margin: 0; }
    .badge-role { background: #e8f0fe; color: #1a56db; }
    .role-select {
      font-size: 0.82rem;
      padding: 3px 6px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--surface-card);
      color: var(--text-strong);
      cursor: pointer;
    }
    .add-panel { margin-top: 0.75rem; padding: 14px 16px; }
    .add-panel-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 10px; }
    .add-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .add-input { flex: 1; min-width: 180px; font-size: 0.85rem; padding: 5px 8px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-card); color: var(--text-strong); }
    .lookup-hint { font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; }
    .lookup-found { font-size: 0.82rem; font-weight: 600; color: var(--success, #2f855a); white-space: nowrap; }
    .error-msg { margin-top: 8px; font-size: 0.8rem; color: var(--danger, #e53e3e); }
    .temp-pass { margin-top: 10px; font-size: 0.82rem; background: #fefce8; border: 1px solid #fde68a; border-radius: var(--radius); padding: 8px 12px; }
    .temp-pass code { font-family: var(--font-mono, monospace); font-weight: 700; font-size: 0.88rem; }
    .btn-danger { background: var(--danger, #e53e3e); color: #fff; border: none; }
    .btn-danger:hover { opacity: 0.85; }
  `],
})
export class SquadDetailComponent implements OnInit {
  private route     = inject(ActivatedRoute);
  private squadApi  = inject(SquadApi);
  private memberApi = inject(MemberApi);
  private appsApi   = inject(AppsApi);
  private auth      = inject(AuthService);
  readonly config   = inject(ConfigService);
  readonly flags    = inject(FeatureFlagsService);

  squadSignal = signal<Squad | null>(null);
  get squad() { return this.squadSignal(); }

  members:    Member[] = [];
  allMembers: Member[] = [];
  apps:       App[]    = [];
  loading     = true;
  managing    = false;

  addEmail     = '';
  addName      = '';
  addRole      = '';
  adding       = false;
  addError     = '';
  tempPassword = '';
  emailMatch:  Member | null = null;
  emailNew     = false;

  readonly squadRoles = SQUAD_ROLES;

  get canSubmitAdd(): boolean {
    if (!this.addEmail) return false;
    if (this.emailNew) return !!this.addName.trim();
    return !!this.emailMatch;
  }

  readonly canManage = computed(() => {
    const u = this.auth.currentUser();
    const s = this.squadSignal();
    if (!u || !s) return false;
    if (u.role === 'Admin' || u.role === 'TribeLead' || u.role === 'AgileCoach') return true;
    return u.email === s.po || u.email === s.sm;
  });

  onEmailInput() {
    const email = this.addEmail.trim().toLowerCase();
    this.emailMatch = null;
    this.emailNew = false;
    this.tempPassword = '';
    this.addError = '';
    if (!email) return;
    const found = this.allMembers.find((m) => m.email.toLowerCase() === email);
    if (found) {
      const alreadyIn = this.members.some((m) => m.id === found.id);
      if (alreadyIn) { this.addError = `${found.name} is already in this squad.`; return; }
      this.emailMatch = found;
    } else {
      this.emailNew = true;
    }
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.squadSignal.set(await firstValueFrom(this.squadApi.getById(id)));
    await this.loadMembers(id);

    if (this.flags.isEnabled('appRegistry')) {
      try { this.apps = await firstValueFrom(this.appsApi.getBySquad(id)); } catch { /* not seeded */ }
    }
    try { this.allMembers = await firstValueFrom(this.memberApi.getAll()); } catch { /* ignore */ }
    this.loading = false;
  }

  private async loadMembers(squadId: string) {
    const memberIds = await firstValueFrom(this.squadApi.getMembers(squadId));
    this.members = await Promise.all(memberIds.map((mid: string) => firstValueFrom(this.memberApi.getById(mid))));
  }

  async onRoleChange(member: Member, newRole: string) {
    if (!this.squad) return;
    try {
      await firstValueFrom(this.squadApi.updateMemberRole(this.squad.id, member.id, newRole));
      member.squadRole = newRole;
    } catch (e: any) {
      console.error('Role update failed', e);
    }
  }

  async removeMember(member: Member) {
    if (!this.squad) return;
    try {
      await firstValueFrom(this.squadApi.removeMember(this.squad.id, member.id));
      this.members = this.members.filter((m) => m.id !== member.id);
    } catch (e: any) {
      console.error('Remove failed', e);
    }
  }

  async addMember() {
    if (!this.squad || !this.canSubmitAdd) return;
    this.adding = true;
    this.addError = '';
    this.tempPassword = '';
    try {
      let memberId: string;
      if (this.emailNew) {
        const isBasic = this.config.basicEnabled();
        const pass = isBasic ? this.generateTempPassword() : undefined;
        const created = await firstValueFrom(this.memberApi.create({
          name: this.addName.trim(),
          email: this.addEmail.trim(),
          ...(pass ? { password: pass } : {}),
          role: 'Member',
          avatarUrl: '',
          squadId: '',
          chapterId: '',
        } as any));
        memberId = created.id;
        if (pass) this.tempPassword = pass;
        this.allMembers = [...this.allMembers, created];
      } else {
        memberId = this.emailMatch!.id;
      }
      await firstValueFrom(this.squadApi.addMember(this.squad.id, memberId, this.addRole || undefined));
      await this.loadMembers(this.squad.id);
      this.addEmail = '';
      this.addName = '';
      this.addRole = '';
      this.emailMatch = null;
      this.emailNew = false;
    } catch (e: any) {
      this.addError = e?.error?.error ?? 'Failed to add member';
    } finally {
      this.adding = false;
    }
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return 'Tmp' + Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('') + '!';
  }

  appStatusClass(s: AppStatus) { return APP_STATUS_CLASS[s] ?? ''; }
  appStatusLabel(s: AppStatus) {
    const m: Record<AppStatus, string> = { active: 'Active', inactive: 'Inactive', 'marked-for-decommissioning': 'Decommissioning', failed: 'Failed' };
    return m[s] ?? s;
  }
  appCrit(app: App): string {
    try { const t = typeof app.tags === 'string' ? JSON.parse(app.tags) : (app.tags as any); return t?.criticality ?? ''; } catch { return ''; }
  }
  appCritClass(c: string) {
    return c === 'high' ? 'badge-danger' : c === 'medium' ? 'badge-warn' : 'badge-muted';
  }

  tierClass(t: string) {
    return t === '0' ? 'badge-danger' : t === '1' ? 'badge-warn' : 'badge-muted';
  }
}
