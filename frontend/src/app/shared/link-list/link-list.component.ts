import { Component, Input } from '@angular/core';
import type { Link } from '../../core/models/index';

/**
 * Renders an array of {url, description} links as a compact vertical list.
 * Each row shows the description (or a shortened URL if no description) as
 * the visible text, with the URL exposed via title and the link target.
 *
 * Usage: <app-link-list [links]="squad.jira" label="Jira"></app-link-list>
 */
@Component({
  selector: 'app-link-list',
  standalone: true,
  imports: [],
  template: `
    @if (links?.length) {
      <div class="link-list">
        @if (label) { <div class="link-list-label">{{ label }}</div> }
        <ul>
          @for (l of links; track l.url) {
            <li>
              <a [href]="l.url" target="_blank" rel="noopener" [title]="l.url">
                {{ l.description || shortUrl(l.url) }}
              </a>
              @if (l.description) {
                <span class="link-host">{{ host(l.url) }}</span>
              }
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: [`
    .link-list { font-size: 0.85rem; }
    .link-list-label {
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 4px;
    }
    ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 3px; }
    li { display: flex; align-items: baseline; gap: 8px; }
    a {
      color: var(--blue-600); font-weight: 500; text-decoration: none;
      max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    a:hover { text-decoration: underline; }
    .link-host { color: var(--text-muted); font-size: 0.72rem; font-family: var(--font-mono, monospace); }
  `],
})
export class LinkListComponent {
  @Input() links: Link[] | null = [];
  @Input() label = '';

  shortUrl(url: string): string {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/^\//, '').replace(/\/$/, '');
      return path ? `${u.host}/${path}` : u.host;
    } catch {
      return url;
    }
  }

  host(url: string): string {
    try { return new URL(url).host; } catch { return ''; }
  }
}
