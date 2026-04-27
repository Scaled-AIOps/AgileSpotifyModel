import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DomainApi } from '../../../core/api/domain.api';
import { LinkListComponent } from '../../../shared/link-list/link-list.component';
import type { OrgTreeDomain } from '../../../core/models/index';

@Component({
  selector: 'app-domain-detail',
  standalone: true,
  imports: [RouterLink, LinkListComponent],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else if (domain) {
      <div class="page-header">
        <div class="page-title">
          <h1>{{ domain.name }}</h1>
          <div class="page-sub">{{ domain.description }}</div>
        </div>
      </div>

      @if (hasLinks(domain)) {
        <div class="link-grid">
          <app-link-list label="Jira"        [links]="domain.jira"></app-link-list>
          <app-link-list label="Confluence"  [links]="domain.confluence"></app-link-list>
          <app-link-list label="GitHub"      [links]="domain.github"></app-link-list>
          <app-link-list label="Mailing list" [links]="domain.mailingList"></app-link-list>
        </div>
      }

      @if (domain.subdomains.length) {
        <h3 style="margin:0 0 12px;color:var(--text-strong)">Sub-Domains</h3>
        <div class="card-grid" style="margin-bottom:24px">
          @for (sd of domain.subdomains; track sd.id) {
            <div class="card">
              <div class="card-body">
                <div style="font-weight:600;margin-bottom:4px">{{ sd.name }}</div>
                <div style="color:var(--text-muted);font-size:0.85rem">{{ sd.description }}</div>
              </div>
              <div class="card-footer-row">
                <span style="font-size:0.8rem;color:var(--text-muted)">{{ sd.tribes.length }} tribes</span>
                <a class="btn btn-primary btn-sm" routerLink="/org/tribes">View Tribes</a>
              </div>
            </div>
          }
        </div>
      }

      @if (domain.tribes.length) {
        <h3 style="margin:0 0 12px;color:var(--text-strong)">Direct Tribes</h3>
        <div class="card-grid">
          @for (tribe of domain.tribes; track tribe.id) {
            <div class="card">
              <div class="card-body">
                <div style="font-weight:600;margin-bottom:4px">{{ tribe.name }}</div>
                <div style="color:var(--text-muted);font-size:0.85rem">{{ tribe.description }}</div>
              </div>
              <div class="card-footer-row">
                <a class="btn btn-primary btn-sm" [routerLink]="['/org/tribes', tribe.id]">View Tribe</a>
              </div>
            </div>
          }
        </div>
      }
    }
  `,
  styles: [`
    .link-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 1.5rem; padding: 14px 16px; background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius); }
  `],
})
export class DomainDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private domainApi = inject(DomainApi);

  domain: OrgTreeDomain | null = null;
  loading = true;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.domain = await firstValueFrom(this.domainApi.getTree(id));
    this.loading = false;
  }

  hasLinks(d: OrgTreeDomain): boolean {
    return (d.jira?.length ?? 0) + (d.confluence?.length ?? 0) +
           (d.github?.length ?? 0) + (d.mailingList?.length ?? 0) > 0;
  }
}
