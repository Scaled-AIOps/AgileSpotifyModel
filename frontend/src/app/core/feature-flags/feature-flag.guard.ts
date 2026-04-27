import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { FeatureFlagsService, FeatureFlag } from './feature-flags.service';

export function featureFlagGuard(flag: FeatureFlag): CanActivateFn {
  return () => {
    const enabled = inject(FeatureFlagsService).isEnabled(flag);
    return enabled || inject(Router).createUrlTree(['/org']);
  };
}
