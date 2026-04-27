import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { GuildDetailComponent } from './guild-detail.component';
import { GuildApi } from '../../../core/api/guild.api';
import { MemberApi } from '../../../core/api/member.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { Guild, Member } from '../../../core/models/index';

const GUILD: Guild = { id: 'g1', name: 'Frontend Guild', description: 'UI experts' } as any;
const MEMBERS: Member[] = [
  { id: 'm1', name: 'Alice', email: 'alice@test.com', role: 'Member' } as any,
];

describe('GuildDetailComponent', () => {
  let guildSpy: jasmine.SpyObj<GuildApi>;
  let memberSpy: jasmine.SpyObj<MemberApi>;
  let component: GuildDetailComponent;

  async function create(memberId = 'm2', memberIds = ['m1']) {
    guildSpy = jasmine.createSpyObj('GuildApi', ['getById', 'getMembers', 'join', 'leave', 'update']);
    memberSpy = jasmine.createSpyObj('MemberApi', ['getAll', 'getById']);

    guildSpy.getById.and.returnValue(of(GUILD));
    guildSpy.getMembers.and.returnValue(of(memberIds));
    guildSpy.join.and.returnValue(of(undefined));
    guildSpy.leave.and.returnValue(of(undefined));
    memberSpy.getAll.and.returnValue(of(MEMBERS));
    memberSpy.getById.and.returnValue(of(MEMBERS[0]));

    const authStub = {
      currentUser: () => ({ email: 'test@test.com', role: 'Member', memberId }),
    };

    await TestBed.configureTestingModule({
      imports: [GuildDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'g1' } } } },
        { provide: GuildApi, useValue: guildSpy },
        { provide: MemberApi, useValue: memberSpy },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(GuildDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    return component;
  }

  it('should create as non-member', async () => {
    await create('m2', ['m1']);
    expect(component).toBeTruthy();
    expect(component.loading).toBeFalse();
    expect(component.isMember).toBeFalse();
  });

  it('should detect membership', async () => {
    await create('m1', ['m1']);
    expect(component.isMember).toBeTrue();
  });

  it('toggleMembership joins guild when not member', async () => {
    await create('m2', ['m1']);
    await component.toggleMembership();
    expect(guildSpy.join).toHaveBeenCalledWith('g1', 'm2');
    expect(component.isMember).toBeTrue();
    expect(component.members.length).toBe(2);
  });

  it('toggleMembership leaves guild when already member', async () => {
    await create('m1', ['m1']);
    await component.toggleMembership();
    expect(guildSpy.leave).toHaveBeenCalledWith('g1', 'm1');
    expect(component.isMember).toBeFalse();
    expect(component.members.length).toBe(0);
  });
});
