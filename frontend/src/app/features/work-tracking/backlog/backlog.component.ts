import { Component, OnInit, inject, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, CdkDropList, CdkDrag, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { SquadApi } from '../../../core/api/squad.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { BacklogItem, Sprint, Role } from '../../../core/models/index';

const TYPE_CLASS: Record<string, string> = { Story: 'badge-story', Bug: 'badge-bug', Task: 'badge-task', Epic: 'badge-epic' };
const STATUS_CLASS: Record<string, string> = { Backlog: 'badge-muted', InProgress: '', Review: 'badge-warn', Done: 'badge-success' };
const MANAGER_ROLES: Role[] = ['Admin', 'AgileCoach', 'TribeLead', 'PO'];

@Component({
  selector: 'app-backlog',
  standalone: true,
  imports: [CdkDropList, CdkDrag, ReactiveFormsModule, RouterLink],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title"><h1>Backlog</h1></div>
        @if (canManage()) {
          <button class="btn btn-ghost" (click)="showSprintForm = !showSprintForm">+ New Sprint</button>
        }
        <button class="btn btn-primary" (click)="showItemForm = true">+ Add Item</button>
      </div>

      <!-- New Sprint form -->
      @if (showSprintForm && canManage()) {
        <div class="card" style="margin-bottom:16px">
          <div class="card-body">
            <div style="font-weight:600;margin-bottom:12px">Create Sprint</div>
            <form [formGroup]="sprintForm" style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
              <div class="form-field" style="grid-column:1/-1">
                <label>Sprint Name</label>
                <input class="value-input" formControlName="name" placeholder="e.g. Sprint 4 — Auth Revamp" />
              </div>
              <div class="form-field" style="grid-column:1/-1">
                <label>Goal <span style="color:var(--text-muted);font-weight:400">(optional)</span></label>
                <input class="value-input" formControlName="goal" placeholder="What this sprint delivers" />
              </div>
              <div class="form-field">
                <label>Start Date</label>
                <input class="value-input" type="date" formControlName="startDate" />
              </div>
              <div class="form-field">
                <label>End Date</label>
                <input class="value-input" type="date" formControlName="endDate" />
              </div>
              @if (sprintError) {
                <div class="inline-error" style="grid-column:1/-1">{{ sprintError }}</div>
              }
            </form>
          </div>
          <div class="card-footer-row" style="justify-content:flex-end;gap:8px">
            <button class="btn btn-ghost" (click)="cancelSprintForm()">Cancel</button>
            <button class="btn btn-primary" (click)="createSprint()" [disabled]="sprintForm.invalid || savingSprint">
              @if (savingSprint) { <span class="spinner"></span> } Create Sprint
            </button>
          </div>
        </div>
      }

      <!-- Active Sprint banner -->
      @if (activeSprint) {
        <div class="sprint-banner sprint-active">
          <div class="sprint-banner-left">
            <span class="sprint-status-dot" style="background:#22c55e"></span>
            <div>
              <div class="sprint-banner-name">{{ activeSprint.name }}</div>
              <div class="sprint-banner-meta">Active &nbsp;·&nbsp; {{ fmt(activeSprint.startDate) }} – {{ fmt(activeSprint.endDate) }} &nbsp;·&nbsp; {{ sprintItemCount(activeSprint.id) }} items</div>
            </div>
          </div>
          <a class="btn btn-primary btn-sm" [routerLink]="['/work/squads', squadId, 'sprint']">Go to Board →</a>
        </div>
      }

      <!-- Planning sprints -->
      @for (sprint of planningSprints; track sprint.id) {
        <div class="card" style="margin-bottom:12px">
          <div class="card-body" style="padding-bottom:4px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
              <div>
                <div style="font-weight:600;display:flex;align-items:center;gap:8px">
                  <span class="sprint-status-dot" style="background:#f59e0b"></span>
                  {{ sprint.name }}
                  <span class="badge badge-warn" style="font-size:0.7rem">Planning</span>
                </div>
                <div style="color:var(--text-muted);font-size:0.82rem;margin-top:2px">
                  {{ fmt(sprint.startDate) }} – {{ fmt(sprint.endDate) }}
                  @if (sprint.goal) { &nbsp;·&nbsp; {{ sprint.goal }} }
                </div>
              </div>
              @if (canManage()) {
                <button class="btn btn-primary btn-sm" (click)="startSprint(sprint)" [disabled]="!!activeSprint">
                  Start Sprint
                </button>
              }
            </div>

            <!-- Sprint items -->
            @if (getSprintItems(sprint.id).length) {
              <div class="sprint-item-list">
                @for (item of getSprintItems(sprint.id); track item.id) {
                  <div class="sprint-item-row">
                    <span class="badge" [class]="typeClass(item.type)">{{ item.type }}</span>
                    <span style="flex:1;font-size:0.875rem">{{ item.title }}</span>
                    @if (item.storyPoints) { <span class="pts">{{ item.storyPoints }}pt</span> }
                    @if (canManage()) {
                      <button class="icon-btn" title="Remove from sprint" (click)="removeFromSprint(sprint, item)">✕</button>
                    }
                  </div>
                }
              </div>
            } @else {
              <div style="color:var(--text-subtle);font-size:0.82rem;padding:4px 0 8px">No items assigned yet.</div>
            }
          </div>
        </div>
      }

      <!-- Backlog items -->
      <div class="section-label">
        Backlog
        <span class="section-count">{{ unassignedItems.length }}</span>
      </div>

      <div cdkDropList class="backlog-list" (cdkDropListDropped)="onDrop($event)">
        @for (item of unassignedItems; track item.id) {
          <div cdkDrag class="drag-card backlog-item">
            <div class="drag-handle" cdkDragHandle>⠿</div>
            <div class="item-body">
              <span class="item-title">{{ item.title }}</span>
              <div class="item-meta">
                <span class="badge" [class]="typeClass(item.type)">{{ item.type }}</span>
                <span class="badge" [class]="statusClass(item.status)">{{ item.status }}</span>
                @if (item.storyPoints) { <span class="pts">{{ item.storyPoints }}pt</span> }
              </div>
            </div>
            @if (canManage() && planningSprints.length) {
              <div class="sprint-assign">
                @if (planningSprints.length === 1) {
                  <button class="btn btn-ghost btn-sm" (click)="addToSprint(planningSprints[0], item)">+ Sprint</button>
                } @else {
                  <select class="value-input" style="font-size:0.8rem;padding:2px 6px;height:auto" (change)="onAddToSprintSelect($event, item)">
                    <option value="">+ Sprint</option>
                    @for (s of planningSprints; track s.id) {
                      <option [value]="s.id">{{ s.name }}</option>
                    }
                  </select>
                }
              </div>
            }
          </div>
        }
        @empty {
          <div class="empty-state">
            <div class="empty-icon">◻</div>
            <div class="empty-title">Backlog is empty.</div>
            <div class="empty-sub">All items are assigned to sprints, or none have been created yet.</div>
          </div>
        }
      </div>
    }

    <!-- Add Item drawer -->
    @if (showItemForm) {
      <div class="drawer-overlay" (click)="showItemForm = false">
        <div class="drawer-panel" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h3>Add Backlog Item</h3>
            <button class="btn btn-ghost btn-sm" (click)="showItemForm = false">✕</button>
          </div>
          <div class="drawer-body">
            <form [formGroup]="itemForm">
              <div class="form-field">
                <label>Title</label>
                <input class="value-input" formControlName="title" placeholder="Item title" />
              </div>
              <div class="form-field">
                <label>Description</label>
                <textarea class="value-input" formControlName="description" rows="3" placeholder="Optional description"></textarea>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem">
                <div class="form-field">
                  <label>Type</label>
                  <select class="value-input" formControlName="type">
                    <option value="Story">Story</option>
                    <option value="Bug">Bug</option>
                    <option value="Task">Task</option>
                    <option value="Epic">Epic</option>
                  </select>
                </div>
                <div class="form-field">
                  <label>Story Points</label>
                  <input class="value-input" type="number" formControlName="storyPoints" min="0" />
                </div>
              </div>
            </form>
          </div>
          <div class="drawer-footer">
            <button class="btn btn-ghost" (click)="showItemForm = false">Cancel</button>
            <button class="btn btn-primary" (click)="submitItem()" [disabled]="itemForm.invalid || saving">
              @if (saving) { <span class="spinner"></span> } Save
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .sprint-banner { display:flex; align-items:center; justify-content:space-between; background:var(--surface-card); border:1px solid var(--border); border-radius:var(--radius); padding:12px 16px; margin-bottom:12px; }
    .sprint-banner-left { display:flex; align-items:center; gap:12px; }
    .sprint-banner-name { font-weight:600; }
    .sprint-banner-meta { font-size:0.8rem; color:var(--text-muted); margin-top:1px; }
    .sprint-status-dot { display:inline-block; width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .sprint-item-list { border-top:1px solid var(--border); padding-top:6px; margin-top:6px; }
    .sprint-item-row { display:flex; align-items:center; gap:8px; padding:5px 0; border-bottom:1px solid var(--border-subtle,#f1f5f9); }
    .sprint-item-row:last-child { border-bottom:none; }
    .icon-btn { background:none; border:none; cursor:pointer; color:var(--text-muted); font-size:0.75rem; padding:2px 4px; border-radius:3px; }
    .icon-btn:hover { background:#fee2e2; color:var(--danger); }
    .section-label { font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--text-muted); margin:16px 0 8px; display:flex; align-items:center; gap:8px; }
    .section-count { background:var(--surface-alt,#f1f5f9); border-radius:999px; padding:1px 8px; font-size:0.72rem; }
    .backlog-list { min-height:80px; }
    .backlog-item { display:flex; align-items:center; background:var(--surface-card); border:1px solid var(--border); border-radius:var(--radius-sm); margin-bottom:8px; padding:10px 14px; cursor:grab; gap:10px; }
    .backlog-item:active { cursor:grabbing; }
    .drag-handle { color:var(--text-subtle); font-size:1rem; cursor:grab; user-select:none; }
    .item-body { flex:1; min-width:0; }
    .item-title { font-weight:500; display:block; margin-bottom:5px; color:var(--text-strong); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .item-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .pts { font-size:0.72rem; color:var(--text-muted); background:var(--blue-50,#eff6ff); padding:1px 6px; border-radius:4px; }
    .sprint-assign { flex-shrink:0; }
    .inline-error { background:#fef2f2; border:1px solid #fecaca; border-radius:var(--radius-sm); padding:8px 12px; color:var(--danger); font-size:0.85rem; }
  `],
})
export class BacklogComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private squadApi = inject(SquadApi);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);

  squadId = '';
  allItems: BacklogItem[] = [];
  sprints: Sprint[] = [];
  loading = true;
  showItemForm = false;
  showSprintForm = false;
  saving = false;
  savingSprint = false;
  sprintError = '';

  readonly canManage = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return false;
    return (MANAGER_ROLES as string[]).includes(u.role);
  });

  get activeSprint(): Sprint | undefined {
    return this.sprints.find((s) => s.status === 'Active');
  }
  get planningSprints(): Sprint[] {
    return this.sprints.filter((s) => s.status === 'Planning');
  }
  get unassignedItems(): BacklogItem[] {
    return this.allItems.filter((i) => !i.sprintId);
  }

  getSprintItems(sprintId: string): BacklogItem[] {
    return this.allItems.filter((i) => i.sprintId === sprintId);
  }
  sprintItemCount(sprintId: string): number {
    return this.allItems.filter((i) => i.sprintId === sprintId).length;
  }
  typeClass = (t: string) => TYPE_CLASS[t] ?? '';
  statusClass = (s: string) => STATUS_CLASS[s] ?? '';
  fmt = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  sprintForm = this.fb.group({
    name: ['', Validators.required],
    goal: [''],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
  });

  itemForm = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    type: ['Story'],
    storyPoints: [0],
  });

  async ngOnInit() {
    this.squadId = this.route.snapshot.paramMap.get('squadId')!;
    const [items, sprints] = await Promise.all([
      firstValueFrom(this.squadApi.getBacklog(this.squadId)),
      firstValueFrom(this.squadApi.getSprints(this.squadId)),
    ]);
    this.allItems = items;
    this.sprints = sprints;
    this.loading = false;
  }

  cancelSprintForm() {
    this.showSprintForm = false;
    this.sprintForm.reset();
    this.sprintError = '';
  }

  async createSprint() {
    if (this.sprintForm.invalid) return;
    this.savingSprint = true;
    this.sprintError = '';
    const v = this.sprintForm.value;
    try {
      const sprint = await firstValueFrom(this.squadApi.createSprint(this.squadId, {
        name: v.name!,
        goal: v.goal ?? '',
        startDate: new Date(v.startDate!).toISOString(),
        endDate: new Date(v.endDate!).toISOString(),
      }));
      this.sprints = [...this.sprints, sprint];
      this.cancelSprintForm();
    } catch (err: unknown) {
      this.sprintError = (err as { error?: { error?: string } })?.error?.error ?? 'Failed to create sprint';
    } finally {
      this.savingSprint = false;
    }
  }

  async startSprint(sprint: Sprint) {
    const started = await firstValueFrom(this.squadApi.startSprint(this.squadId, sprint.id));
    this.sprints = this.sprints.map((s) => s.id === sprint.id ? started : s);
  }

  async addToSprint(sprint: Sprint, item: BacklogItem) {
    await firstValueFrom(this.squadApi.addSprintItem(this.squadId, sprint.id, item.id));
    this.allItems = this.allItems.map((i) => i.id === item.id ? { ...i, sprintId: sprint.id } : i);
  }

  onAddToSprintSelect(event: Event, item: BacklogItem) {
    const sprintId = (event.target as HTMLSelectElement).value;
    if (!sprintId) return;
    (event.target as HTMLSelectElement).value = '';
    const sprint = this.sprints.find((s) => s.id === sprintId);
    if (sprint) this.addToSprint(sprint, item);
  }

  async removeFromSprint(sprint: Sprint, item: BacklogItem) {
    await firstValueFrom(this.squadApi.removeSprintItem(this.squadId, sprint.id, item.id));
    this.allItems = this.allItems.map((i) => i.id === item.id ? { ...i, sprintId: '' } : i);
  }

  async onDrop(event: CdkDragDrop<BacklogItem[]>) {
    const unassigned = [...this.unassignedItems];
    moveItemInArray(unassigned, event.previousIndex, event.currentIndex);
    const reordered = unassigned.map((item, i) => ({ id: item.id, priority: (i + 1) * 10 }));
    // Update local order without reassigning allItems reference
    const priorityMap = new Map(reordered.map((r) => [r.id, r.priority]));
    this.allItems = this.allItems.map((i) => priorityMap.has(i.id) ? { ...i, priority: priorityMap.get(i.id)! } : i);
    await firstValueFrom(this.squadApi.reorderBacklog(this.squadId, reordered));
  }

  async submitItem() {
    if (this.itemForm.invalid) return;
    this.saving = true;
    const item = await firstValueFrom(
      this.squadApi.createBacklogItem(this.squadId, this.itemForm.value as Record<string, unknown>),
    );
    this.allItems = [item, ...this.allItems];
    this.itemForm.reset({ title: '', description: '', type: 'Story', storyPoints: 0 });
    this.showItemForm = false;
    this.saving = false;
  }
}
