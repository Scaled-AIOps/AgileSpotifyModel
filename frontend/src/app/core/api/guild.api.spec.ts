import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GuildApi } from './guild.api';
import { ApiService } from './api.service';

describe('GuildApi', () => {
  let api: GuildApi;
  let svc: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    svc = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    svc.get.and.returnValue(of(null as any));
    svc.post.and.returnValue(of(null as any));
    svc.patch.and.returnValue(of(null as any));
    svc.delete.and.returnValue(of(null as any));

    TestBed.configureTestingModule({ providers: [GuildApi, { provide: ApiService, useValue: svc }] });
    api = TestBed.inject(GuildApi);
  });

  it('getAll() calls GET /guilds', () => {
    api.getAll().subscribe();
    expect(svc.get).toHaveBeenCalledWith('/guilds');
  });

  it('getById() calls GET /guilds/:id', () => {
    api.getById('g1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/guilds/g1');
  });

  it('create() calls POST /guilds', () => {
    api.create({ name: 'x' }).subscribe();
    expect(svc.post).toHaveBeenCalledWith('/guilds', { name: 'x' });
  });

  it('update() calls PATCH /guilds/:id', () => {
    api.update('g1', { name: 'y' }).subscribe();
    expect(svc.patch).toHaveBeenCalledWith('/guilds/g1', { name: 'y' });
  });

  it('delete() calls DELETE /guilds/:id', () => {
    api.delete('g1').subscribe();
    expect(svc.delete).toHaveBeenCalledWith('/guilds/g1');
  });

  it('getMembers() calls GET /guilds/:id/members', () => {
    api.getMembers('g1').subscribe();
    expect(svc.get).toHaveBeenCalledWith('/guilds/g1/members');
  });

  it('join() calls POST /guilds/:guildId/members/:memberId', () => {
    api.join('g1', 'm1').subscribe();
    expect(svc.post).toHaveBeenCalledWith('/guilds/g1/members/m1', {});
  });

  it('leave() calls DELETE /guilds/:guildId/members/:memberId', () => {
    api.leave('g1', 'm1').subscribe();
    expect(svc.delete).toHaveBeenCalledWith('/guilds/g1/members/m1');
  });
});
