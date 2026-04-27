import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AppFormComponent } from './app-form.component';
import { AppsApi } from '../../../core/api/apps.api';
import { SquadApi } from '../../../core/api/squad.api';

describe('AppFormComponent', () => {
  let appsSpy: jasmine.SpyObj<AppsApi>;
  let squadSpy: jasmine.SpyObj<SquadApi>;
  let component: AppFormComponent;

  beforeEach(async () => {
    appsSpy = jasmine.createSpyObj('AppsApi', ['createApp', 'updateApp', 'getById', 'getAllClusters']);
    squadSpy = jasmine.createSpyObj('SquadApi', ['getAll']);
    squadSpy.getAll.and.returnValue(of([{ id: 's1', name: 'Squad A' } as any]));
    appsSpy.createApp.and.returnValue(of({ id: 'a1', appId: 'APP-001' } as any));
    appsSpy.getAllClusters.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [AppFormComponent],
      providers: [
        provideRouter([]),
        { provide: AppsApi, useValue: appsSpy },
        { provide: SquadApi, useValue: squadSpy },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and load squads', () => {
    expect(component).toBeTruthy();
    expect(component.loading).toBeFalse();
    expect(component.squads.length).toBe(1);
  });

  it('submit() creates app with minimal fields and navigates', async () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component.f.appId = 'APP-TEST';
    component.f.squadId = 's1';
    await component.submit();
    expect(appsSpy.createApp).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/apps', 'APP-001']);
    expect(component.saving).toBeFalse();
  });

  it('submit() with all optional fields populated', async () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    component.f = {
      appId: 'APP-FULL', squadId: 's1', status: 'active', description: 'Full app',
      criticality: 'high', pillar: 'data',
      javaVersion: '17', javaComplianceStatus: 'compliant',
      artifactoryUrl: 'https://art', xrayUrl: 'https://xray',
      compositionViewerUrl: 'https://cv', splunkUrl: 'https://splunk',
      probeHealth: '/health', probeInfo: '/info',
      probeLiveness: '/live', probeReadiness: '/ready',
      jira: [], confluence: [],
      github: [{ url: 'https://github.com/repo', description: '' }],
      mailingList: [],
    };
    await component.submit();
    expect(appsSpy.createApp).toHaveBeenCalledWith(jasmine.objectContaining({
      github: [{ url: 'https://github.com/repo', description: '' }],
      javaVersion: '17',
    }));
  });

  it('submit() handles error', async () => {
    appsSpy.createApp.and.returnValue(throwError(() => ({ error: { error: 'Duplicate app ID' } })));
    component.f.appId = 'dup';
    await component.submit();
    expect(component.error).toBe('Duplicate app ID');
    expect(component.saving).toBeFalse();
  });

  it('submit() uses fallback error message', async () => {
    appsSpy.createApp.and.returnValue(throwError(() => ({})));
    component.f.appId = 'x';
    await component.submit();
    expect(component.error).toBe('Failed to register app. Please try again.');
  });
});
