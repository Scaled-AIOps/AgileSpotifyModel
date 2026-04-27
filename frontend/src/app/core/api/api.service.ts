/**
 * Purpose: Generic HTTP wrapper.
 * Usage:   Injected by every typed entity client (apps.api, squad.api, etc.) and exposes `get<T>(path)`, `post<T>`, `patch<T>`, `delete<T>` rooted at `environment.apiUrl`.
 * Goal:    Avoid every API client repeating the base URL + HttpClient boilerplate.
 * ToDo:    —
 */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    const httpParams = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.get<T>(`${this.base}${path}`, { params: httpParams, withCredentials: true });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body, { withCredentials: true });
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.base}${path}`, body, { withCredentials: true });
  }

  delete<T = void>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`, { withCredentials: true });
  }
}
