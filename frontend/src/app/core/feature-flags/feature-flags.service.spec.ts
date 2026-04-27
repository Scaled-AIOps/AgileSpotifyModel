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
    service.disable('appRegistry');
    service.enable('appRegistry');
    expect(service.isEnabled('appRegistry')).toBeTrue();
  });

  it('disable sets a flag to false', () => {
    service.enable('appRegistry');
    service.disable('appRegistry');
    expect(service.isEnabled('appRegistry')).toBeFalse();
  });

  it('toggle flips a flag', () => {
    const initial = service.isEnabled('appRegistry');
    service.toggle('appRegistry');
    expect(service.isEnabled('appRegistry')).toBe(!initial);
    service.toggle('appRegistry');
    expect(service.isEnabled('appRegistry')).toBe(initial);
  });

  it('all signal returns all current flags', () => {
    const all = service.all();
    expect(all).toBeDefined();
    expect(typeof all).toBe('object');
  });

  it('all signal reflects updates', () => {
    service.enable('appRegistry');
    expect(service.all()['appRegistry']).toBeTrue();
    service.disable('appRegistry');
    expect(service.all()['appRegistry']).toBeFalse();
  });
});
