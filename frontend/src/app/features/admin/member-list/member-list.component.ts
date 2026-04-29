/**
 * Purpose: Member directory list / search page.
 * Usage:   Routed at /admin/members. Sortable searchable table.
 * Goal:    Find and manage the people directory.
 * ToDo:    —
 */
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MemberApi } from '../../../core/api/member.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { Member } from '../../../core/models/index';

const ROLE_CLASS: Record<string, string> = { Admin: 'badge-danger', TribeLead: 'badge-story', PO: 'badge-warn', AgileCoach: 'badge-success', ReleaseManager: 'badge-epic', Member: 'badge-muted' };

@Component({
  selector: 'app-member-list',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslateModule],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title"><h1>{{ 'admin.members.title' | translate }}</h1></div>
        <a class="btn btn-primary" routerLink="/admin/members/new">{{ 'admin.members.add' | translate }}</a>
      </div>

      <div style="margin-bottom:16px">
        <input class="value-input" style="max-width:320px" [(ngModel)]="searchQuery" (ngModelChange)="applyFilter()" [placeholder]="'admin.members.search_placeholder' | translate" />
      </div>

      <div class="card">
        <table class="table">
          <thead>
            <tr><th>{{ 'common.name' | translate }}</th><th>{{ 'common.email' | translate }}</th><th>{{ 'common.role' | translate }}</th><th></th></tr>
          </thead>
          <tbody>
            @for (m of filtered; track m.id) {
              <tr>
                <td style="font-weight:500">{{ m.name }}</td>
                <td style="color:var(--text-muted)">{{ m.email }}</td>
                <td><span class="badge" [class]="roleClass(m.role)">{{ m.role }}</span></td>
                <td style="text-align:right;white-space:nowrap">
                  @if (isFullAdmin) {
                    <a class="btn btn-ghost btn-sm" [routerLink]="['/admin/members', m.id]">{{ 'common.edit' | translate }}</a>
                    <button class="btn btn-sm" style="color:var(--danger);border-color:#fecaca;margin-left:6px" (click)="deleteMember(m)">{{ 'common.delete' | translate }}</button>
                  }
                </td>
              </tr>
            }
            @empty {
              <tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px">{{ 'org.squad.no_members' | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class MemberListComponent implements OnInit {
  private memberApi = inject(MemberApi);
  private auth = inject(AuthService);
  private i18n = inject(TranslateService);

  members: Member[] = [];
  filtered: Member[] = [];
  searchQuery = '';
  loading = true;

  get isFullAdmin() { const r = this.auth.currentUser()?.role; return r === 'Admin' || r === 'AgileCoach'; }
  roleClass = (r: string) => ROLE_CLASS[r] ?? 'badge-muted';

  async ngOnInit() {
    this.members = await firstValueFrom(this.memberApi.getAll());
    this.filtered = [...this.members];
    this.loading = false;
  }

  applyFilter() {
    const q = this.searchQuery.toLowerCase();
    this.filtered = this.members.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }

  async deleteMember(member: Member) {
    if (!confirm(this.i18n.instant('common.confirm_delete', { name: member.name }))) return;
    await firstValueFrom(this.memberApi.delete(member.id));
    this.members = this.members.filter((m) => m.id !== member.id);
    this.applyFilter();
  }
}
