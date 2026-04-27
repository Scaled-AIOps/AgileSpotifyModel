import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <header class="topbar">
        <a class="brand" routerLink="/apps">
          <div class="brand-mark">S</div>
          <span class="brand-name">Spotify Model</span>
        </a>

        <nav class="topnav">
          <a class="topnav-item" routerLink="/dashboard" routerLinkActive="active" title="Dashboard">
            <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor">
              <rect x="2" y="2" width="7" height="7" rx="1.5"/>
              <rect x="11" y="2" width="7" height="7" rx="1.5"/>
              <rect x="2" y="11" width="7" height="7" rx="1.5"/>
              <rect x="11" y="11" width="7" height="7" rx="1.5"/>
            </svg>
            <span class="nav-label">Dashboard</span>
          </a>
          <a class="topnav-item" routerLink="/org" routerLinkActive="active" title="Org Directory">
            <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="10" cy="4" r="2.2"/>
              <rect x="8.8" y="6.2" width="2.4" height="3.4" rx="0.5"/>
              <circle cx="4" cy="14" r="2.2"/>
              <rect x="2.8" y="11.8" width="2.4" height="2.2" rx="0.5"/>
              <circle cx="16" cy="14" r="2.2"/>
              <rect x="14.8" y="11.8" width="2.4" height="2.2" rx="0.5"/>
              <line x1="10" y1="9.6" x2="4" y2="11.8" stroke="currentColor" stroke-width="1.4" fill="none"/>
              <line x1="10" y1="9.6" x2="16" y2="11.8" stroke="currentColor" stroke-width="1.4" fill="none"/>
            </svg>
            <span class="nav-label">Org Directory</span>
          </a>
          @if (canAccessAdmin) {
            <a class="topnav-item" routerLink="/admin" routerLinkActive="active" title="Admin">
              <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a3 3 0 100 6 3 3 0 000-6zm-7 14c0-3.314 3.134-6 7-6s7 2.686 7 6H3z"/>
              </svg>
              <span class="nav-label">Admin</span>
            </a>
          }
        </nav>

        <div class="topbar-right">
          <div class="user-chip">
            <div class="user-avatar">{{ initials }}</div>
            <div class="user-meta">
              <span class="user-name">{{ currentUser()?.email }}</span>
              <span class="user-role">{{ currentUser()?.role }}</span>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" (click)="logout()">Sign out</button>
        </div>
      </header>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; }
    .shell { display: flex; flex-direction: column; height: 100vh; }

    /* ── Topbar ── */
    .topbar {
      height: 56px;
      background: linear-gradient(90deg, var(--blue-900) 0%, var(--blue-800) 100%);
      border-bottom: 1px solid var(--blue-700);
      display: flex;
      align-items: center;
      gap: 0;
      padding: 0 1.25rem;
      flex-shrink: 0;
    }

    /* Brand */
    .brand {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      text-decoration: none;
      margin-right: 1.5rem;
    }
    .brand-mark {
      width: 32px; height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, var(--blue-400), var(--blue-200));
      color: var(--blue-900);
      display: grid; place-items: center;
      font-weight: 700; font-size: 1rem;
      flex-shrink: 0;
    }
    .brand-name { font-weight: 600; font-size: 0.95rem; color: #fff; letter-spacing: 0.01em; }

    /* Top nav */
    .topnav {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      flex: 1;
    }
    .topnav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 5px 14px;
      border-radius: 8px;
      color: var(--blue-200);
      text-decoration: none;
      transition: background 120ms, color 120ms;
    }
    .topnav-item:hover { background: rgba(255,255,255,0.08); color: #fff; text-decoration: none; }
    .topnav-item.active { background: rgba(255,255,255,0.14); color: #fff; }
    .nav-svg { width: 18px; height: 18px; flex-shrink: 0; }
    .nav-label { font-size: 0.66rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; line-height: 1; }

    /* Right side */
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-left: auto;
    }
    .user-chip {
      display: inline-flex; align-items: center; gap: 0.45rem;
      padding: 0.2rem 0.65rem 0.2rem 0.25rem;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 999px;
    }
    .user-avatar {
      width: 26px; height: 26px; border-radius: 50%;
      background: linear-gradient(135deg, var(--blue-400), var(--blue-200));
      color: var(--blue-900);
      font-weight: 700; font-size: 0.8rem;
      display: grid; place-items: center;
    }
    .user-meta { display: flex; flex-direction: column; line-height: 1.15; }
    .user-name { color: #fff; font-weight: 500; font-size: 0.82rem; }
    .user-role { color: var(--blue-300); font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }

    /* Override ghost button colours for dark topbar */
    .btn-ghost { color: var(--blue-200); border-color: rgba(255,255,255,0.2); }
    .btn-ghost:hover { background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.35); }

    /* ── Content ── */
    .content { flex: 1; overflow: auto; padding: 1.75rem 2rem; }
  `],
})
export class ShellComponent {
  private auth = inject(AuthService);
  readonly currentUser = this.auth.currentUser;
  get initials() { return (this.currentUser()?.email ?? 'U').charAt(0).toUpperCase(); }
  get canAccessAdmin() { const r = this.currentUser()?.role; return r === 'Admin' || r === 'AgileCoach' || r === 'TribeLead'; }
  logout() { this.auth.logout(); }
}
