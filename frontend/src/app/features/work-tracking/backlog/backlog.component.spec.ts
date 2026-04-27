import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { BacklogComponent } from './backlog.component';
import { SquadApi } from '../../../core/api/squad.api';
import type { BacklogItem } from '../../../core/models/index';

const ITEMS: BacklogItem[] = [
  { id: 'i1', title: 'Task 1', type: 'Story', status: 'Backlog', priority: 10 } as any,
  { id: 'i2', title: 'Task 2', type: 'Bug', status: 'InProgress', priority: 20 } as any,
];

describe('BacklogComponent', () => {
  let squadSpy: jasmine.SpyObj<SquadApi>;
  let component: BacklogComponent;

  beforeEach(async () => {
    squadSpy = jasmine.createSpyObj('SquadApi', [
      'getBacklog', 'createBacklogItem', 'updateBacklogItem', 'deleteBacklogItem',
      'reorderBacklog', 'updateBacklogStatus',
    ]);
    squadSpy.getBacklog.and.returnValue(of(ITEMS));
    squadSpy.createBacklogItem.and.returnValue(of({ id: 'i3', title: 'New', type: 'Task', status: 'Backlog', priority: 30 } as any));
    squadSpy.reorderBacklog.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [BacklogComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 's1' } } } },
        { provide: SquadApi, useValue: squadSpy },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BacklogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('typeClass returns class for known types', () => {
    expect(typeof component.typeClass('Story')).toBe('string');
    expect(component.typeClass('unknown')).toBe('');
  });

  it('statusClass returns class string', () => {
    expect(typeof component.statusClass('Backlog')).toBe('string');
    expect(component.statusClass('unknown')).toBe('');
  });

  it('submitItem does nothing when form is invalid', async () => {
    component.itemForm.reset();
    await component.submitItem();
    expect(squadSpy.createBacklogItem).not.toHaveBeenCalled();
  });

  it('submitItem creates item when form is valid', async () => {
    component.itemForm.setValue({ title: 'New Task', description: '', type: 'Task', storyPoints: 3 });
    await component.submitItem();
    expect(squadSpy.createBacklogItem).toHaveBeenCalled();
    expect(component.items.length).toBe(3);
    expect(component.showForm).toBeFalse();
    expect(component.saving).toBeFalse();
  });
});
