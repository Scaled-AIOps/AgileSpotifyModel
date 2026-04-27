import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../../core/auth/auth.service';
import { MemberApi } from '../../core/api/member.api';
import { SquadApi } from '../../core/api/squad.api';
import { TribeApi } from '../../core/api/tribe.api';
import { OrgApi } from '../../core/api/org.api';
import { AppsApi } from '../../core/api/apps.api';

describe('DashboardComponent', () => {
  let memberSpy: jasmine.SpyObj<MemberApi>;
  let squadSpy: jasmine.SpyObj<SquadApi>;
  let tribeSpy: jasmine.SpyObj<TribeApi>;
  let orgSpy: jasmine.SpyObj<OrgApi>;
  let appsSpy: jasmine.SpyObj<AppsApi>;

  const authStubAdmin = {
    currentUser: () => ({ id: 'u1', email: 'admin@test.com', role: 'Admin', memberId: 'm1' }),
    isAuthenticated: () => true,
  };

  function setup(authStub: any = authStubAdmin) {
    return TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: MemberApi, useValue: memberSpy },
        { provide: SquadApi, useValue: squadSpy },
        { provide: TribeApi, useValue: tribeSpy },
        { provide: OrgApi, useValue: orgSpy },
        { provide: AppsApi, useValue: appsSpy },
      ],
    }).compileComponents();
  }

  beforeEach(() => {
    memberSpy = jasmine.createSpyObj('MemberApi', ['getAll', 'getById']);
    squadSpy = jasmine.createSpyObj('SquadApi', ['getAll', 'getById', 'getMembers']);
    tribeSpy = jasmine.createSpyObj('TribeApi', ['getAll', 'getById', 'getSquads']);
    orgSpy = jasmine.createSpyObj('OrgApi', ['getTree', 'getHeadcount']);
    appsSpy = jasmine.createSpyObj('AppsApi', ['getAll', 'getBySquad']);

    memberSpy.getAll.and.returnValue(of([]));
    memberSpy.getById.and.returnValue(of({ id: 'm1', name: 'Alice', squadId: '', role: 'Admin' } as any));
    squadSpy.getAll.and.returnValue(of([]));
    squadSpy.getById.and.returnValue(of(null as any));
    squadSpy.getMembers.and.returnValue(of([]));
    tribeSpy.getAll.and.returnValue(of([]));
    tribeSpy.getById.and.returnValue(of(null as any));
    tribeSpy.getSquads.and.returnValue(of([]));
    orgSpy.getTree.and.returnValue(of([]));
    orgSpy.getHeadcount.and.returnValue(of([]));
    appsSpy.getAll.and.returnValue(of([]));
    appsSpy.getBySquad.and.returnValue(of([]));
  });

  it('should create as Admin', async () => {
    await setup();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.loading).toBeFalse();
  });

  it('should create as TribeLead', async () => {
    const tribeLeadAuth = {
      currentUser: () => ({ id: 'u3', email: 'tl@test.com', role: 'TribeLead', memberId: 'm3' }),
      isAuthenticated: () => true,
    };
    memberSpy.getById.and.returnValue(of({ id: 'm3', name: 'TL', squadId: '', role: 'TribeLead' } as any));
    tribeSpy.getAll.and.returnValue(of([{ id: 't1', name: 'Tribe A', leadMemberId: 'm3' } as any]));
    tribeSpy.getSquads.and.returnValue(of([]));

    await setup(tribeLeadAuth);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.loading).toBeFalse();
  });

  it('should create as Member', async () => {
    const memberAuth = {
      currentUser: () => ({ id: 'u2', email: 'bob@test.com', role: 'Member', memberId: 'm2' }),
      isAuthenticated: () => true,
    };
    memberSpy.getById.and.returnValue(of({ id: 'm2', name: 'Bob', squadId: 's1', role: 'Member' } as any));
    squadSpy.getById.and.returnValue(of({ id: 's1', name: 'Squad A', tribeId: 't1' } as any));

    await setup(memberAuth);
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('pure getters', () => {
    let component: DashboardComponent;

    beforeEach(async () => {
      await setup();
      const fixture = TestBed.createComponent(DashboardComponent);
      component = fixture.componentInstance;
    });

    it('barWidth returns correct percentage', () => {
      (component as any).maxHeadcount = 10;
      expect(component.barWidth(5)).toBe('50%');
    });

    it('clearSearch resets query and results', () => {
      component.searchQuery = 'test';
      component.searchResults = [{ id: '1', type: 'app', primary: 'x', secondary: '', route: [] }];
      component.clearSearch();
      expect(component.searchQuery).toBe('');
      expect(component.searchResults).toEqual([]);
    });

    it('tribeTotalMembers sums memberCounts', () => {
      (component as any).tribeSquads = [{ squad: {}, memberCount: 3, apps: [] }, { squad: {}, memberCount: 5, apps: [] }];
      expect(component.tribeTotalMembers).toBe(8);
    });

    it('initials uses member name if available', () => {
      (component as any).member = { name: 'Alice', email: 'a@t.com' };
      expect(component.initials).toBe('A');
    });

    it('initials falls back to email', () => {
      (component as any).member = null;
      (component as any).user = { email: 'bob@t.com' };
      expect(component.initials).toBe('B');
    });

    it('runningClass returns class for known status', () => {
      expect(component.runningClass('active')).toBe('badge-success');
      expect(component.runningClass('failed')).toBe('badge-danger');
      expect(component.runningClass('inactive')).toBe('badge-muted');
    });

    it('formatDate formats ISO date', () => {
      const result = component.formatDate('2025-01-15T00:00:00Z');
      expect(result).toContain('15');
    });
  });

  describe('search', () => {
    let component: DashboardComponent;
    let router: any;

    beforeEach(async () => {
      await setup();
      const fixture = TestBed.createComponent(DashboardComponent);
      component = fixture.componentInstance;
      router = TestBed.inject(Router);
      spyOn(router, 'navigate');
      (component as any).allApps = [
        { appId: 'my-app', squadKey: 'sq-a', id: 'a1', status: 'Active' } as any,
      ];
      (component as any).allMembers = [
        { id: 'm1', name: 'Alice Jones', email: 'alice@t.com', squadId: 's1' } as any,
        { id: 'm2', name: 'Bob', email: 'bob@t.com', squadId: '' } as any,
      ];
      (component as any).searchDataLoaded = true;
    });

    it('onSearch with short query clears results', async () => {
      await component.onSearch('a');
      expect(component.searchResults).toEqual([]);
      expect(component.searchOpen).toBeFalse();
    });

    it('onSearch with query >= 2 chars filters apps and members', async () => {
      await component.onSearch('my');
      expect(component.searchResults.some((r) => r.type === 'app')).toBeTrue();
    });

    it('onSearch finds members by name', async () => {
      await component.onSearch('alice');
      expect(component.searchResults.some((r) => r.type === 'member')).toBeTrue();
    });

    it('navigate clears search and routes', () => {
      const result = { id: '1', type: 'app' as const, primary: 'x', secondary: '', route: ['/apps', 'x'] };
      component.navigate(result);
      expect(router.navigate).toHaveBeenCalledWith(['/apps', 'x']);
      expect(component.searchQuery).toBe('');
    });

    it('closeSearch closes the dropdown', () => {
      component.searchOpen = true;
      component.closeSearch();
      expect(component.searchOpen).toBeFalse();
    });

    it('onSearch for Member routes member with squadId to squad', async () => {
      (component as any).role = 'Member';
      (component as any).allMembers = [
        { id: 'm1', name: 'Alice Jones', email: 'alice@t.com', squadId: 's1' } as any,
      ];
      await component.onSearch('alice');
      const memberResult = component.searchResults.find((r) => r.type === 'member');
      expect(memberResult?.route).toContain('/org/squads');
    });

    it('onSearch for Member routes member without squadId to /org', async () => {
      (component as any).role = 'Member';
      (component as any).allMembers = [
        { id: 'm2', name: 'Bob', email: 'bob@t.com', squadId: '' } as any,
      ];
      await component.onSearch('bob');
      const memberResult = component.searchResults.find((r) => r.type === 'member');
      expect(memberResult?.route).toContain('/org');
    });

    it('roleLabel returns label for known role', () => {
      (component as any).role = 'Admin';
      expect(component.roleLabel).toBeTruthy();
    });

    it('roleLabel returns role name for unknown role', () => {
      (component as any).role = 'Unknown';
      expect(component.roleLabel).toBe('Unknown');
    });

    it('roleClass returns badge-muted for unknown role', () => {
      (component as any).role = 'Unknown';
      expect(component.roleClass).toBe('badge-muted');
    });

    it('runningClass falls back to badge-muted for unknown status', () => {
      expect(component.runningClass('Unknown')).toBe('badge-muted');
    });

    it('initials falls back to U when both member and user email are null', () => {
      (component as any).member = null;
      (component as any).user = null;
      expect(component.initials).toBe('U');
    });
  });

  describe('app health helpers', () => {
    let component: DashboardComponent;

    const makeApp = (overrides: Partial<any> = {}): any => ({
      appId: 'app-1', status: 'active', javaComplianceStatus: 'compliant',
      xrayUrl: 'https://xray.example.com/app', tags: '{}', squadKey: 'SQ', ...overrides,
    });

    beforeEach(async () => {
      await setup();
      const fixture = TestBed.createComponent(DashboardComponent);
      component = fixture.componentInstance;
    });

    it('runningLabel maps all statuses', () => {
      expect(component.runningLabel('active')).toBe('Active');
      expect(component.runningLabel('inactive')).toBe('Inactive');
      expect(component.runningLabel('failed')).toBe('Failed');
      expect(component.runningLabel('marked-for-decommissioning')).toBe('Decom');
      expect(component.runningLabel('other')).toBe('other');
    });

    it('runningClass maps decom to badge-warn', () => {
      expect(component.runningClass('marked-for-decommissioning')).toBe('badge-warn');
    });

    it('javaClass maps all compliance states', () => {
      expect(component.javaClass('compliant')).toBe('badge-success');
      expect(component.javaClass('exempt')).toBe('badge-muted');
      expect(component.javaClass('non-compliant')).toBe('badge-danger');
    });

    it('appCrit returns empty string when tags has no criticality', () => {
      expect(component.appCrit(makeApp({ tags: '{}' }))).toBe('');
    });

    it('appCrit returns criticality from tags', () => {
      expect(component.appCrit(makeApp({ tags: '{"criticality":"high"}' }))).toBe('high');
    });

    it('appCritClass returns correct badge classes', () => {
      expect(component.appCritClass(makeApp({ tags: '{"criticality":"critical"}' }))).toBe('badge-danger');
      expect(component.appCritClass(makeApp({ tags: '{"criticality":"high"}' }))).toBe('badge-story');
      expect(component.appCritClass(makeApp({ tags: '{"criticality":"medium"}' }))).toBe('badge-warn');
      expect(component.appCritClass(makeApp({ tags: '{"criticality":"low"}' }))).toBe('badge-muted');
    });

    it('compliancePct handles zero total', () => {
      expect(component.compliancePct(0, 0)).toBe('0%');
    });

    it('compliancePct computes percentage', () => {
      expect(component.compliancePct(3, 10)).toBe('30%');
    });

    it('squadFailedCount counts failed apps', () => {
      const apps = [makeApp({ status: 'failed' }), makeApp({ status: 'active' }), makeApp({ status: 'failed' })];
      expect(component.squadFailedCount(apps)).toBe(2);
    });

    it('computeHealth (via fleetHealth) counts all statuses and compliance', () => {
      (component as any).allAppsFleet = [
        makeApp({ status: 'active',   javaComplianceStatus: 'compliant',     xrayUrl: 'https://x' }),
        makeApp({ status: 'inactive', javaComplianceStatus: 'exempt',        xrayUrl: '' }),
        makeApp({ status: 'failed',   javaComplianceStatus: 'non-compliant', xrayUrl: '' }),
        makeApp({ status: 'marked-for-decommissioning', javaComplianceStatus: '', xrayUrl: 'https://x' }),
      ];
      const h = component.fleetHealth;
      expect(h.active).toBe(1);
      expect(h.inactive).toBe(1);
      expect(h.failed).toBe(1);
      expect(h.decom).toBe(1);
      expect(h.javaOk).toBe(2);
      expect(h.javaFail).toBe(1);
      expect(h.xrayOk).toBe(2);
      expect(h.xrayFail).toBe(2);
    });

    it('tribeHealth aggregates apps from all squad rows', () => {
      (component as any).tribeSquads = [
        { squad: {}, memberCount: 2, apps: [makeApp({ status: 'active' })] },
        { squad: {}, memberCount: 1, apps: [makeApp({ status: 'failed' })] },
      ];
      expect(component.tribeHealth.failed).toBe(1);
      expect(component.tribeHealth.active).toBe(1);
    });

    it('appFailedCount counts failed and inactive squad apps', () => {
      (component as any).squadApps = [
        makeApp({ status: 'failed' }), makeApp({ status: 'inactive' }), makeApp({ status: 'active' }),
      ];
      expect(component.appFailedCount).toBe(2);
    });
  });
});

