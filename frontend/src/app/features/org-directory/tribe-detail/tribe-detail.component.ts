/**
 * Purpose: Tribe detail page.
 * Usage:   Routed at /org/tribes/:id. Shows long `tribeName` with short `name` badge, description, link grid, release manager / agile coach, and the child squads + chapters cards.
 * Goal:    Drill into a single tribe.
 * ToDo:    Same — link arrays are read-only on this page.
 */
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TribeApi } from '../../../core/api/tribe.api';
import { ApiService } from '../../../core/api/api.service';
import { LinkListComponent } from '../../../shared/link-list/link-list.component';
import type { Tribe, Squad, Chapter } from '../../../core/models/index';

@Component({
  selector: 'app-tribe-detail',
  standalone: true,
  imports: [RouterLink, LinkListComponent],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else if (tribe) {
      <div class="page-header">
        <div class="page-title">
          <h1>
            {{ tribe.tribeName || tribe.name }}
            @if (tribe.tribeName && tribe.name !== tribe.tribeName) {
              <span class="tribe-code">{{ tribe.name }}</span>
            }
          </h1>
          <div class="page-sub">{{ tribe.description }}</div>
        </div>
      </div>
      <div class="meta-row">
        @if (tribe.releaseManager) {
          <div class="meta-card">
            <div class="meta-label">Release Manager</div>
            <div class="meta-value">{{ tribe.releaseManager }}</div>
          </div>
        }
        @if (tribe.agileCoach) {
          <div class="meta-card">
            <div class="meta-label">Agile Coach</div>
            <div class="meta-value">{{ tribe.agileCoach }}</div>
          </div>
        }
        <div class="meta-card">
          <div class="meta-label">Squads</div>
          <div class="meta-value">{{ squads.length }}</div>
        </div>
      </div>

      @if (hasLinks(tribe)) {
        <div class="link-grid">
          <app-link-list label="Jira"        [links]="tribe.jira"></app-link-list>
          <app-link-list label="Confluence"  [links]="tribe.confluence"></app-link-list>
          <app-link-list label="GitHub"      [links]="tribe.github"></app-link-list>
          <app-link-list label="Mailing list" [links]="tribe.mailingList"></app-link-list>
        </div>
      }

      <h3>Squads ({{ squads.length }})</h3>
      <div class="card-grid">
        @for (squad of squads; track squad.id) {
          <div class="card">
            <div class="card-body">
              <div style="font-weight:600;margin-bottom:0.25rem">{{ squad.name }}</div>
              <div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.75rem">{{ squad.missionStatement }}</div>
            </div>
            <div class="card-footer-row">
              <a class="btn btn-primary btn-sm" [routerLink]="['/org/squads', squad.id]">View Squad</a>
            </div>
          </div>
        }
        @empty { <p style="color:var(--text-muted)">No squads in this tribe.</p> }
      </div>

      <hr style="border:none;border-top:1px solid var(--border);margin:1.5rem 0">

      <h3>Chapters ({{ chapters.length }})</h3>
      <div class="card-grid">
        @for (ch of chapters; track ch.id) {
          <div class="card">
            <div class="card-body">
              <div style="font-weight:600;margin-bottom:0.25rem">{{ ch.name }}</div>
              <div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.75rem">{{ ch.discipline }}</div>
            </div>
            <div class="card-footer-row">
              <a class="btn btn-primary btn-sm" [routerLink]="['/org/chapters', ch.id]">View Chapter</a>
            </div>
          </div>
        }
        @empty { <p style="color:var(--text-muted)">No chapters in this tribe.</p> }
      </div>
    }
  `,
  styles: [`
    .tribe-code { font-size: 0.7em; font-weight: 600; color: var(--text-muted); background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 2px 8px; margin-left: 8px; vertical-align: middle; letter-spacing: 0.05em; font-family: var(--font-mono, monospace); }
    .meta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 1.5rem; padding: 14px 16px; background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); }
    .meta-card { background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 16px; }
    .meta-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 4px; }
    .meta-value { font-size: 0.88rem; font-weight: 600; color: var(--text-strong); }
  `],
})
export class TribeDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tribeApi = inject(TribeApi);
  private api = inject(ApiService);

  tribe: Tribe | null = null;
  squads: Squad[] = [];
  chapters: Chapter[] = [];
  loading = true;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.tribe = await firstValueFrom(this.tribeApi.getById(id));
    const [squadIds, chapterIds] = await Promise.all([
      firstValueFrom(this.tribeApi.getSquads(id)),
      firstValueFrom(this.tribeApi.getChapters(id)),
    ]);
    this.squads = await Promise.all(squadIds.map((sid: string) => firstValueFrom(this.api.get<Squad>(`/squads/${sid}`))));
    this.chapters = await Promise.all(chapterIds.map((cid: string) => firstValueFrom(this.api.get<Chapter>(`/chapters/${cid}`))));
    this.loading = false;
  }

  hasLinks(t: Tribe): boolean {
    return (t.jira?.length ?? 0) + (t.confluence?.length ?? 0) +
           (t.github?.length ?? 0) + (t.mailingList?.length ?? 0) > 0;
  }
}
