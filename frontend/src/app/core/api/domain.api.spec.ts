import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DomainApi } from './domain.api';
import { ApiService } from './api.service';

describe('DomainApi', () => {
  let api: DomainApi;
  let svc: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    svc = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    svc.get.and.returnValue(of(null as any));
    svc.post.and.returnValue(of(null as any));
    svc.patch.and.returnValue(of(null as any));
    svc.delete.and.returnValue(of(null as any));

    TestBed.configureTestingModule({ providers: [DomainApi, { provide: ApiService, useValue: svc }] });
    api = TestBed.inject(DomainApi);
  });

  it('getAll() calls GET /domains', () => {
    api.getAll().subscribe();
    expect(svc.get).toHaveBeenCalledWith('/domains');
  });

  it('getById() calls GET /domains/:id', () => {
    api.getById('d1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/domains/d1');
  });

  it('getTree() calls GET /domains/:id/tree', () => {
    api.getTree('d1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/domains/d1/tree');
  });

  it('create() calls POST /domains', () => {
    api.create({ name: 'x' }).subscribe();
    expect(svc.post).toHaveBeenCalledWith('/domains', { name: 'x' });
  });

  it('update() calls PATCH /domains/:id', () => {
    api.update('d1', { name: 'y' }).subscribe();
    expect(svc.patch).toHaveBeenCalledWith('/domains/d1', { name: 'y' });
  });

  it('delete() calls DELETE /domains/:id', () => {
    api.delete('d1').subscribe();
    expect(svc.delete).toHaveBeenCalledWith('/domains/d1');
  });
});
