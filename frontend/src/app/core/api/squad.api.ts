import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Squad, BacklogItem, Sprint } from '../models/index';

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

  // Backlog
  getBacklog(squadId: string): Observable<BacklogItem[]> { return this.api.get(`/squads/${squadId}/backlog`); }
  createBacklogItem(squadId: string, data: Partial<BacklogItem>): Observable<BacklogItem> { return this.api.post(`/squads/${squadId}/backlog`, data); }
  updateBacklogItem(squadId: string, itemId: string, data: Partial<BacklogItem>): Observable<BacklogItem> { return this.api.patch(`/squads/${squadId}/backlog/${itemId}`, data); }
  updateBacklogStatus(squadId: string, itemId: string, status: string): Observable<BacklogItem> { return this.api.patch(`/squads/${squadId}/backlog/${itemId}/status`, { status }); }
  deleteBacklogItem(squadId: string, itemId: string): Observable<void> { return this.api.delete(`/squads/${squadId}/backlog/${itemId}`); }
  reorderBacklog(squadId: string, items: { id: string; priority: number }[]): Observable<void> { return this.api.patch(`/squads/${squadId}/backlog/reorder`, { items }); }

  // Sprints
  getSprints(squadId: string): Observable<Sprint[]> { return this.api.get(`/squads/${squadId}/sprints`); }
  getActiveSprint(squadId: string): Observable<Sprint> { return this.api.get(`/squads/${squadId}/sprints/active`); }
  createSprint(squadId: string, data: Partial<Sprint>): Observable<Sprint> { return this.api.post(`/squads/${squadId}/sprints`, data); }
  updateSprint(squadId: string, sprintId: string, data: Partial<Sprint>): Observable<Sprint> { return this.api.patch(`/squads/${squadId}/sprints/${sprintId}`, data); }
  startSprint(squadId: string, sprintId: string): Observable<Sprint> { return this.api.post(`/squads/${squadId}/sprints/${sprintId}/start`, {}); }
  completeSprint(squadId: string, sprintId: string): Observable<Sprint> { return this.api.post(`/squads/${squadId}/sprints/${sprintId}/complete`, {}); }
  addSprintItem(squadId: string, sprintId: string, itemId: string): Observable<void> { return this.api.post(`/squads/${squadId}/sprints/${sprintId}/items/${itemId}`, {}); }
  removeSprintItem(squadId: string, sprintId: string, itemId: string): Observable<void> { return this.api.delete(`/squads/${squadId}/sprints/${sprintId}/items/${itemId}`); }

}
