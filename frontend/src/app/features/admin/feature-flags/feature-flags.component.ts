import { Component, inject } from '@angular/core';
import { FeatureFlagsService, FeatureFlag } from '../../../core/feature-flags/feature-flags.service';

interface FlagMeta { key: FeatureFlag; label: string; description: string; }

const FLAG_META: FlagMeta[] = [
  { key: 'workTracking', label: 'Work Tracking',  description: 'Backlog management and sprint boards for squads.' },
  { key: 'appRegistry',  label: 'Applications',   description: 'Application catalogue, infra cluster view, and deployment history per squad.' },
];

@Component({
  selector: 'app-feature-flags',
  standalone: true,
  imports: [],
  template: `
    <div class="page-header">
      <div class="page-title">
        <h1>Feature Flags</h1>
        <div class="page-sub">Toggle features on or off. Changes take effect immediately and reset on page reload.</div>
      </div>
    </div>

    <div class="card" style="max-width:640px">
      <table class="table">
        <thead><tr><th>Feature</th><th>Description</th><th style="text-align:right">Status</th></tr></thead>
        <tbody>
          @for (f of flags; track f.key) {
            <tr>
              <td style="font-weight:600;white-space:nowrap">{{ f.label }}</td>
              <td style="color:var(--text-muted);font-size:0.875rem">{{ f.description }}</td>
              <td style="text-align:right;white-space:nowrap">
                <button
                  class="toggle-btn"
                  [class.on]="svc.isEnabled(f.key)"
                  (click)="svc.toggle(f.key)"
                  [attr.aria-label]="'Toggle ' + f.label">
                  <span class="toggle-track">
                    <span class="toggle-thumb"></span>
                  </span>
                  <span class="toggle-label">{{ svc.isEnabled(f.key) ? 'On' : 'Off' }}</span>
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    .toggle-btn { display: inline-flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; padding: 0; }
    .toggle-track { width: 40px; height: 22px; border-radius: 999px; background: var(--border); position: relative; transition: background 150ms; display: block; }
    .toggle-btn.on .toggle-track { background: var(--blue-500); }
    .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: transform 150ms; display: block; }
    .toggle-btn.on .toggle-thumb { transform: translateX(18px); }
    .toggle-label { font-size: 0.82rem; font-weight: 600; color: var(--text-muted); width: 24px; }
    .toggle-btn.on .toggle-label { color: var(--blue-600); }
  `],
})
export class FeatureFlagsComponent {
  readonly svc = inject(FeatureFlagsService);
  readonly flags = FLAG_META;
}
