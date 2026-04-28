/**
 * Purpose: Typed HTTP client for the /members endpoints.
 * Usage:   Injected by member-list, member-form, squad-detail, dashboard, org-context.
 * Goal:    Single seam for member CRUD + assignments lookup.
 * ToDo:    —
 */
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Member } from '../models/index';

@Injectable({ providedIn: 'root' })
export class MemberApi {
  constructor(private api: ApiService) {}

  getAll(): Observable<Member[]> { return this.api.get('/members'); }
  getById(id: string): Observable<Member> { return this.api.get(`/members/${id}`); }
  create(data: Partial<Member> & { signet: string }): Observable<Member> { return this.api.post('/members', data); }
  update(id: string, data: Partial<Member>): Observable<Member> { return this.api.patch(`/members/${id}`, data); }
  delete(id: string): Observable<void> { return this.api.delete(`/members/${id}`); }
  getAssignments(id: string): Observable<{ squadId: string }> {
    return this.api.get(`/members/${id}/assignments`);
  }
}
