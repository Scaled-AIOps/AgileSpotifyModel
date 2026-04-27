/**
 * Purpose: Functional CanActivate guard tied to FeatureFlagsService.
 * Usage:   Used as `canActivate: [featureFlagGuard('flagName')]`. Redirects to /org when the flag is disabled.
 * Goal:    Hide entire route trees behind a feature flag, preventing direct-URL access to disabled features.
 * ToDo:    —
 */
import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { FeatureFlagsService, FeatureFlag } from './feature-flags.service';

export function featureFlagGuard(flag: FeatureFlag): CanActivateFn {
  return () => {
    const enabled = inject(FeatureFlagsService).isEnabled(flag);
    return enabled || inject(Router).createUrlTree(['/org']);
  };
}
