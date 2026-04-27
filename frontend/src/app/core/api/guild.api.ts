/**
 * Purpose: Typed HTTP client for the /guilds endpoints.
 * Usage:   Injected by guild-list and guild-detail.
 * Goal:    Single seam for guild data + self-join from the frontend.
 * ToDo:    —
 */
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Guild } from '../models/index';

@Injectable({ providedIn: 'root' })
export class GuildApi {
  constructor(private api: ApiService) {}

  getAll(): Observable<Guild[]> { return this.api.get('/guilds'); }
  getById(id: string): Observable<Guild> { return this.api.get(`/guilds/${id}`); }
  create(data: Partial<Guild>): Observable<Guild> { return this.api.post('/guilds', data); }
  update(id: string, data: Partial<Guild>): Observable<Guild> { return this.api.patch(`/guilds/${id}`, data); }
  delete(id: string): Observable<void> { return this.api.delete(`/guilds/${id}`); }
  getMembers(id: string): Observable<string[]> { return this.api.get(`/guilds/${id}/members`); }
  join(guildId: string, memberId: string): Observable<void> { return this.api.post(`/guilds/${guildId}/members/${memberId}`, {}); }
  leave(guildId: string, memberId: string): Observable<void> { return this.api.delete(`/guilds/${guildId}/members/${memberId}`); }
}
