import { TestBed } from '@angular/core/testing';
import { FeatureFlagsComponent } from './feature-flags.component';
import { FeatureFlagsService } from '../../../core/feature-flags/feature-flags.service';

describe('FeatureFlagsComponent', () => {
  let svcSpy: jasmine.SpyObj<FeatureFlagsService>;

  beforeEach(async () => {
    svcSpy = jasmine.createSpyObj('FeatureFlagsService', ['isEnabled', 'toggle', 'enable', 'disable'], {
      all: () => ({ workTracking: false, appRegistry: true }),
    });
    svcSpy.isEnabled.and.returnValue(false);

    await TestBed.configureTestingModule({
      imports: [FeatureFlagsComponent],
      providers: [{ provide: FeatureFlagsService, useValue: svcSpy }],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(FeatureFlagsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
