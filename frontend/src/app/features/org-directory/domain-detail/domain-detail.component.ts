import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DomainApi } from '../../../core/api/domain.api';
import type { OrgTreeDomain } from '../../../core/models/index';

@Component({
  selector: 'app-domain-detail',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else if (domain) {
      <div class="page-header">
        <div class="page-title">
          <h1>{{ domain.name }}</h1>
          <div class="page-sub">{{ domain.description }}</div>
        </div>
      </div>

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
}
