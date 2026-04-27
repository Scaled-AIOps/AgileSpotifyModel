import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { User } from '../models/index';

interface LoginResponse {
  accessToken: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _currentUser = signal<User | null>(null);
  private _accessToken = signal<string | null>(null);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser());
  readonly role = computed(() => this._currentUser()?.role ?? null);

  private readonly apiUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient, private router: Router) {}

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password }, { withCredentials: true })
    );
    this._accessToken.set(res.accessToken);
    this._currentUser.set(res.user);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.apiUrl}/logout`, {}, { withCredentials: true }));
    } finally {
      this._accessToken.set(null);
      this._currentUser.set(null);
      this.router.navigate(['/auth/login']);
    }
  }

  async refreshToken(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ accessToken: string }>(`${this.apiUrl}/refresh`, {}, { withCredentials: true })
      );
      this._accessToken.set(res.accessToken);
      return true;
    } catch {
      this._accessToken.set(null);
      this._currentUser.set(null);
      return false;
    }
  }

  async loadCurrentUser(): Promise<void> {
    try {
      const user = await firstValueFrom(
        this.http.get<User>(`${this.apiUrl}/me`, { withCredentials: true })
      );
      this._currentUser.set(user);
    } catch {
      // not authenticated
    }
  }

  getAccessToken(): string | null {
    return this._accessToken();
  }

  setAccessToken(token: string): void {
    this._accessToken.set(token);
  }
}
