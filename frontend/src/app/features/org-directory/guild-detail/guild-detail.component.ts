import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GuildApi } from '../../../core/api/guild.api';
import { MemberApi } from '../../../core/api/member.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { Guild, Member } from '../../../core/models/index';

@Component({
  selector: 'app-guild-detail',
  standalone: true,
  imports: [],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else if (guild) {
      <div class="page-header">
        <div class="page-title">
          <h1>{{ guild.name }}</h1>
          <div class="page-sub">{{ guild.description }}</div>
        </div>
        <button class="btn" [class.btn-danger]="isMember" [class.btn-primary]="!isMember" (click)="toggleMembership()">
          {{ isMember ? 'Leave Guild' : 'Join Guild' }}
        </button>
      </div>

      <h3>Members ({{ members.length }})</h3>
      <div class="card">
        <table class="table">
          <thead><tr><th>Name</th><th>Email</th></tr></thead>
          <tbody>
            @for (m of members; track m.id) {
              <tr>
                <td style="font-weight:500">{{ m.name }}</td>
                <td style="color:var(--text-muted)">{{ m.email }}</td>
              </tr>
            }
            @empty { <tr><td colspan="2" style="text-align:center;color:var(--text-muted)">No members yet.</td></tr> }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class GuildDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private guildApi = inject(GuildApi);
  private memberApi = inject(MemberApi);
  private auth = inject(AuthService);

  guild: Guild | null = null;
  members: Member[] = [];
  isMember = false;
  loading = true;

  private get myMemberId() { return this.auth.currentUser()?.memberId ?? ''; }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.guild = await firstValueFrom(this.guildApi.getById(id));
    const memberIds = await firstValueFrom(this.guildApi.getMembers(id));
    this.members = await Promise.all(memberIds.map((mid: string) => firstValueFrom(this.memberApi.getById(mid))));
    this.isMember = memberIds.includes(this.myMemberId);
    this.loading = false;
  }

  async toggleMembership() {
    const id = this.guild!.id;
    if (this.isMember) {
      await firstValueFrom(this.guildApi.leave(id, this.myMemberId));
      this.isMember = false;
      this.members = this.members.filter((m) => m.id !== this.myMemberId);
    } else {
      await firstValueFrom(this.guildApi.join(id, this.myMemberId));
      this.isMember = true;
      const me = await firstValueFrom(this.memberApi.getById(this.myMemberId));
      this.members.push(me);
    }
  }
}
