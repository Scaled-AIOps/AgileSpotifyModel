import { TestBed } from '@angular/core/testing';
import { FeatureFlagsService } from './feature-flags.service';
import { environment } from '../../../environments/environment';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FeatureFlagsService] });
    service = TestBed.inject(FeatureFlagsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('isEnabled returns the initial flag value from environment', () => {
    const flags = environment.featureFlags;
    for (const [key, value] of Object.entries(flags)) {
      expect(service.isEnabled(key as any)).toBe(value);
    }
  });

  it('enable sets a flag to true', () => {
    service.disable('workTracking');
    service.enable('workTracking');
    expect(service.isEnabled('workTracking')).toBeTrue();
  });

  it('disable sets a flag to false', () => {
    service.enable('workTracking');
    service.disable('workTracking');
    expect(service.isEnabled('workTracking')).toBeFalse();
  });

  it('toggle flips a flag', () => {
    const initial = service.isEnabled('workTracking');
    service.toggle('workTracking');
    expect(service.isEnabled('workTracking')).toBe(!initial);
    service.toggle('workTracking');
    expect(service.isEnabled('workTracking')).toBe(initial);
  });

  it('all signal returns all current flags', () => {
    const all = service.all();
    expect(all).toBeDefined();
    expect(typeof all).toBe('object');
  });

  it('all signal reflects updates', () => {
    service.enable('workTracking');
    expect(service.all()['workTracking']).toBeTrue();
    service.disable('workTracking');
    expect(service.all()['workTracking']).toBeFalse();
  });
});
