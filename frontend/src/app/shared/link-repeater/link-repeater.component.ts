import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Link } from '../../core/models/index';

/**
 * Repeater of {url, description} link rows for edit forms.
 * Each row has a URL input + description input + remove button; an "Add" button
 * appends a fresh empty row. Emits the cleaned, non-empty array via (linksChange).
 *
 * Usage:
 *   <app-link-repeater
 *     label="Jira"
 *     [links]="form.jira"
 *     (linksChange)="form.jira = $event"
 *     urlPlaceholder="https://jira.example.com/projects/PAY">
 *   </app-link-repeater>
 */
@Component({
  selector: 'app-link-repeater',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="repeater">
      <div class="repeater-header">
        <span class="repeater-label">{{ label }}</span>
        <button type="button" class="btn btn-ghost btn-sm" (click)="addRow()">+ Add</button>
      </div>
      @if (rows.length === 0) {
        <div class="empty-hint">No {{ label || 'links' }} yet.</div>
      }
      @for (row of rows; track $index; let i = $index) {
        <div class="row">
          <input
            class="url-input"
            type="url"
            [(ngModel)]="row.url"
            (ngModelChange)="emit()"
            [placeholder]="urlPlaceholder || 'https://…'"
            [name]="'url-' + i" />
          <input
            class="desc-input"
            type="text"
            [(ngModel)]="row.description"
            (ngModelChange)="emit()"
            placeholder="Label (optional)"
            [name]="'desc-' + i" />
          <button type="button" class="btn-remove" (click)="removeRow(i)" [attr.aria-label]="'Remove ' + (row.description || 'link')">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .repeater { display: flex; flex-direction: column; gap: 6px; }
    .repeater-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
    .repeater-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
    .empty-hint { color: var(--text-muted); font-size: 0.78rem; padding: 4px 0; font-style: italic; }
    .row { display: flex; gap: 6px; align-items: center; }
    .url-input { flex: 2 1 0; min-width: 200px; font-size: 0.82rem; padding: 5px 8px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-card); color: var(--text-strong); font-family: var(--font-mono, monospace); }
    .desc-input { flex: 1 1 0; min-width: 140px; font-size: 0.82rem; padding: 5px 8px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface-card); color: var(--text-strong); }
    .btn-remove {
      width: 24px; height: 24px; flex-shrink: 0;
      border: 1px solid var(--border); border-radius: 4px;
      background: var(--surface-card); color: var(--text-muted);
      cursor: pointer; font-size: 1.1rem; line-height: 1;
      display: grid; place-items: center;
      transition: all 120ms;
    }
    .btn-remove:hover { background: var(--danger, #e53e3e); color: #fff; border-color: var(--danger, #e53e3e); }
  `],
})
export class LinkRepeaterComponent {
  @Input() label = '';
  @Input() urlPlaceholder = '';

  /** Two-way binding via [links] / (linksChange). */
  @Input() set links(v: Link[] | null | undefined) {
    this.rows = (v ?? []).map((l) => ({ url: l.url, description: l.description ?? '' }));
  }
  @Output() linksChange = new EventEmitter<Link[]>();

  rows: Link[] = [];

  addRow() {
    this.rows = [...this.rows, { url: '', description: '' }];
    this.emit();
  }

  removeRow(i: number) {
    this.rows = this.rows.filter((_, idx) => idx !== i);
    this.emit();
  }

  emit() {
    // Drop empty rows (those with no URL) so the saved value is clean.
    const cleaned = this.rows.filter((r) => r.url.trim() !== '').map((r) => ({
      url: r.url.trim(),
      description: r.description?.trim() ?? '',
    }));
    this.linksChange.emit(cleaned);
  }
}
