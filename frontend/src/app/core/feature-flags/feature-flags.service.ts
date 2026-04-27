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
