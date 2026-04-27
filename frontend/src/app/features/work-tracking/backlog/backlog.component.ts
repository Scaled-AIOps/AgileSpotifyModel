import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, CdkDropList, CdkDrag, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { SquadApi } from '../../../core/api/squad.api';
import type { BacklogItem } from '../../../core/models/index';

const TYPE_CLASS: Record<string, string> = { Story: 'badge-story', Bug: 'badge-bug', Task: 'badge-task', Epic: 'badge-epic' };
const STATUS_CLASS: Record<string, string> = { Backlog: 'badge-muted', InProgress: '', Review: 'badge-warn', Done: 'badge-success' };

@Component({
  selector: 'app-backlog',
  standalone: true,
  imports: [CdkDropList, CdkDrag, ReactiveFormsModule],
  template: `
    @if (loading) { <div class="loading-block"><span class="spinner spinner-lg"></span></div> }
    @else {
      <div class="page-header">
        <div class="page-title"><h1>Backlog</h1></div>
        <button class="btn btn-primary" (click)="showForm = true">+ Add Item</button>
      </div>

      <div cdkDropList class="backlog-list" (cdkDropListDropped)="onDrop($event)">
        @for (item of items; track item.id) {
          <div cdkDrag class="drag-card backlog-item">
            <div class="drag-handle" cdkDragHandle>⠿</div>
            <div class="item-body">
              <span class="item-title">{{ item.title }}</span>
              <div class="item-meta">
                <span class="badge" [class]="typeClass(item.type)">{{ item.type }}</span>
                <span class="badge" [class]="statusClass(item.status)">{{ item.status }}</span>
                @if (item.storyPoints) {
                  <span class="pts">{{ item.storyPoints }}pt</span>
                }
              </div>
            </div>
          </div>
        }
        @empty {
          <div class="empty-state"><div class="empty-icon">◻</div><div class="empty-title">No backlog items yet.</div></div>
        }
      </div>
    }

    @if (showForm) {
      <div class="drawer-overlay" (click)="showForm = false">
        <div class="drawer-panel" (click)="$event.stopPropagation()">
          <div class="drawer-header">
            <h3>Add Backlog Item</h3>
            <button class="btn btn-ghost btn-sm" (click)="showForm = false">✕</button>
          </div>
          <div class="drawer-body">
            <form [formGroup]="itemForm" (ngSubmit)="submitItem()">
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
            <button class="btn btn-ghost" (click)="showForm = false">Cancel</button>
            <button class="btn btn-primary" (click)="submitItem()" [disabled]="itemForm.invalid || saving">
              @if (saving) { <span class="spinner"></span> } Save
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .backlog-list { min-height: 120px; }
    .backlog-item { display: flex; align-items: center; background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 8px; padding: 10px 14px; cursor: grab; gap: 10px; }
    .backlog-item:active { cursor: grabbing; }
    .drag-handle { color: var(--text-subtle); font-size: 1rem; cursor: grab; user-select: none; }
    .item-body { flex: 1; }
    .item-title { font-weight: 500; display: block; margin-bottom: 5px; color: var(--text-strong); }
    .item-meta { display: flex; align-items: center; gap: 6px; }
    .pts { font-size: 0.75rem; color: var(--text-muted); background: var(--blue-50); padding: 1px 6px; border-radius: 4px; }
  `],
})
export class BacklogComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private squadApi = inject(SquadApi);
  private fb = inject(FormBuilder);

  squadId = '';
  items: BacklogItem[] = [];
  loading = true;
  showForm = false;
  saving = false;

  typeClass = (t: string) => TYPE_CLASS[t] ?? '';
  statusClass = (s: string) => STATUS_CLASS[s] ?? '';

  itemForm = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    type: ['Story'],
    storyPoints: [0],
  });

  async ngOnInit() {
    this.squadId = this.route.snapshot.paramMap.get('squadId')!;
    this.items = await firstValueFrom(this.squadApi.getBacklog(this.squadId));
    this.loading = false;
  }

  async onDrop(event: CdkDragDrop<BacklogItem[]>) {
    moveItemInArray(this.items, event.previousIndex, event.currentIndex);
    const reordered = this.items.map((item, i) => ({ id: item.id, priority: (i + 1) * 10 }));
    await firstValueFrom(this.squadApi.reorderBacklog(this.squadId, reordered));
  }

  async submitItem() {
    if (this.itemForm.invalid) return;
    this.saving = true;
    const item = await firstValueFrom(this.squadApi.createBacklogItem(this.squadId, this.itemForm.value as Record<string, unknown>));
    this.items.unshift(item);
    this.itemForm.reset({ title: '', description: '', type: 'Story', storyPoints: 0 });
    this.showForm = false;
    this.saving = false;
  }
}
