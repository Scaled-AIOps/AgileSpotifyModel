import { Component, OnInit, inject, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CdkDragDrop, CdkDropList, CdkDrag, transferArrayItem, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { SquadApi } from '../../../core/api/squad.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { BacklogItem, Sprint, Squad, Role } from '../../../core/models/index';

type Status = 'Backlog' | 'InProgress' | 'Review' | 'Done';

const COLUMNS: { status: Status; label: string; bg: string; accent: string }[] = [
  { status: 'Backlog',    label: 'Backlog',     bg: '#f8fafc', accent: '#94a3b8' },
  { status: 'InProgress', label: 'In Progress', bg: '#eff6ff', accent: '#3b82f6' },
  { status: 'Review',     label: 'In Review',   bg: '#fffbeb', accent: '#f59e0b' },
  { status: 'Done',       label: 'Done',        bg: '#f0fdf4', accent: '#22c55e' },
];

const TYPE_CLASS: Record<string, string> = { Story: 'badge-story', Bug: 'badge-bug', Task: 'badge-task', Epic: 'badge-epic' };
const MANAGER_ROLES: Role[] = ['Admin', 'AgileCoach', 'TribeLead', 'PO'];

@Component({
  selector: 'app-sprint-board',
  standalone: true,
  imports: [CdkDropList, CdkDrag, RouterLink],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title">
          <h1>Sprint Board</h1>
          @if (sprint) {
            <div class="page-sub">{{ sprint.name }} — {{ sprint.goal }}</div>
          } @else {
            <div class="page-sub" style="color:var(--warn)">No active sprint. <a [routerLink]="['/work/squads', squadId, 'backlog']" style="color:var(--primary)">Go to Backlog →</a></div>
          }
        </div>
        @if (sprint?.status === 'Active' && canManageSprint()) {
          <button class="btn btn-ghost" style="color:var(--danger);border-color:#fecaca" (click)="completeSprint()">Complete Sprint</button>
        }
      </div>

      <div class="board">
        @for (col of columns; track col.status) {
          <div class="column" [style.background]="col.bg">
            <div class="col-header">
              <span class="col-label" [style.color]="col.accent">{{ col.label }}</span>
              <span class="count">{{ getItems(col.status).length }}</span>
            </div>
            <div
              cdkDropList
              [id]="col.status"
              [cdkDropListData]="getItems(col.status)"
              [cdkDropListConnectedTo]="connectedLists"
              class="col-list"
              (cdkDropListDropped)="onDrop($event, col.status)">
              @for (item of getItems(col.status); track item.id) {
                <div cdkDrag class="drag-card kanban-card">
                  <div class="card-title">{{ item.title }}</div>
                  <div class="card-meta">
                    <span class="badge" [class]="typeClass(item.type)">{{ item.type }}</span>
                    @if (item.storyPoints) { <span class="pts">{{ item.storyPoints }}pt</span> }
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .column { border-radius: var(--radius); padding: 12px; min-height: 400px; border: 1px solid var(--border); }
    .col-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .col-label { font-weight: 600; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .count { background: rgba(0,0,0,0.08); border-radius: 999px; padding: 0 8px; font-size: 0.78rem; font-weight: 600; }
    .col-list { min-height: 40px; }
    .kanban-card { background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 8px; cursor: grab; box-shadow: var(--shadow-sm); }
    .kanban-card:active { cursor: grabbing; }
    .card-title { font-size: 0.875rem; font-weight: 500; color: var(--text-strong); margin-bottom: 6px; }
    .card-meta { display: flex; align-items: center; gap: 6px; }
    .pts { font-size: 0.72rem; color: var(--text-muted); background: var(--blue-50); padding: 1px 5px; border-radius: 4px; }
  `],
})
export class SprintBoardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private squadApi = inject(SquadApi);
  private auth = inject(AuthService);

  squadId = '';
  sprint: Sprint | null = null;
  squad: Squad | null = null;
  allItems: BacklogItem[] = [];
  itemsByStatus: Record<Status, BacklogItem[]> = { Backlog: [], InProgress: [], Review: [], Done: [] };
  loading = true;
  readonly columns = COLUMNS;
  readonly connectedLists = COLUMNS.map((c) => c.status);

  readonly canManageSprint = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return false;
    if ((MANAGER_ROLES as string[]).includes(u.role)) return true;
    if (this.squad) return u.email === this.squad.sm || u.email === this.squad.po;
    return false;
  });

  getItems(status: Status): BacklogItem[] { return this.itemsByStatus[status]; }
  typeClass = (t: string) => TYPE_CLASS[t] ?? '';

  async ngOnInit() {
    this.squadId = this.route.snapshot.paramMap.get('squadId')!;
    const [sprint, squad] = await Promise.all([
      firstValueFrom(this.squadApi.getActiveSprint(this.squadId)).catch(() => null),
      firstValueFrom(this.squadApi.getById(this.squadId)).catch(() => null),
    ]);
    this.sprint = sprint;
    this.squad = squad;
    this.allItems = await firstValueFrom(this.squadApi.getBacklog(this.squadId));
    this.distributeItems();
    this.loading = false;
  }

  distributeItems() {
    this.itemsByStatus = { Backlog: [], InProgress: [], Review: [], Done: [] };
    for (const item of this.allItems) {
      this.itemsByStatus[item.status as Status]?.push(item);
    }
  }

  async onDrop(event: CdkDragDrop<BacklogItem[]>, toStatus: Status) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
      const item = event.container.data[event.currentIndex];
      await firstValueFrom(this.squadApi.updateBacklogStatus(this.squadId, item.id, toStatus));
      item.status = toStatus;
    }
  }

  async completeSprint() {
    if (!this.sprint) return;
    this.sprint = await firstValueFrom(this.squadApi.completeSprint(this.squadId, this.sprint.id));
  }
}
