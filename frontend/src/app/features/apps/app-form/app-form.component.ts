/**
 * Purpose: New-app registration form.
 * Usage:   Routed at /apps/new (TribeLead+). Submits to AppsApi.createApp.
 * Goal:    Onboard a brand-new application with all the structured fields the registry tracks.
 * ToDo:    Validate URL fields client-side before submit (mirrors safeUrl on backend).
 */
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AppsApi } from '../../../core/api/apps.api';
import { SquadApi } from '../../../core/api/squad.api';
import { LinkRepeaterComponent } from '../../../shared/link-repeater/link-repeater.component';
import type { Squad, Link } from '../../../core/models/index';

@Component({
  selector: 'app-app-form',
  standalone: true,
  imports: [RouterLink, FormsModule, LinkRepeaterComponent, TranslateModule],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title">
          <h1>{{ 'apps.form.title' | translate }}</h1>
          <div class="page-sub breadcrumb">
            <a class="crumb crumb-link" routerLink="/apps">{{ 'common.applications' | translate }}</a>
            <span class="crumb-sep">›</span>
            <span class="crumb">{{ 'admin.members.new_title' | translate }}</span>
          </div>
        </div>
      </div>

      @if (error) { <div class="alert-error">{{ error }}</div> }

      <div class="edit-form card">
        <div class="edit-section-title">{{ 'apps.form.section_identity' | translate }}</div>
        <div class="edit-grid">
          <label class="edit-field">
            <span>{{ 'apps.form.app_id' | translate }} <span class="required">*</span></span>
            <input class="value-input" type="text" [(ngModel)]="f.appId"
                   [placeholder]="'apps.form.app_id_placeholder' | translate" pattern="[a-z0-9-]+" />
            <span class="field-hint">{{ 'apps.form.app_id_hint' | translate }}</span>
          </label>
          <label class="edit-field">
            <span>{{ 'common.squad' | translate }} <span class="required">*</span></span>
            <select class="value-input" [(ngModel)]="f.squadId">
              <option value="">{{ 'apps.form.select_squad' | translate }}</option>
              @for (s of squads; track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </select>
          </label>
          <label class="edit-field">
            <span>{{ 'apps.form.status' | translate }}</span>
            <select class="value-input" [(ngModel)]="f.status">
              <option value="active">{{ 'apps.form.status_opt.active' | translate }}</option>
              <option value="inactive">{{ 'apps.form.status_opt.inactive' | translate }}</option>
              <option value="marked-for-decommissioning">{{ 'apps.form.status_opt.decommissioning' | translate }}</option>
              <option value="failed">{{ 'apps.form.status_opt.failed' | translate }}</option>
            </select>
          </label>
          <label class="edit-field" style="grid-column:1 / -1">
            <span>{{ 'apps.form.description' | translate }}</span>
            <input class="value-input" type="text" [(ngModel)]="f.description" [placeholder]="'apps.form.description_placeholder' | translate" />
          </label>
        </div>

        <div class="edit-section-title" style="margin-top:1rem">{{ 'apps.form.section_tags' | translate }}</div>
        <div class="edit-grid">
          <label class="edit-field">
            <span>{{ 'apps.form.criticality' | translate }}</span>
            <select class="value-input" [(ngModel)]="f.criticality">
              <option value="">—</option>
              <option value="critical">{{ 'apps.form.crit.critical' | translate }}</option>
              <option value="high">{{ 'apps.form.crit.high' | translate }}</option>
              <option value="medium">{{ 'apps.form.crit.medium' | translate }}</option>
              <option value="low">{{ 'apps.form.crit.low' | translate }}</option>
            </select>
          </label>
          <label class="edit-field">
            <span>{{ 'apps.form.pillar' | translate }}</span>
            <input class="value-input" type="text" [(ngModel)]="f.pillar" [placeholder]="'apps.form.pillar_placeholder' | translate" />
          </label>
        </div>

        <div class="edit-section-title" style="margin-top:1rem">{{ 'apps.form.section_java' | translate }}</div>
        <div class="edit-grid">
          <label class="edit-field">
            <span>{{ 'apps.form.java_version' | translate }}</span>
            <input class="value-input" type="text" [(ngModel)]="f.javaVersion" [placeholder]="'apps.form.java_version_placeholder' | translate" />
          </label>
          <label class="edit-field">
            <span>{{ 'apps.form.compliance' | translate }}</span>
            <select class="value-input" [(ngModel)]="f.javaComplianceStatus">
              <option value="">—</option>
              <option value="compliant">{{ 'apps.form.compliance_opt.compliant' | translate }}</option>
              <option value="non-compliant">{{ 'apps.form.compliance_opt.non_compliant' | translate }}</option>
              <option value="exempt">{{ 'apps.form.compliance_opt.exempt' | translate }}</option>
            </select>
          </label>
        </div>

        <div class="edit-section-title" style="margin-top:1rem">{{ 'apps.form.section_tools' | translate }}</div>
        <div class="edit-grid">
          <label class="edit-field">
            <span>{{ 'apps.form.artifactory_url' | translate }}</span>
            <input class="value-input" type="url" [(ngModel)]="f.artifactoryUrl" placeholder="https://…" />
          </label>
          <label class="edit-field">
            <span>{{ 'apps.form.xray_url' | translate }}</span>
            <input class="value-input" type="url" [(ngModel)]="f.xrayUrl" placeholder="https://…" />
          </label>
          <label class="edit-field">
            <span>{{ 'apps.form.composition_url' | translate }}</span>
            <input class="value-input" type="url" [(ngModel)]="f.compositionViewerUrl" placeholder="https://…" />
          </label>
          <label class="edit-field">
            <span>{{ 'apps.form.splunk_url' | translate }}</span>
            <input class="value-input" type="url" [(ngModel)]="f.splunkUrl" placeholder="https://…" />
          </label>
        </div>

        <div class="edit-section-title" style="margin-top:1rem">{{ 'apps.form.section_probes' | translate }}</div>
        <div class="edit-grid">
          <label class="edit-field">
            <span>{{ 'apps.form.health' | translate }}</span>
            <input class="value-input" type="text" [(ngModel)]="f.probeHealth" placeholder="/actuator/health" />
          </label>
          <label class="edit-field">
            <span>{{ 'apps.form.liveness' | translate }}</span>
            <input class="value-input" type="text" [(ngModel)]="f.probeLiveness" placeholder="/actuator/health/liveness" />
          </label>
          <label class="edit-field">
            <span>{{ 'apps.form.readiness' | translate }}</span>
            <input class="value-input" type="text" [(ngModel)]="f.probeReadiness" placeholder="/actuator/health/readiness" />
          </label>
          <label class="edit-field">
            <span>{{ 'apps.form.info' | translate }}</span>
            <input class="value-input" type="text" [(ngModel)]="f.probeInfo" placeholder="/actuator/info" />
          </label>
        </div>

        <div class="edit-section-title" style="margin-top:1rem">{{ 'apps.form.section_docs' | translate }}</div>
        <div class="repeater-stack">
          <app-link-repeater [label]="'apps.links.jira' | translate"        urlPlaceholder="https://jira.example.com/projects/…"
            [links]="f.jira"        (linksChange)="f.jira = $event"></app-link-repeater>
          <app-link-repeater [label]="'apps.links.confluence' | translate"  urlPlaceholder="https://confluence.example.com/display/…"
            [links]="f.confluence"  (linksChange)="f.confluence = $event"></app-link-repeater>
          <app-link-repeater [label]="'apps.links.github' | translate"      urlPlaceholder="https://github.com/org/repo"
            [links]="f.github"      (linksChange)="f.github = $event"></app-link-repeater>
          <app-link-repeater [label]="'apps.links.mailing_list' | translate" urlPlaceholder="team@example.com"
            [links]="f.mailingList" (linksChange)="f.mailingList = $event"></app-link-repeater>
          <app-link-repeater [label]="'apps.links.links' | translate" urlPlaceholder="https://confluence.example.com/page"
            [links]="f.links" (linksChange)="f.links = $event"></app-link-repeater>
        </div>

        <div class="form-actions" style="margin-top:1.5rem">
          <button class="btn btn-primary" [disabled]="saving || !f.appId || !f.squadId" (click)="submit()">
            @if (saving) { <span class="spinner"></span> } {{ 'apps.form.register' | translate }}
          </button>
          <a class="btn btn-ghost" routerLink="/apps">{{ 'common.cancel' | translate }}</a>
        </div>
      </div>
    }
  `,
  styles: [`
    .breadcrumb { display: flex; align-items: center; gap: 4px; }
    .crumb { font-size: 0.82rem; color: var(--text-muted); }
    .crumb-link { color: var(--blue-600); text-decoration: none; }
    .crumb-link:hover { text-decoration: underline; }
    .crumb-sep { color: var(--border); }
    .alert-error { margin: 0.5rem 0 1rem; padding: 0.6rem 0.9rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #991b1b; font-size: 0.85rem; }
    .edit-form { padding: 1.5rem; max-width: 860px; }
    .edit-section-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 0.6rem; }
    .repeater-stack { display: flex; flex-direction: column; gap: 14px; }
    .edit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
    .edit-field { display: flex; flex-direction: column; gap: 4px; }
    .edit-field span { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
    .edit-field span.field-hint { font-size: 0.7rem; color: var(--text-muted); font-style: italic; text-transform: none; letter-spacing: 0; font-weight: 400; }
    .required { color: var(--danger, #e53e3e); }
    .form-actions { display: flex; gap: 10px; align-items: center; padding-top: 1rem; border-top: 1px solid var(--border); }
  `],
})
export class AppFormComponent implements OnInit {
  private appsApi  = inject(AppsApi);
  private squadApi = inject(SquadApi);
  private router   = inject(Router);
  private i18n     = inject(TranslateService);

  squads:  Squad[] = [];
  loading  = true;
  saving   = false;
  error    = '';

  f = {
    appId: '', squadId: '', status: 'active' as const, description: '',
    criticality: '', pillar: '',
    javaVersion: '', javaComplianceStatus: '',
    artifactoryUrl: '', xrayUrl: '', compositionViewerUrl: '', splunkUrl: '',
    probeHealth: '', probeInfo: '', probeLiveness: '', probeReadiness: '',
    jira:        [] as Link[],
    confluence:  [] as Link[],
    github:      [] as Link[],
    mailingList: [] as Link[],
    links:       [] as Link[],
  };

  async ngOnInit() {
    this.squads = await firstValueFrom(this.squadApi.getAll());
    this.loading = false;
  }

  async submit() {
    this.saving = true;
    this.error = '';
    try {
      const tags: Record<string, string> = {};
      if (this.f.criticality) tags['criticality'] = this.f.criticality;
      if (this.f.pillar)      tags['pillar']      = this.f.pillar;

      const payload: Record<string, unknown> = {
        appId:                this.f.appId.trim(),
        squadId:              this.f.squadId,
        status:               this.f.status,
        description:          this.f.description,
        tags,
        ...(this.f.jira.length        ? { jira:        this.f.jira }        : {}),
        ...(this.f.confluence.length  ? { confluence:  this.f.confluence }  : {}),
        ...(this.f.github.length      ? { github:      this.f.github }      : {}),
        ...(this.f.mailingList.length ? { mailingList: this.f.mailingList } : {}),
        ...(this.f.links.length       ? { links:       this.f.links }       : {}),
        ...(this.f.javaVersion          ? { javaVersion:          this.f.javaVersion }          : {}),
        ...(this.f.javaComplianceStatus ? { javaComplianceStatus: this.f.javaComplianceStatus } : {}),
        ...(this.f.artifactoryUrl       ? { artifactoryUrl:       this.f.artifactoryUrl }       : {}),
        ...(this.f.xrayUrl              ? { xrayUrl:              this.f.xrayUrl }              : {}),
        ...(this.f.compositionViewerUrl ? { compositionViewerUrl: this.f.compositionViewerUrl } : {}),
        ...(this.f.splunkUrl            ? { splunkUrl:            this.f.splunkUrl }            : {}),
        ...(this.f.probeHealth          ? { probeHealth:          this.f.probeHealth }          : {}),
        ...(this.f.probeInfo            ? { probeInfo:            this.f.probeInfo }            : {}),
        ...(this.f.probeLiveness        ? { probeLiveness:        this.f.probeLiveness }        : {}),
        ...(this.f.probeReadiness       ? { probeReadiness:       this.f.probeReadiness }       : {}),
      };

      const created = await firstValueFrom(this.appsApi.createApp(payload));
      this.router.navigate(['/apps', created.appId]);
    } catch (err: any) {
      const apiErr  = err?.error?.error ?? '';
      const details = err?.error?.details;
      const detail  = details && typeof details === 'object'
        ? Object.entries(details).map(([k, v]) => `${k}: ${(v as string[])?.join('; ') ?? v}`).join(' • ')
        : '';
      this.error = [apiErr, detail].filter(Boolean).join(' — ') || this.i18n.instant('apps.form.register_failed');
    } finally {
      this.saving = false;
    }
  }
}
