import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrgContextComponent } from './org-context.component';
import { AuthService } from '../../../core/auth/auth.service';
import { MemberApi } from '../../../core/api/member.api';
import { SquadApi } from '../../../core/api/squad.api';
import { TribeApi } from '../../../core/api/tribe.api';
import { ApiService } from '../../../core/api/api.service';
import { AppsApi } from '../../../core/api/apps.api';
import { FeatureFlagsService } from '../../../core/feature-flags/feature-flags.service';
import { OrgApi } from '../../../core/api/org.api';
import type { Member, Squad, Tribe } from '../../../core/models/index';

const MEMBER: Member = { id: 'm1', name: 'Alice', email: 'alice@test.com', role: 'Member', squadId: 's1' } as any;
const MEMBER_NO_SQUAD: Member = { id: 'm2', name: 'Bob', email: 'bob@test.com', role: 'TribeLead', squadId: '' } as any;
const SQUAD: Squad = { id: 's1', name: 'Squad A', tribeId: 't1', leadMemberId: '' } as any;
const TRIBE: Tribe = { id: 't1', name: 'Tribe A', domainId: 'd1', subdomainId: '', leadMemberId: '' } as any;

function makeSpies() {
  const memberSpy = jasmine.createSpyObj('MemberApi', ['getAll', 'getById']);
  const squadSpy = jasmine.createSpyObj('SquadApi', ['getAll', 'getById', 'getMembers']);
  const tribeSpy = jasmine.createSpyObj('TribeApi', ['getAll', 'getById']);
  const apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
  const appsSpy = jasmine.createSpyObj('AppsApi', ['getAll', 'getBySquad']);
  const orgSpy = jasmine.createSpyObj('OrgApi', ['getTree', 'getHeadcount']);

  memberSpy.getAll.and.returnValue(of([]));
  memberSpy.getById.and.returnValue(of(MEMBER));
  squadSpy.getAll.and.returnValue(of([]));
  squadSpy.getById.and.returnValue(of(SQUAD));
  squadSpy.getMembers.and.returnValue(of(['m1', 'm2']));
  tribeSpy.getAll.and.returnValue(of([TRIBE]));
  tribeSpy.getById.and.returnValue(of(TRIBE));
  apiSpy.get.and.returnValue(of({ id: 'd1', name: 'Domain A' } as any));
  appsSpy.getAll.and.returnValue(of([]));
  appsSpy.getBySquad.and.returnValue(of([]));
  orgSpy.getTree.and.returnValue(of([]));

  return { memberSpy, squadSpy, tribeSpy, apiSpy, appsSpy, orgSpy };
}

async function createComponent(authStub: any, flagsStub: any, spies: ReturnType<typeof makeSpies>) {
  await TestBed.configureTestingModule({
    imports: [OrgContextComponent],
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: authStub },
      { provide: MemberApi, useValue: spies.memberSpy },
      { provide: SquadApi, useValue: spies.squadSpy },
      { provide: TribeApi, useValue: spies.tribeSpy },
      { provide: ApiService, useValue: spies.apiSpy },
      { provide: AppsApi, useValue: spies.appsSpy },
      { provide: OrgApi, useValue: spies.orgSpy },
      { provide: FeatureFlagsService, useValue: flagsStub },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(OrgContextComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.componentInstance;
}

describe('OrgContextComponent - member with squad', () => {
  it('should load squad chain', async () => {
    const spies = makeSpies();
    const auth = { currentUser: () => ({ id: 'u1', email: 'alice@test.com', role: 'Member', memberId: 'm1' }) };
    const flags = { isEnabled: () => false };
    const c = await createComponent(auth, flags, spies);
    expect(c).toBeTruthy();
    expect(c.loading).toBeFalse();
    expect(c.squad?.id).toBe('s1');
    expect(c.memberCount).toBe(2);
  });

  it('breadcrumb includes domain and squad', async () => {
    const spies = makeSpies();
    const auth = { currentUser: () => ({ id: 'u1', email: 'alice@test.com', role: 'Member', memberId: 'm1' }) };
    const flags = { isEnabled: () => false };
    const c = await createComponent(auth, flags, spies);
    const crumbs = c.breadcrumb;
    expect(crumbs.some((cr) => cr.label === 'Domain A')).toBeTrue();
    expect(crumbs.some((cr) => cr.label === 'Squad A')).toBeTrue();
  });
});

describe('OrgContextComponent - TribeLead without squad', () => {
  it('should load tribe chain', async () => {
    const spies = makeSpies();
    spies.memberSpy.getById.and.returnValue(of(MEMBER_NO_SQUAD));
    spies.tribeSpy.getAll.and.returnValue(of([{ ...TRIBE, leadMemberId: 'm2' } as any]));

    const auth = { currentUser: () => ({ id: 'u2', email: 'bob@test.com', role: 'TribeLead', memberId: 'm2' }) };
    const flags = { isEnabled: () => false };
    const c = await createComponent(auth, flags, spies);
    expect(c.tribe?.id).toBe('t1');
  });
});

describe('OrgContextComponent - unauthenticated', () => {
  it('handles null user', async () => {
    const spies = makeSpies();
    const auth = { currentUser: () => null };
    const flags = { isEnabled: () => false };
    const c = await createComponent(auth, flags, spies);
    expect(c.loading).toBeFalse();
    expect(c.squad).toBeNull();
  });
});
