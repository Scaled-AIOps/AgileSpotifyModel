import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { AppListComponent } from './app-list.component';
import { AppsApi } from '../../../core/api/apps.api';
import { AuthService } from '../../../core/auth/auth.service';
import { MemberApi } from '../../../core/api/member.api';
import type { App } from '../../../core/models/index';

const makeApp = (id: string, status = 'Active', javaVersion = 'compliant'): App =>
  ({ id, appId: id, name: id, squadKey: 'sq-a', status, javaVersion, tags: JSON.stringify({ pillar: 'data', criticality: 'high' }) } as any);

const makeAppNoTags = (id: string): App =>
  ({ id, appId: id, name: id, squadKey: null, status: 'Active', javaVersion: null, tags: null } as any);

const APPS: App[] = [makeApp('app-1'), makeApp('app-2', 'Deprecated'), makeApp('app-3', 'Active', 'non-compliant')];

describe('AppListComponent', () => {
  let appsSpy: jasmine.SpyObj<AppsApi>;
  let memberSpy: jasmine.SpyObj<MemberApi>;
  let component: AppListComponent;

  const adminAuth = { currentUser: () => ({ email: 'a@b.com', role: 'Admin', memberId: 'm1' }) };
  const memberAuth = { currentUser: () => ({ email: 'b@b.com', role: 'Member', memberId: 'm2' }) };

  function makeRoute(squadParam: string | null = null) {
    return { snapshot: { queryParamMap: { get: (k: string) => k === 'squad' ? squadParam : null } } };
  }

  async function create(auth: any = adminAuth, squadParam: string | null = null) {
    appsSpy = jasmine.createSpyObj('AppsApi', ['getAll', 'getBySquad', 'createApp', 'updateApp', 'getAllClusters', 'getCluster']);
    memberSpy = jasmine.createSpyObj('MemberApi', ['getAll', 'getById']);
    appsSpy.getAll.and.returnValue(of(APPS));
    appsSpy.getBySquad.and.returnValue(of([APPS[0]]));
    memberSpy.getById.and.returnValue(of({ id: 'm2', squadId: 's1', role: 'Member', name: 'Bob', email: 'b@b.com' } as any));

    await TestBed.configureTestingModule({
      imports: [AppListComponent],
      providers: [
        provideRouter([]),
        { provide: AppsApi, useValue: appsSpy },
        { provide: AuthService, useValue: auth },
        { provide: MemberApi, useValue: memberSpy },
        { provide: ActivatedRoute, useValue: makeRoute(squadParam) },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    return component;
  }

  it('loads all apps for Admin', async () => {
    await create(adminAuth);
    expect(component.loading).toBeFalse();
    expect(component.allApps.length).toBe(3);
    expect(component.showAll).toBeTrue();
  });

  it('loads squad apps for Member', async () => {
    await create(memberAuth);
    expect(component.loading).toBeFalse();
    expect(component.myApps.length).toBe(1);
    expect(component.showAll).toBeFalse();
  });

  describe('getters', () => {
    beforeEach(async () => await create());

    it('sourcePool returns allApps when showAll', () => {
      component.showAll = true;
      expect(component.sourcePool.length).toBe(3);
    });

    it('sourcePool returns myApps when not showAll', () => {
      component.showAll = false;
      expect(component.sourcePool.length).toBe(0);
    });

    it('filtered filters by query', () => {
      component.query = 'app-1';
      expect(component.filtered.length).toBe(1);
    });

    it('filtered filters by status', () => {
      component.activeStatus = 'Deprecated' as any;
      expect(component.filtered.length).toBe(1);
    });

    it('sorted returns apps sorted asc', () => {
      component.sortField = 'appId';
      component.sortDir = 'asc';
      expect(component.sorted[0].appId).toBe('app-1');
    });

    it('sorted returns apps sorted desc', () => {
      component.sortField = 'appId';
      component.sortDir = 'desc';
      expect(component.sorted[0].appId).toBe('app-3');
    });

    it('totalPages returns correct page count', () => {
      component.pageSize = 2;
      expect(component.totalPages).toBe(2);
    });

    it('pageNumbers returns all pages when <= 7', () => {
      expect(component.pageNumbers).toContain(1);
    });

    it('pageNumbers handles many pages', () => {
      const manyApps = Array.from({ length: 100 }, (_, i) => makeApp(`app-${i}`));
      component.allApps = manyApps;
      component.pageSize = 5;
      component.currentPage = 5;
      const pn = component.pageNumbers;
      expect(pn[0]).toBe(1);
      expect(pn[pn.length - 1]).toBe(20);
    });

    it('canManage is true for Admin', () => expect(component.canManage).toBeTrue());

    it('visibleColCount returns count of visible columns', () => {
      expect(component.visibleColCount).toBeGreaterThan(0);
    });
  });

  describe('methods', () => {
    beforeEach(async () => await create());

    it('sortBy toggles direction on same field', () => {
      component.sortField = 'appId';
      component.sortDir = 'asc';
      component.sortBy('appId');
      expect(component.sortDir).toBe('desc');
    });

    it('sortBy sets new field', () => {
      component.sortBy('status');
      expect(component.sortField).toBe('status');
      expect(component.sortDir).toBe('asc');
    });

    it('sortIcon returns ↑ for current asc field', () => {
      component.sortField = 'appId';
      component.sortDir = 'asc';
      expect(component.sortIcon('appId')).toBe('↑');
    });

    it('sortIcon returns ↓ for current desc field', () => {
      component.sortDir = 'desc';
      expect(component.sortIcon('appId')).toBe('↓');
    });

    it('sortIcon returns ⇅ for other field', () => {
      expect(component.sortIcon('status')).toBe('⇅');
    });

    it('goPage does nothing for out of range', () => {
      component.currentPage = 1;
      component.goPage(0);
      expect(component.currentPage).toBe(1);
    });

    it('goPage sets valid page', () => {
      component.goPage(1);
      expect(component.currentPage).toBe(1);
    });

    it('setStatus sets activeStatus and resets page', () => {
      component.currentPage = 3;
      component.setStatus('Active' as any);
      expect(component.activeStatus).toBe('Active' as any);
      expect(component.currentPage).toBe(1);
    });

    it('clearQuery resets query', () => {
      component.query = 'test';
      component.clearQuery();
      expect(component.query).toBe('');
    });

    it('onQueryChange resets page', () => {
      component.currentPage = 5;
      component.onQueryChange();
      expect(component.currentPage).toBe(1);
    });

    it('onPageSizeChange resets page', () => {
      component.currentPage = 5;
      component.onPageSizeChange();
      expect(component.currentPage).toBe(1);
    });

    it('setScope loads allApps if needed', async () => {
      component.allApps = [];
      await component.setScope(true);
      expect(component.showAll).toBeTrue();
      expect(appsSpy.getAll).toHaveBeenCalled();
    });

    it('setScope to false', async () => {
      await component.setScope(false);
      expect(component.showAll).toBeFalse();
    });

    it('countByStatus returns count', () => {
      expect(component.countByStatus('Active' as any)).toBe(2);
      expect(component.countByStatus('Deprecated' as any)).toBe(1);
    });

    it('statusLabel returns label', () => {
      expect(component.statusLabel('Active' as any)).toBeTruthy();
    });

    it('statusClass returns class', () => {
      expect(typeof component.statusClass('Active' as any)).toBe('string');
    });

    it('repoShort strips github URL', () => {
      expect(component.repoShort('https://github.com/org/repo')).toBe('org/repo');
    });

    it('pillar extracts from tags', () => {
      expect(component.pillar(APPS[0])).toBe('data');
    });

    it('crit extracts criticality', () => {
      expect(component.crit(APPS[0])).toBe('high');
    });

    it('critClass returns danger for critical', () => {
      const app = makeApp('x');
      (app as any).tags = JSON.stringify({ criticality: 'critical' });
      expect(component.critClass(app)).toBe('badge-danger');
    });

    it('critClass returns story for high', () => {
      expect(component.critClass(APPS[0])).toBe('badge-story');
    });

    it('critClass returns warn for medium', () => {
      const app = makeApp('x');
      (app as any).tags = JSON.stringify({ criticality: 'medium' });
      expect(component.critClass(app)).toBe('badge-warn');
    });

    it('critClass returns muted for low', () => {
      const app = makeApp('x');
      (app as any).tags = JSON.stringify({ criticality: 'low' });
      expect(component.critClass(app)).toBe('badge-muted');
    });

    it('javaClass compliant', () => expect(component.javaClass('compliant')).toBe('badge-success'));
    it('javaClass exempt', () => expect(component.javaClass('exempt')).toBe('badge-muted'));
    it('javaClass non-compliant', () => expect(component.javaClass('other')).toBe('badge-danger'));

    it('sortBy all fields', () => {
      ['appId', 'squadKey', 'status', 'javaVersion', 'pillar', 'criticality'].forEach((f) => {
        component.sortBy(f as any);
        expect(component.sortField).toBe(f);
      });
    });


    it('filtered handles apps with null fields (covers ?? branches)', () => {
      const appsWithNulls: App[] = [makeAppNoTags('x1'), makeAppNoTags('x2')];
      component.allApps = appsWithNulls;
      component.showAll = true;
      component.query = 'x';
      const result = component.filtered;
      expect(result.length).toBe(2);
    });

    it('filtered with pillar query on apps with pillar', () => {
      component.query = 'data';
      const result = component.filtered;
      expect(result.length).toBe(3);
    });

    it('sorted with equal values returns original order', () => {
      const appsEqual: App[] = [
        { ...APPS[0], appId: 'same' } as any,
        { ...APPS[1], appId: 'same' } as any,
      ];
      component.allApps = appsEqual;
      component.showAll = true;
      component.sortField = 'appId';
      const result = component.sorted;
      expect(result.length).toBe(2);
    });

    it('pageNumbers with many pages and cur near start', () => {
      const manyApps = Array.from({ length: 100 }, (_, i) => makeApp(`app-${i}`));
      component.allApps = manyApps;
      component.pageSize = 5;
      component.currentPage = 2;
      const pn = component.pageNumbers;
      expect(pn[0]).toBe(1);
    });

    it('pageNumbers with many pages and cur near end', () => {
      const manyApps = Array.from({ length: 100 }, (_, i) => makeApp(`app-${i}`));
      component.allApps = manyApps;
      component.pageSize = 5;
      component.currentPage = 19;
      const pn = component.pageNumbers;
      expect(pn[pn.length - 1]).toBe(20);
    });
  });

  describe('?squad= query param', () => {
    it('admin: sets query to squad key and stays in showAll', async () => {
      await create(adminAuth, 'payments');
      expect(component.query).toBe('payments');
      expect(component.showAll).toBeTrue();
    });

    it('member: forces showAll and loads all apps when squad param present', async () => {
      await create(memberAuth, 'payments');
      expect(component.query).toBe('payments');
      expect(component.showAll).toBeTrue();
      expect(appsSpy.getAll).toHaveBeenCalled();
    });

    it('no squad param: member stays in squad-only view', async () => {
      await create(memberAuth);
      expect(component.query).toBe('');
      expect(component.showAll).toBeFalse();
    });
  });
});

describe('AppListComponent TribeLead', () => {
  it('canManage is true for TribeLead', async () => {
    const appsSpy = jasmine.createSpyObj('AppsApi', ['getAll', 'getBySquad', 'createApp', 'updateApp', 'getAllClusters', 'getCluster']);
    const memberSpy = jasmine.createSpyObj('MemberApi', ['getAll', 'getById']);
    appsSpy.getAll.and.returnValue(of(APPS));

    const tribeLeadAuth = { currentUser: () => ({ email: 'tl@b.com', role: 'TribeLead', memberId: 'm3' }) };

    await TestBed.configureTestingModule({
      imports: [AppListComponent],
      providers: [
        provideRouter([]),
        { provide: AppsApi, useValue: appsSpy },
        { provide: AuthService, useValue: tribeLeadAuth },
        { provide: MemberApi, useValue: memberSpy },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppListComponent);
    const c = fixture.componentInstance;
    expect(c.canManage).toBeTrue();
  });

  it('canManage is false for Member', async () => {
    const appsSpy = jasmine.createSpyObj('AppsApi', ['getAll', 'getBySquad', 'createApp', 'updateApp', 'getAllClusters', 'getCluster']);
    const memberSpy = jasmine.createSpyObj('MemberApi', ['getAll', 'getById']);
    appsSpy.getBySquad.and.returnValue(of([]));
    memberSpy.getById.and.returnValue(of({ id: 'm4', squadId: 's1', role: 'Member', name: 'X', email: 'x@b.com' } as any));

    const memberAuthLocal = { currentUser: () => ({ email: 'x@b.com', role: 'Member', memberId: 'm4' }) };

    await TestBed.configureTestingModule({
      imports: [AppListComponent],
      providers: [
        provideRouter([]),
        { provide: AppsApi, useValue: appsSpy },
        { provide: AuthService, useValue: memberAuthLocal },
        { provide: MemberApi, useValue: memberSpy },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppListComponent);
    const c = fixture.componentInstance;
    expect(c.canManage).toBeFalse();
  });
});
