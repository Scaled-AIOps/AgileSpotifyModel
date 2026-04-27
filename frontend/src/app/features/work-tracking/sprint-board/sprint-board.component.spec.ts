import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { SprintBoardComponent } from './sprint-board.component';
import { SquadApi } from '../../../core/api/squad.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { BacklogItem, Sprint, Squad } from '../../../core/models/index';

const SPRINT: Sprint = { id: 'sp1', name: 'Sprint 1', squadId: 's1', status: 'active', goal: 'Ship it', startDate: '2025-01-01', endDate: '2025-01-14' } as any;
const ITEMS: BacklogItem[] = [
  { id: 'i1', title: 'Task 1', status: 'InProgress', type: 'Story' } as any,
  { id: 'i2', title: 'Task 2', status: 'Done', type: 'Bug' } as any,
  { id: 'i3', title: 'Task 3', status: 'Backlog', type: 'Task' } as any,
];
const SQUAD: Squad = { id: 's1', name: 'Squad A', tribeId: 't1', po: 'po@test.com', sm: 'sm@test.com' } as any;

describe('SprintBoardComponent', () => {
  let squadSpy: jasmine.SpyObj<SquadApi>;
  let component: SprintBoardComponent;

  const adminAuth = { currentUser: () => ({ email: 'admin@test.com', role: 'Admin', memberId: 'm1' }) };

  async function create(auth: any = adminAuth) {
    squadSpy = jasmine.createSpyObj('SquadApi', [
      'getById', 'getActiveSprint', 'getBacklog', 'getSprints', 'startSprint',
      'completeSprint', 'addSprintItem', 'removeSprintItem', 'updateBacklogStatus',
    ]);
    squadSpy.getById.and.returnValue(of(SQUAD));
    squadSpy.getActiveSprint.and.returnValue(of(SPRINT));
    squadSpy.getBacklog.and.returnValue(of(ITEMS));
    squadSpy.completeSprint.and.returnValue(of({ ...SPRINT, status: 'completed' } as any));
    squadSpy.updateBacklogStatus.and.returnValue(of(ITEMS[0]));

    await TestBed.configureTestingModule({
      imports: [SprintBoardComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 's1' } } } },
        { provide: SquadApi, useValue: squadSpy },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SprintBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    return component;
  }

  it('should create and load sprint', async () => {
    await create();
    expect(component).toBeTruthy();
    expect(component.loading).toBeFalse();
    expect(component.sprint?.id).toBe('sp1');
  });

  it('distributeItems places items in correct columns', async () => {
    await create();
    expect(component.itemsByStatus['InProgress'].length).toBe(1);
    expect(component.itemsByStatus['Done'].length).toBe(1);
    expect(component.itemsByStatus['Backlog'].length).toBe(1);
  });

  it('getItems returns items for status', async () => {
    await create();
    expect(component.getItems('InProgress').length).toBe(1);
  });

  it('typeClass returns class string', async () => {
    await create();
    expect(typeof component.typeClass('Story')).toBe('string');
  });

  it('canManageSprint returns true for Admin', async () => {
    await create(adminAuth);
    expect(component.canManageSprint()).toBeTrue();
  });

  it('canManageSprint returns false when no user', async () => {
    const c = await create({ currentUser: () => null });
    expect(c.canManageSprint()).toBeFalse();
  });

  it('canManageSprint returns true when user is SM', async () => {
    const c = await create({ currentUser: () => ({ email: 'sm@test.com', role: 'Member' }) });
    expect(c.canManageSprint()).toBeTrue();
  });

  it('completeSprint calls API', async () => {
    await create();
    await component.completeSprint();
    expect(squadSpy.completeSprint).toHaveBeenCalledWith('s1', 'sp1');
  });

  it('completeSprint does nothing when no sprint', async () => {
    await create();
    component.sprint = null;
    await component.completeSprint();
    expect(squadSpy.completeSprint).not.toHaveBeenCalled();
  });

  it('loads with no active sprint', async () => {
    squadSpy = jasmine.createSpyObj('SquadApi', ['getById', 'getActiveSprint', 'getBacklog', 'completeSprint', 'updateBacklogStatus', 'addSprintItem', 'removeSprintItem', 'startSprint', 'getSprints']);
    squadSpy.getById.and.returnValue(of(SQUAD));
    squadSpy.getActiveSprint.and.returnValue(of(null as any));
    squadSpy.getBacklog.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [SprintBoardComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 's1' } } } },
        { provide: SquadApi, useValue: squadSpy },
        { provide: AuthService, useValue: adminAuth },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SprintBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.sprint).toBeNull();
  });
});
