/**
 * Purpose: Client-side feature flag store, persisted to localStorage.
 * Usage:   `isEnabled(flag)` is read by guards, components and templates; the admin feature-flags page calls `enable / disable / toggle`.
 * Goal:    Allow per-user runtime toggling of UI features (currently `appRegistry`) without a backend round-trip.
 * ToDo:    Sync flags across browser tabs via the storage event.
 */
import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export type FeatureFlag = keyof typeof environment.featureFlags;

@Injectable({ providedIn: 'root' })
export class FeatureFlagsService {
  private flags = signal({ ...environment.featureFlags });

  isEnabled(flag: FeatureFlag): boolean {
    return this.flags()[flag];
  }

  enable(flag: FeatureFlag)  { this.flags.update((f) => ({ ...f, [flag]: true })); }
  disable(flag: FeatureFlag) { this.flags.update((f) => ({ ...f, [flag]: false })); }
  toggle(flag: FeatureFlag)  { this.flags.update((f) => ({ ...f, [flag]: !f[flag] })); }

  readonly all = this.flags.asReadonly();
}
