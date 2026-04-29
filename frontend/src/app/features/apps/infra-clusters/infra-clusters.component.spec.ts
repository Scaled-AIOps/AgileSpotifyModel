import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { InfraClustersComponent } from './infra-clusters.component';
import { AppsApi } from '../../../core/api/apps.api';
import type { InfraCluster } from '../../../core/models/index';

const CLUSTERS: InfraCluster[] = [
  { id: 'c1', platformId: 'eks-prod', name: 'EKS Prod', environment: 'prod', host: 'eks.prod.io', platform: 'eks', tags: JSON.stringify({ criticality: 'high' }) } as any,
  { id: 'c2', platformId: 'eks-dev', name: 'EKS Dev', environment: 'dev', host: 'eks.dev.io', platform: 'eks', tags: null } as any,
];

describe('InfraClustersComponent', () => {
  let appsSpy: jasmine.SpyObj<AppsApi>;
  let component: InfraClustersComponent;

  beforeEach(async () => {
    appsSpy = jasmine.createSpyObj('AppsApi', ['getAllClusters', 'getCluster']);
    appsSpy.getAllClusters.and.returnValue(of(CLUSTERS));

    await TestBed.configureTestingModule({
      imports: [InfraClustersComponent],
      providers: [
        provideRouter([]),
        { provide: AppsApi, useValue: appsSpy },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(InfraClustersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and load clusters', () => {
    expect(component).toBeTruthy();
    expect(component.loading).toBeFalse();
    expect(component.clusters.length).toBe(2);
    expect(component.envs).toContain('prod');
    expect(component.envs).toContain('dev');
  });

  it('filtered shows all by default', () => {
    expect(component.filtered.length).toBe(2);
  });

  it('applyFilter filters by query', () => {
    component.query = 'prod';
    component.applyFilter();
    expect(component.filtered.length).toBe(1);
    expect(component.filtered[0].platformId).toBe('eks-prod');
  });

  it('applyFilter filters by environment', () => {
    component.setEnv('dev');
    expect(component.filtered.length).toBe(1);
  });

  it('setEnv resets to null shows all', () => {
    component.setEnv(null);
    expect(component.filtered.length).toBe(2);
  });

  it('clearQuery resets query and refreshes filter', () => {
    component.query = 'test';
    component.clearQuery();
    expect(component.query).toBe('');
  });

  it('envClass returns class for known env', () => {
    expect(typeof component.envClass('prod')).toBe('string');
  });

  it('envClass returns muted for unknown', () => {
    expect(component.envClass('unknown')).toBe('badge-muted');
  });

  it('parsedTags returns parsed object', () => {
    expect(component.parsedTags(CLUSTERS[0])['criticality']).toBe('high');
  });

  it('parsedTags returns empty for null tags', () => {
    expect(component.parsedTags(CLUSTERS[1])).toEqual({});
  });
});
