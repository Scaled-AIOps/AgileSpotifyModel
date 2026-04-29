import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MemberApi } from './member.api';
import { ApiService } from './api.service';

describe('MemberApi', () => {
  let api: MemberApi;
  let svc: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    svc = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    svc.get.and.returnValue(of(null as any));
    svc.post.and.returnValue(of(null as any));
    svc.patch.and.returnValue(of(null as any));
    svc.delete.and.returnValue(of(null as any));

    TestBed.configureTestingModule({ providers: [MemberApi, { provide: ApiService, useValue: svc }] });
    api = TestBed.inject(MemberApi);
  });

  it('getAll() calls GET /members', () => {
    api.getAll().subscribe();
    expect(svc.get).toHaveBeenCalledWith('/members');
  });

  it('getById() calls GET /members/:id', () => {
    api.getById('m1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/members/m1');
  });

  it('create() calls POST /members', () => {
    api.create({ name: 'x', signet: 'tink' }).subscribe();
    expect(svc.post).toHaveBeenCalledWith('/members', { name: 'x', signet: 'tink' });
  });

  it('update() calls PATCH /members/:id', () => {
    api.update('m1', { name: 'y' }).subscribe();
    expect(svc.patch).toHaveBeenCalledWith('/members/m1', { name: 'y' });
  });

  it('delete() calls DELETE /members/:id', () => {
    api.delete('m1').subscribe();
    expect(svc.delete).toHaveBeenCalledWith('/members/m1');
  });

  it('getAssignments() calls GET /members/:id/assignments', () => {
    api.getAssignments('m1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/members/m1/assignments');
  });
});
