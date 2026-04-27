/**
 * Purpose: Typed HTTP client for the /tribes endpoints.
 * Usage:   Injected by tribe-detail, dashboard, org-context.
 * Goal:    Single seam for tribe data.
 * ToDo:    —
 */
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Tribe } from '../models/index';

@Injectable({ providedIn: 'root' })
export class TribeApi {
  constructor(private api: ApiService) {}

  getAll(): Observable<Tribe[]> { return this.api.get('/tribes'); }
  getById(id: string): Observable<Tribe> { return this.api.get(`/tribes/${id}`); }
  create(data: Partial<Tribe>): Observable<Tribe> { return this.api.post('/tribes', data); }
  update(id: string, data: Partial<Tribe>): Observable<Tribe> { return this.api.patch(`/tribes/${id}`, data); }
  delete(id: string): Observable<void> { return this.api.delete(`/tribes/${id}`); }
  getSquads(id: string): Observable<string[]> { return this.api.get(`/tribes/${id}/squads`); }
  getChapters(id: string): Observable<string[]> { return this.api.get(`/tribes/${id}/chapters`); }
  assignLead(id: string, leadMemberId: string): Observable<Tribe> { return this.api.patch(`/tribes/${id}/lead`, { leadMemberId }); }
}
