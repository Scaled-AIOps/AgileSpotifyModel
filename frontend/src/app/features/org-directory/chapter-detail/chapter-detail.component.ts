import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import { MemberApi } from '../../../core/api/member.api';
import type { Chapter, Member } from '../../../core/models/index';

@Component({
  selector: 'app-chapter-detail',
  standalone: true,
  imports: [],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else if (chapter) {
      <div class="page-header">
        <div class="page-title">
          <h1>{{ chapter.name }}</h1>
          <div class="page-sub">Discipline: {{ chapter.discipline }}</div>
        </div>
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
export class ChapterDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private memberApi = inject(MemberApi);

  chapter: Chapter | null = null;
  members: Member[] = [];
  loading = true;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.chapter = await firstValueFrom(this.api.get<Chapter>(`/chapters/${id}`));
    const memberIds = await firstValueFrom(this.api.get<string[]>(`/chapters/${id}/members`));
    this.members = await Promise.all(memberIds.map((mid: string) => firstValueFrom(this.memberApi.getById(mid))));
    this.loading = false;
  }
}
