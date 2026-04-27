import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TribeApi } from './tribe.api';
import { ApiService } from './api.service';

describe('TribeApi', () => {
  let api: TribeApi;
  let svc: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    svc = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    svc.get.and.returnValue(of(null as any));
    svc.post.and.returnValue(of(null as any));
    svc.patch.and.returnValue(of(null as any));
    svc.delete.and.returnValue(of(null as any));

    TestBed.configureTestingModule({ providers: [TribeApi, { provide: ApiService, useValue: svc }] });
    api = TestBed.inject(TribeApi);
  });

  it('getAll() calls GET /tribes', () => {
    api.getAll().subscribe();
    expect(svc.get).toHaveBeenCalledWith('/tribes');
  });

  it('getById() calls GET /tribes/:id', () => {
    api.getById('t1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/tribes/t1');
  });

  it('create() calls POST /tribes', () => {
    api.create({ name: 'x' }).subscribe();
    expect(svc.post).toHaveBeenCalledWith('/tribes', { name: 'x' });
  });

  it('update() calls PATCH /tribes/:id', () => {
    api.update('t1', { name: 'y' }).subscribe();
    expect(svc.patch).toHaveBeenCalledWith('/tribes/t1', { name: 'y' });
  });

  it('delete() calls DELETE /tribes/:id', () => {
    api.delete('t1').subscribe();
    expect(svc.delete).toHaveBeenCalledWith('/tribes/t1');
  });

  it('getSquads() calls GET /tribes/:id/squads', () => {
    api.getSquads('t1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/tribes/t1/squads');
  });

  it('getChapters() calls GET /tribes/:id/chapters', () => {
    api.getChapters('t1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/tribes/t1/chapters');
  });

  it('assignLead() calls PATCH /tribes/:id/lead', () => {
    api.assignLead('t1', 'm1').subscribe();
    expect(svc.patch).toHaveBeenCalledWith('/tribes/t1/lead', { leadMemberId: 'm1' });
  });
});