describe('DashboardComponent branch coverage', () => {
  let memberSpy: jasmine.SpyObj<MemberApi>;
  let squadSpy: jasmine.SpyObj<SquadApi>;
  let tribeSpy: jasmine.SpyObj<TribeApi>;
  let orgSpy: jasmine.SpyObj<OrgApi>;
  let appsSpy: jasmine.SpyObj<AppsApi>;

  beforeEach(() => {
    memberSpy = jasmine.createSpyObj('MemberApi', ['getAll', 'getById']);
    squadSpy = jasmine.createSpyObj('SquadApi', ['getAll', 'getById', 'getMembers']);
    tribeSpy = jasmine.createSpyObj('TribeApi', ['getAll', 'getById', 'getSquads']);
    orgSpy = jasmine.createSpyObj('OrgApi', ['getTree', 'getHeadcount']);
    appsSpy = jasmine.createSpyObj('AppsApi', ['getAll', 'getBySquad']);

    memberSpy.getAll.and.returnValue(of([]));
    memberSpy.getById.and.returnValue(of({ id: 'm1', name: 'Alice', squadId: '', role: 'Admin' } as any));
    squadSpy.getAll.and.returnValue(of([]));
    squadSpy.getById.and.returnValue(of(null as any));
    squadSpy.getMembers.and.returnValue(of([]));
    tribeSpy.getAll.and.returnValue(of([]));
    tribeSpy.getById.and.returnValue(of(null as any));
    tribeSpy.getSquads.and.returnValue(of([]));
    orgSpy.getTree.and.returnValue(of([]));
    orgSpy.getHeadcount.and.returnValue(of([]));
    appsSpy.getAll.and.returnValue(of([]));
    appsSpy.getBySquad.and.returnValue(of([]));
  });

  async function buildTestBed(authStub: any) {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authStub },
        { provide: MemberApi, useValue: memberSpy },
        { provide: SquadApi, useValue: squadSpy },
        { provide: TribeApi, useValue: tribeSpy },
        { provide: OrgApi, useValue: orgSpy },
        { provide: AppsApi, useValue: appsSpy },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('no user: loading becomes false immediately', async () => {
    const c = await buildTestBed({ currentUser: () => null, isAuthenticated: () => false });
    expect(c.loading).toBeFalse();
  });

  it('Admin with headcount data computes avgPerTribe', async () => {
    orgSpy.getHeadcount.and.returnValue(of([
      { tribeId: 't1', tribeName: 'Tribe A', memberCount: 6, squads: ['sq1', 'sq2'] } as any,
    ]));
    const c = await buildTestBed({ currentUser: () => ({ id: 'u1', email: 'a@t.com', role: 'Admin', memberId: 'm1' }), isAuthenticated: () => true });
    expect(c.orgStats.avgPerTribe).toBe(6);
  });

  it('TribeLead with no matching tribe returns early', async () => {
    tribeSpy.getAll.and.returnValue(of([{ id: 't9', name: 'Other Tribe', leadMemberId: 'x' } as any]));
    memberSpy.getById.and.returnValue(of({ id: 'm3', name: 'TL', squadId: '', role: 'TribeLead' } as any));
    const c = await buildTestBed({ currentUser: () => ({ id: 'u3', email: 'tl@t.com', role: 'TribeLead', memberId: 'm3' }), isAuthenticated: () => true });
    expect(c.loading).toBeFalse();
    expect(c.tribeSquads.length).toBe(0);
  });

  it('Member with no squadId skips squad data load', async () => {
    memberSpy.getById.and.returnValue(of({ id: 'm2', name: 'Bob', squadId: '', role: 'Member' } as any));
    const c = await buildTestBed({ currentUser: () => ({ id: 'u2', email: 'bob@t.com', role: 'Member', memberId: 'm2' }), isAuthenticated: () => true });
    expect(c.loading).toBeFalse();
    expect(c.squadApps.length).toBe(0);
  });

  it('onSearch with null squadKey uses empty string fallback', async () => {
    appsSpy.getAll.and.returnValue(of([{ appId: 'my-app', squadKey: null, id: 'a1', status: 'Active' } as any]));
    const c = await buildTestBed({ currentUser: () => ({ id: 'u1', email: 'a@t.com', role: 'Admin', memberId: 'm1' }), isAuthenticated: () => true });
    (c as any).searchDataLoaded = false;
    await c.onSearch('my-app');
    expect(c.searchResults.some((r) => r.type === 'app')).toBeTrue();
    expect(c.searchResults[0].secondary).toBe('');
  });
});
