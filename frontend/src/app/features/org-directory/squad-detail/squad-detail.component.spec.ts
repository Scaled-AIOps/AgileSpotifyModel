import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SquadDetailComponent } from './squad-detail.component';
import { SquadApi } from '../../../core/api/squad.api';
import { MemberApi } from '../../../core/api/member.api';
import { AppsApi } from '../../../core/api/apps.api';
import { AuthService } from '../../../core/auth/auth.service';
import { ConfigService } from '../../../core/config/config.service';
import { FeatureFlagsService } from '../../../core/feature-flags/feature-flags.service';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { Squad, Member } from '../../../core/models/index';

const SQUAD: Squad = { id: 's1', name: 'Squad A', tribeId: 't1', po: 'po@test.com', sm: '', missionStatement: 'Build great things' } as any;
const MEMBERS: Member[] = [
  { id: 'm1', name: 'Alice', email: 'alice@test.com', role: 'Member', squadId: 's1', squadRole: 'dev' } as any,
];
const ALL_MEMBERS: Member[] = [
  ...MEMBERS,
  { id: 'm2', name: 'Bob', email: 'bob@test.com', role: 'Member', squadId: '' } as any,
];

describe('SquadDetailComponent', () => {
  let squadSpy: jasmine.SpyObj<SquadApi>;
  let memberSpy: jasmine.SpyObj<MemberApi>;
  let appsSpy: jasmine.SpyObj<AppsApi>;
  let configSpy: jasmine.SpyObj<ConfigService>;
  let component: SquadDetailComponent;

  const adminAuth = { currentUser: () => ({ email: 'admin@test.com', role: 'Admin', memberId: 'a1' }), isAuthenticated: () => true };
  const flagsStub = { isEnabled: () => false };

  beforeEach(async () => {
    squadSpy = jasmine.createSpyObj('SquadApi', ['getById', 'getMembers', 'addMember', 'removeMember', 'updateMemberRole', 'assignLead', 'update']);
    memberSpy = jasmine.createSpyObj('MemberApi', ['getAll', 'getById', 'create']);
    appsSpy = jasmine.createSpyObj('AppsApi', ['getBySquad']);
    configSpy = jasmine.createSpyObj('ConfigService', ['load'], { basicEnabled: () => true, jiraEnabled: () => false, adEnabled: () => false });

    squadSpy.getById.and.returnValue(of(SQUAD));
    squadSpy.getMembers.and.returnValue(of(['m1']));
    squadSpy.addMember.and.returnValue(of(undefined));
    squadSpy.removeMember.and.returnValue(of(undefined));
    squadSpy.updateMemberRole.and.returnValue(of(undefined));
    memberSpy.getById.and.returnValue(of(MEMBERS[0]));
    memberSpy.getAll.and.returnValue(of(ALL_MEMBERS));
    memberSpy.create.and.returnValue(of({ id: 'm3', name: 'Carl', email: 'carl@test.com', role: 'Member' } as any));
    appsSpy.getBySquad.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [SquadDetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 's1' } } } },
        { provide: SquadApi, useValue: squadSpy },
        { provide: MemberApi, useValue: memberSpy },
        { provide: AppsApi, useValue: appsSpy },
        { provide: AuthService, useValue: adminAuth },
        { provide: ConfigService, useValue: configSpy },
        { provide: FeatureFlagsService, useValue: flagsStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SquadDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and load squad', () => {
    expect(component).toBeTruthy();
    expect(component.loading).toBeFalse();
    expect(component.squad?.id).toBe('s1');
    expect(component.members.length).toBe(1);
  });

  it('canManage is true for Admin', () => {
    expect(component.canManage()).toBeTrue();
  });

  describe('canSubmitAdd', () => {
    it('returns false when no email', () => {
      component.addEmail = '';
      expect(component.canSubmitAdd).toBeFalse();
    });

    it('returns true when email matches existing member', () => {
      component.addEmail = 'bob@test.com';
      component.emailMatch = ALL_MEMBERS[1];
      component.emailNew = false;
      expect(component.canSubmitAdd).toBeTrue();
    });

    it('returns false when email is new but no name', () => {
      component.addEmail = 'new@test.com';
      component.emailNew = true;
      component.addName = '';
      expect(component.canSubmitAdd).toBeFalse();
    });

    it('returns true when email is new and name provided', () => {
      component.addEmail = 'new@test.com';
      component.emailNew = true;
      component.addName = 'New Person';
      expect(component.canSubmitAdd).toBeTrue();
    });
  });

  describe('onEmailInput', () => {
    it('finds existing member', () => {
      component.allMembers = ALL_MEMBERS;
      component.addEmail = 'bob@test.com';
      component.onEmailInput();
      expect(component.emailMatch).not.toBeNull();
      expect(component.emailNew).toBeFalse();
    });

    it('sets emailNew for unknown email', () => {
      component.allMembers = ALL_MEMBERS;
      component.addEmail = 'unknown@test.com';
      component.onEmailInput();
      expect(component.emailNew).toBeTrue();
      expect(component.emailMatch).toBeNull();
    });

    it('sets error for member already in squad', () => {
      component.allMembers = ALL_MEMBERS;
      component.members = MEMBERS;
      component.addEmail = 'alice@test.com';
      component.onEmailInput();
      expect(component.addError).toBeTruthy();
    });

    it('clears state for empty email', () => {
      component.addEmail = '';
      component.onEmailInput();
      expect(component.emailMatch).toBeNull();
      expect(component.emailNew).toBeFalse();
    });
  });

  describe('addMember', () => {
    it('adds existing member by email match', async () => {
      component.addEmail = 'bob@test.com';
      component.emailMatch = ALL_MEMBERS[1];
      component.emailNew = false;
      await component.addMember();
      expect(squadSpy.addMember).toHaveBeenCalled();
    });

    it('creates new member and adds to squad', async () => {
      component.addEmail = 'carl@test.com';
      component.addName = 'Carl';
      component.emailNew = true;
      component.emailMatch = null;
      await component.addMember();
      expect(memberSpy.create).toHaveBeenCalled();
      expect(squadSpy.addMember).toHaveBeenCalled();
    });

    it('does nothing when canSubmitAdd is false', async () => {
      component.addEmail = '';
      await component.addMember();
      expect(squadSpy.addMember).not.toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('removes member from list', async () => {
      component.members = [...MEMBERS];
      squadSpy.getMembers.and.returnValue(of([]));
      await component.removeMember(MEMBERS[0]);
      expect(squadSpy.removeMember).toHaveBeenCalled();
    });
  });

  describe('onRoleChange', () => {
    it('updates member role', async () => {
      await component.onRoleChange(MEMBERS[0], 'lead');
      expect(squadSpy.updateMemberRole).toHaveBeenCalled();
    });
  });

  describe('pure methods', () => {
    it('appStatusClass returns class string', () => {
      expect(typeof component.appStatusClass('active' as any)).toBe('string');
    });

    it('appStatusLabel maps known statuses', () => {
      expect(component.appStatusLabel('active' as any)).toBe('Active');
      expect(component.appStatusLabel('unknown' as any)).toBe('unknown');
    });

    it('appCrit extracts criticality from JSON tags', () => {
      const app = { tags: JSON.stringify({ criticality: 'high' }) } as any;
      expect(component.appCrit(app)).toBe('high');
    });

    it('appCrit with object tags (non-string)', () => {
      const app = { tags: { criticality: 'medium' } as any } as any;
      expect(component.appCrit(app)).toBe('medium');
    });

    it('appCrit returns empty string on parse error', () => {
      const app = { tags: 'bad json' } as any;
      expect(component.appCrit(app)).toBe('');
    });

    it('appCritClass returns correct badges', () => {
      expect(component.appCritClass('high')).toBe('badge-danger');
      expect(component.appCritClass('medium')).toBe('badge-warn');
      expect(component.appCritClass('low')).toBe('badge-muted');
    });

    it('appCritClass returns muted for unknown', () => {
      expect(component.appCritClass('')).toBe('badge-muted');
    });

    it('tierClass returns correct badges', () => {
      expect(component.tierClass('0')).toBe('badge-danger');
      expect(component.tierClass('1')).toBe('badge-warn');
      expect(component.tierClass('2')).toBe('badge-muted');
    });

    it('tierClass returns muted for unknown tier', () => {
      expect(component.tierClass('3')).toBe('badge-muted');
    });
  });

  describe('canManage edge cases', () => {
    it('returns false when squad is null', () => {
      component.squadSignal.set(null);
      expect(component.canManage()).toBeFalse();
    });

    it('returns true when user email matches sm', () => {
      const squadWithSm = { ...SQUAD, sm: 'admin@test.com' } as any;
      component.squadSignal.set(squadWithSm);
      expect(component.canManage()).toBeTrue();
    });

    it('returns true when user email matches po', () => {
      const squadWithPo = { ...SQUAD, po: 'admin@test.com', sm: 'other@test.com' } as any;
      component.squadSignal.set(squadWithPo);
      expect(component.canManage()).toBeTrue();
    });
  });

  describe('addMember with non-basic auth', () => {
    it('creates member without temp password when auth is not basic', async () => {
      const nonBasicConfig = jasmine.createSpyObj('ConfigService', ['load'], { basicEnabled: () => false, jiraEnabled: () => true, adEnabled: () => false });
      (component as any).config = nonBasicConfig;
      component.addEmail = 'newperson@test.com';
      component.addName = 'New Person';
      component.emailNew = true;
      component.emailMatch = null;
      await component.addMember();
      expect(memberSpy.create).toHaveBeenCalled();
      expect(component.tempPassword).toBe('');
    });
  });
});
