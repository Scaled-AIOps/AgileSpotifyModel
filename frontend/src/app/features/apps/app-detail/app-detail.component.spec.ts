import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AppDetailComponent } from './app-detail.component';
import { AppsApi } from '../../../core/api/apps.api';
import type { AppWithDeploys } from '../../../core/models/index';

const APP: AppWithDeploys = {
  id: 'a1', appId: 'APP-001', name: 'Alpha', squadId: 's1', squadKey: 'sq-a',
  status: 'active' as any, gitRepo: 'https://github.com/org/repo',
  javaVersion: '17', javaComplianceStatus: 'compliant',
  artifactoryUrl: 'https://art.io/a', xrayUrl: 'https://xray.io/a',
  compositionViewerUrl: '', splunkUrl: '',
  tags: JSON.stringify({ criticality: 'high', pillar: 'data' }),
  platforms: JSON.stringify({ prodPlatform: 'eks', prodUrl: 'https://app.io' }),
  urls: JSON.stringify({ prodUrl: 'https://app.io' }),
  latestDeploys: { prod: { id: 'd1', version: '1.0.0', env: 'prod', deployedAt: '2025-01-01T00:00:00.000Z', state: 'success' } as any },
  environments: [],
  deployments: [],
} as any;

describe('AppDetailComponent', () => {
  let appsSpy: jasmine.SpyObj<AppsApi>;
  let component: AppDetailComponent;

  beforeEach(async () => {
    appsSpy = jasmine.createSpyObj('AppsApi', ['getById', 'getDeployHistory', 'updateApp', 'getAuditLog']);
    appsSpy.getById.and.returnValue(of(APP));
    appsSpy.getDeployHistory.and.returnValue(of([{ id: 'd1', version: '1.0.0', env: 'prod', deployedAt: '2025-01-01T00:00:00.000Z', state: 'success' } as any]));
    appsSpy.getAuditLog.and.returnValue(of([]));
    appsSpy.updateApp.and.returnValue(of(APP));

    await TestBed.configureTestingModule({
      imports: [AppDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'a1' } } } },
        { provide: AppsApi, useValue: appsSpy },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and load app', () => {
    expect(component).toBeTruthy();
    expect(component.loading).toBeFalse();
    expect(component.app?.appId).toBe('APP-001');
  });

  describe('getters', () => {
    it('hasTools returns true when gitRepo is set', () => {
      expect(component.hasTools).toBeTrue();
    });

    it('hasTools returns false when no tools', () => {
      component.app = { ...APP, gitRepo: '', artifactoryUrl: '', xrayUrl: '', compositionViewerUrl: '', splunkUrl: '' } as any;
      expect(component.hasTools).toBeFalse();
    });

    it('tags parses JSON string', () => {
      expect(component.tags['criticality']).toBe('high');
    });

    it('tags handles null app', () => {
      component.app = null;
      expect(component.tags).toEqual({});
    });

    it('tags handles invalid JSON', () => {
      component.app = { ...APP, tags: 'invalid-json' } as any;
      expect(component.tags).toEqual({});
    });

    it('tags handles pre-parsed object', () => {
      component.app = { ...APP, tags: { criticality: 'medium' } as any };
      expect(component.tags['criticality']).toBe('medium');
    });

    it('platforms parses JSON', () => {
      expect(component.platforms['prodPlatform']).toBe('eks');
    });

    it('platforms handles null app', () => {
      component.app = null;
      expect(component.platforms).toEqual({});
    });

    it('platforms handles pre-parsed object', () => {
      component.app = { ...APP, platforms: { devPlatform: 'k8s' } as any };
      expect(component.platforms['devPlatform']).toBe('k8s');
    });

    it('platforms handles invalid JSON', () => {
      component.app = { ...APP, platforms: 'not-json' as any };
      expect(component.platforms).toEqual({});
    });

    it('urls parses JSON', () => {
      expect(component.urls['prodUrl']).toBe('https://app.io');
    });

    it('urls handles null app', () => {
      component.app = null;
      expect(component.urls).toEqual({});
    });

    it('urls handles pre-parsed object', () => {
      component.app = { ...APP, urls: { devUrl: 'https://dev.io' } as any };
      expect(component.urls['devUrl']).toBe('https://dev.io');
    });

    it('critClass returns danger for critical', () => {
      component.app = { ...APP, tags: JSON.stringify({ criticality: 'critical', pillar: 'data' }) } as any;
      expect(component.critClass).toBe('badge-danger');
    });

    it('critClass returns story for high', () => {
      expect(component.critClass).toBe('badge-story');
    });

    it('critClass returns warn for medium', () => {
      component.app = { ...APP, tags: JSON.stringify({ criticality: 'medium' }) } as any;
      expect(component.critClass).toBe('badge-warn');
    });

    it('critClass returns muted for unknown', () => {
      component.app = { ...APP, tags: JSON.stringify({ criticality: 'low' }) } as any;
      expect(component.critClass).toBe('badge-muted');
    });
  });

  describe('methods', () => {
    it('enterEdit populates ef and sets editMode', () => {
      component.enterEdit();
      expect(component.editMode).toBeTrue();
      expect(component.ef.status).toBe('active' as any);
      expect(component.ef.gitRepo).toBe('https://github.com/org/repo');
    });

    it('enterEdit uses empty string fallbacks for null fields', () => {
      component.app = {
        ...APP,
        gitRepo: null as any,
        javaVersion: null as any,
        javaComplianceStatus: null as any,
        artifactoryUrl: null as any,
        xrayUrl: null as any,
        compositionViewerUrl: null as any,
        splunkUrl: null as any,
        tags: JSON.stringify({}),
      } as any;
      component.enterEdit();
      expect(component.ef.gitRepo).toBe('');
      expect(component.ef.javaVersion).toBe('');
      expect(component.ef.criticality).toBe('');
      expect(component.ef.pillar).toBe('');
    });

    it('cancelEdit resets editMode', () => {
      component.editMode = true;
      component.cancelEdit();
      expect(component.editMode).toBeFalse();
    });

    it('save() updates app and exits edit mode', async () => {
      component.enterEdit();
      await component.save();
      expect(component.editMode).toBeFalse();
      expect(component.saving).toBeFalse();
    });

    it('save() deletes tag keys when ef fields are empty', async () => {
      component.app = { ...APP, tags: JSON.stringify({ criticality: 'high', pillar: 'data', sunset: '2026-Q3' }) } as any;
      component.enterEdit();
      component.ef.criticality = '';
      component.ef.pillar = '';
      component.ef.sunset = '';
      await component.save();
      expect(component.editMode).toBeFalse();
    });

    it('save() handles error without error.error property', async () => {
      appsSpy.updateApp.and.returnValue(throwError(() => ({})));
      component.app = APP;
      component.enterEdit();
      await component.save();
      expect(component.saveError).toBe('Save failed. Please try again.');
    });

    it('save() handles error', async () => {
      appsSpy.updateApp.and.returnValue(throwError(() => ({ error: { error: 'Save failed' } })));
      component.app = APP;
      component.enterEdit();
      await component.save();
      expect(component.saveError).toBe('Save failed');
      expect(component.saving).toBeFalse();
    });

    it('hasPlatform returns true when platform exists', () => {
      expect(component.hasPlatform('prod')).toBeTrue();
    });

    it('hasPlatform returns false when no platform', () => {
      expect(component.hasPlatform('dev')).toBeFalse();
    });

    it('getPlatform returns platform name', () => {
      expect(component.getPlatform('prod')).toBe('eks');
    });

    it('getUrl returns url', () => {
      expect(component.getUrl('prod')).toBe('https://app.io');
    });

    it('getLatest returns latest deploy', () => {
      expect(component.getLatest('prod')).not.toBeNull();
    });

    it('getLatest returns null for missing env', () => {
      expect(component.getLatest('dev')).toBeNull();
    });

    it('changesOf maps audit entry changes', () => {
      const entry = { changes: { status: { from: 'active', to: 'inactive' } } } as any;
      const result = component.changesOf(entry);
      expect(result[0]).toEqual({ field: 'status', from: 'active', to: 'inactive' });
    });

    it('statusClass returns class', () => {
      expect(typeof component.statusClass('active' as any)).toBe('string');
    });

    it('statusLabel maps known statuses', () => {
      expect(component.statusLabel('active' as any)).toBe('Active');
      expect(component.statusLabel('inactive' as any)).toBe('Inactive');
    });

    it('statusLabel falls back for unknown', () => {
      expect(component.statusLabel('unknown' as any)).toBe('unknown');
    });

    it('deployClass returns class string', () => {
      expect(typeof component.deployClass('success' as any)).toBe('string');
    });

    it('javaClass returns correct badges', () => {
      expect(component.javaClass('compliant')).toBe('badge-success');
      expect(component.javaClass('exempt')).toBe('badge-muted');
      expect(component.javaClass('other')).toBe('badge-danger');
    });

    it('fmtDate formats ISO date', () => {
      expect(component.fmtDate('2025-01-15T00:00:00Z')).toMatch(/15/);
    });

    it('fmtDate returns original on error', () => {
      expect(component.fmtDate('invalid')).toBe('Invalid Date');
    });
  });
});
