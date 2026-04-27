import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SquadApi } from './squad.api';
import { ApiService } from './api.service';

describe('SquadApi', () => {
  let api: SquadApi;
  let svc: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    svc = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    svc.get.and.returnValue(of(null as any));
    svc.post.and.returnValue(of(null as any));
    svc.patch.and.returnValue(of(null as any));
    svc.delete.and.returnValue(of(null as any));

    TestBed.configureTestingModule({ providers: [SquadApi, { provide: ApiService, useValue: svc }] });
    api = TestBed.inject(SquadApi);
  });

  it('getAll()', () => { api.getAll().subscribe(); expect(svc.get).toHaveBeenCalledWith('/squads'); });
  it('getById()', () => { api.getById('s1').subscribe(); expect(svc.get).toHaveBeenCalledWith('/squads/s1'); });
  it('create()', () => { api.create({ name: 'x' }).subscribe(); expect(svc.post).toHaveBeenCalledWith('/squads', { name: 'x' }); });
  it('update()', () => { api.update('s1', { name: 'y' }).subscribe(); expect(svc.patch).toHaveBeenCalledWith('/squads/s1', { name: 'y' }); });
  it('delete()', () => { api.delete('s1').subscribe(); expect(svc.delete).toHaveBeenCalledWith('/squads/s1'); });
  it('getMembers()', () => { api.getMembers('s1').subscribe(); expect(svc.get).toHaveBeenCalledWith('/squads/s1/members'); });
  it('addMember() without role', () => { api.addMember('s1', 'm1').subscribe(); expect(svc.post).toHaveBeenCalledWith('/squads/s1/members/m1', {}); });
  it('addMember() with role', () => { api.addMember('s1', 'm1', 'lead').subscribe(); expect(svc.post).toHaveBeenCalledWith('/squads/s1/members/m1', { squadRole: 'lead' }); });
  it('updateMemberRole()', () => { api.updateMemberRole('s1', 'm1', 'dev').subscribe(); expect(svc.patch).toHaveBeenCalledWith('/squads/s1/members/m1/role', { squadRole: 'dev' }); });
  it('removeMember()', () => { api.removeMember('s1', 'm1').subscribe(); expect(svc.delete).toHaveBeenCalledWith('/squads/s1/members/m1'); });
  it('assignLead()', () => { api.assignLead('s1', 'm1').subscribe(); expect(svc.patch).toHaveBeenCalledWith('/squads/s1/lead', { leadMemberId: 'm1' }); });
});
