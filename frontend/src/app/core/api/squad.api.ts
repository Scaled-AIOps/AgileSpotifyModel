import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Squad } from '../models/index';

@Injectable({ providedIn: 'root' })
export class SquadApi {
  constructor(private api: ApiService) {}

  getAll(): Observable<Squad[]> { return this.api.get('/squads'); }
  getById(id: string): Observable<Squad> { return this.api.get(`/squads/${id}`); }
  create(data: Partial<Squad>): Observable<Squad> { return this.api.post('/squads', data); }
  update(id: string, data: Partial<Squad>): Observable<Squad> { return this.api.patch(`/squads/${id}`, data); }
  delete(id: string): Observable<void> { return this.api.delete(`/squads/${id}`); }
  getMembers(id: string): Observable<string[]> { return this.api.get(`/squads/${id}/members`); }
  addMember(squadId: string, memberId: string, squadRole?: string): Observable<void> { return this.api.post(`/squads/${squadId}/members/${memberId}`, squadRole ? { squadRole } : {}); }
  updateMemberRole(squadId: string, memberId: string, squadRole: string): Observable<void> { return this.api.patch(`/squads/${squadId}/members/${memberId}/role`, { squadRole }); }
  removeMember(squadId: string, memberId: string): Observable<void> { return this.api.delete(`/squads/${squadId}/members/${memberId}`); }
  assignLead(id: string, leadMemberId: string): Observable<Squad> { return this.api.patch(`/squads/${id}/lead`, { leadMemberId }); }
}
