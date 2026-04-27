/**
 * Purpose: Loads /auth/config at startup to learn which auth methods are enabled.
 * Usage:   Eagerly initialised by APP_INITIALIZER in app.config.ts; the login page reads `basicEnabled() / jiraEnabled() / adEnabled()` to decide which buttons to show.
 * Goal:    Avoid hard-coding server feature flags in the SPA bundle; let the backend advertise its capabilities at runtime.
 * ToDo:    —
 */
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthConfig { basic: boolean; jira: boolean; ad: boolean; }

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private _auth = signal<AuthConfig>({ basic: true, jira: false, ad: false });
  readonly authConfig  = this._auth.asReadonly();
  readonly basicEnabled = computed(() => this._auth().basic);
  readonly jiraEnabled  = computed(() => this._auth().jira);
  readonly adEnabled    = computed(() => this._auth().ad);

  constructor(private http: HttpClient) {}

  async load(): Promise<void> {
    try {
      const c = await firstValueFrom(
        this.http.get<AuthConfig>(`${environment.apiUrl}/auth/config`)
      );
      this._auth.set(c);
    } catch { /* keep defaults */ }
  }
}
