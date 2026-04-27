import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { featureFlagGuard } from './feature-flag.guard';
import { FeatureFlagsService } from './feature-flags.service';

describe('featureFlagGuard', () => {
  let flagsSpy: jasmine.SpyObj<FeatureFlagsService>;
  let routerSpy: jasmine.SpyObj<Router>;
  const orgTree = {} as any;

  beforeEach(() => {
    flagsSpy = jasmine.createSpyObj('FeatureFlagsService', ['isEnabled']);
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(orgTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: FeatureFlagsService, useValue: flagsSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('returns true when flag is enabled', () => {
    flagsSpy.isEnabled.and.returnValue(true);
    const guard = featureFlagGuard('appRegistry');
    const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBeTrue();
    expect(flagsSpy.isEnabled).toHaveBeenCalledWith('appRegistry');
  });

  it('returns UrlTree when flag is disabled', () => {
    flagsSpy.isEnabled.and.returnValue(false);
    const guard = featureFlagGuard('appRegistry');
    const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBe(orgTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/org']);
  });
});
