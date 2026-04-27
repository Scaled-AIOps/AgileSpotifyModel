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
import { AppsApi } from '../../../core/api/apps.api';
import { SquadApi } from '../../../core/api/squad.api';
import { LinkRepeaterComponent } from '../../../shared/link-repeater/link-repeater.component';
import type { Squad, Link } from '../../../core/models/index';

@Component({
  selector: 'app-app-form',
  standalone: true,
  imports: [RouterLink, FormsModule, LinkRepeaterComponent],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title">
          <h1>Register Application</h1>
          <div class="page-sub breadcrumb">
            <a class="crumb crumb-link" routerLink="/apps">Applications</a>
            <span class="crumb-sep">›</span>
            <span class="crumb">New</span>
          </div>
        </div>
      </div>

      @if (error) { <div class="alert-error">{{ error }}</div> }

      <div class="edit-form card">
        <div class="edit-section-title">Identity</div>
        <div class="edit-grid">
          <label class="edit-field">
            <span>App ID <span class="required">*</span></span>
            <input class="value-input" type="text" [(ngModel)]="f.appId"
                   placeholder="e.g. payments-api" pattern="[a-z0-9-]+" />
            <span class="field-hint">Lowercase letters, numbers, hyphens only</span>
          </label>
          <label class="edit-field">
            <span>Squad <span class="required">*</span></span>
            <select class="value-input" [(ngModel)]="f.squadId">
              <option value="">— select squad —</option>
              @for (s of squads; track s.id) {
                <option [value]="s.id">{{ s.name }}</option>
              }
            </select>
          </label>
          <label class="edit-field">
            <span>Status</span>
            <select class="value-input" [(ngModel)]="f.status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="marked-for-decommissioning">Decommissioning</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label class="edit-field" style="grid-column:1 / -1">
            <span>Description</span>
            <input class="value-input" type="text" [(ngModel)]="f.description" placeholder="Short description of what this app does" />
          </label>
        </div>

        <div class="edit-section-title" style="margin-top:1rem">Tags</div>
        <div class="edit-grid">
          <label class="edit-field">
            <span>Criticality</span>
            <select class="value-input" [(ngModel)]="f.criticality">
              <option value="">—</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label class="edit-field">
            <span>Pillar</span>
            <input class="value-input" type="text" [(ngModel)]="f.pillar" placeholder="e.g. platform" />
          </label>
        </div>

        <div class="edit-section-title" style="margin-top:1rem">Java</div>
        <div class="edit-grid">
          <label class="edit-field">
            <span>Java Version</span>
            <input class="value-input" type="text" [(ngModel)]="f.javaVersion" placeholder="e.g. 17" />
          </label>
          <label class="edit-field">
            <span>Compliance</span>
            <select class="value-input" [(ngModel)]="f.javaComplianceStatus">
              <option value="">—</option>
              <option value="compliant">Compliant</option>
              <option value="non-compliant">Non-compliant</option>
              <option value="exempt">Exempt</option>
            </select>
          </label>
        </div>

        <div class="edit-section-title" style="margin-top:1rem">Tool Links</div>
        <div class="edit-grid">
          <label class="edit-field">
            <span>Artifactory URL</span>
            <input class="value-input" type="url" [(ngModel)]="f.artifactoryUrl" placeholder="https://…" />
          </label>
          <label class="edit-field">
            <span>X-Ray URL</span>
            <input class="value-input" type="url" [(ngModel)]="f.xrayUrl" placeholder="https://…" />
          </label>
          <label class="edit-field">
            <span>Composition Viewer URL</span>
            <input class="value-input" type="url" [(ngModel)]="f.compositionViewerUrl" placeholder="https://…" />
          </label>
          <label class="edit-field">
            <span>Splunk Logs URL</span>
            <input class="value-input" type="url" [(ngModel)]="f.splunkUrl" placeholder="https://…" />
          </label>
        </div>

        <div class="edit-section-title" style="margin-top:1rem">Health Probes</div>
        <div class="edit-grid">
          <label class="edit-field">
            <span>Health</span>
            <input class="value-input" type="text" [(ngModel)]="f.probeHealth" placeholder="/actuator/health" />
          </label>
          <label class="edit-field">
            <span>Liveness</span>
            <input class="value-input" type="text" [(ngModel)]="f.probeLiveness" placeholder="/actuator/health/liveness" />
          </label>
          <label class="edit-field">
            <span>Readiness</span>
            <input class="value-input" type="text" [(ngModel)]="f.probeReadiness" placeholder="/actuator/health/readiness" />
          </label>
          <label class="edit-field">
            <span>Info</span>
            <input class="value-input" type="text" [(ngModel)]="f.probeInfo" placeholder="/actuator/info" />
          </label>
        </div>

        <div class="edit-section-title" style="margin-top:1rem">Documentation & Repos</div>
        <div class="repeater-stack">
          <app-link-repeater label="Jira"        urlPlaceholder="https://jira.example.com/projects/…"
            [links]="f.jira"        (linksChange)="f.jira = $event"></app-link-repeater>
          <app-link-repeater label="Confluence"  urlPlaceholder="https://confluence.example.com/display/…"
            [links]="f.confluence"  (linksChange)="f.confluence = $event"></app-link-repeater>
          <app-link-repeater label="GitHub"      urlPlaceholder="https://github.com/org/repo"
            [links]="f.github"      (linksChange)="f.github = $event"></app-link-repeater>
          <app-link-repeater label="Mailing list" urlPlaceholder="team@example.com"
            [links]="f.mailingList" (linksChange)="f.mailingList = $event"></app-link-repeater>
        </div>

        <div class="form-actions" style="margin-top:1.5rem">
          <button class="btn btn-primary" [disabled]="saving || !f.appId || !f.squadId" (click)="submit()">
            @if (saving) { <span class="spinner"></span> } Register App
          </button>
          <a class="btn btn-ghost" routerLink="/apps">Cancel</a>
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
    .field-hint { font-size: 0.7rem; color: var(--text-muted); font-style: italic; text-transform: none; letter-spacing: 0; font-weight: 400; }
    .required { color: var(--danger, #e53e3e); }
    .form-actions { display: flex; gap: 10px; align-items: center; padding-top: 1rem; border-top: 1px solid var(--border); }
  `],
})
export class AppFormComponent implements OnInit {
  private appsApi  = inject(AppsApi);
  private squadApi = inject(SquadApi);
  private router   = inject(Router);

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
      this.error = err?.error?.error ?? 'Failed to register app. Please try again.';
    } finally {
      this.saving = false;
    }
  }
}
