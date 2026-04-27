import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppsApi } from './apps.api';
import { ApiService } from './api.service';

describe('AppsApi', () => {
  let api: AppsApi;
  let svc: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    svc = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    svc.get.and.returnValue(of(null as any));
    svc.post.and.returnValue(of(null as any));
    svc.patch.and.returnValue(of(null as any));
    svc.delete.and.returnValue(of(null as any));

    TestBed.configureTestingModule({ providers: [AppsApi, { provide: ApiService, useValue: svc }] });
    api = TestBed.inject(AppsApi);
  });

  it('getAll() calls GET /apps', () => {
    api.getAll().subscribe();
    expect(svc.get).toHaveBeenCalledWith('/apps');
  });

  it('getById() calls GET /apps/:id', () => {
    api.getById('a1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/apps/a1');
  });

  it('getBySquad() calls GET /squads/:id/apps', () => {
    api.getBySquad('s1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/squads/s1/apps');
  });

  it('getDeployHistory() calls GET /apps/:id/:env/deploys', () => {
    api.getDeployHistory('a1', 'prod').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/apps/a1/prod/deploys');
  });

  it('createApp() calls POST /apps', () => {
    api.createApp({ name: 'x' }).subscribe();
    expect(svc.post).toHaveBeenCalledWith('/apps', { name: 'x' });
  });

  it('updateApp() calls PATCH /apps/:id', () => {
    api.updateApp('a1', { name: 'y' }).subscribe();
    expect(svc.patch).toHaveBeenCalledWith('/apps/a1', { name: 'y' });
  });

  it('getAuditLog() calls GET /apps/:id/audit', () => {
    api.getAuditLog('a1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/apps/a1/audit');
  });

  it('getAllClusters() calls GET /infra', () => {
    api.getAllClusters().subscribe();
    expect(svc.get).toHaveBeenCalledWith('/infra');
  });

  it('getCluster() calls GET /infra/:id', () => {
    api.getCluster('p1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/infra/p1');
  });
});
