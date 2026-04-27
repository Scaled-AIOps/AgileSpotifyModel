/**
 * Purpose: Typed HTTP client for the /domains endpoints.
 * Usage:   Injected by domain-detail and the dashboard.
 * Goal:    Single seam for the domain hierarchy from the frontend.
 * ToDo:    —
 */
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Domain, OrgTreeDomain } from '../models/index';

@Injectable({ providedIn: 'root' })
export class DomainApi {
  constructor(private api: ApiService) {}

  getAll(): Observable<Domain[]> { return this.api.get('/domains'); }
  getById(id: string): Observable<Domain> { return this.api.get(`/domains/${id}`); }
  getTree(id: string): Observable<OrgTreeDomain> { return this.api.get(`/domains/${id}/tree`); }
  create(data: Partial<Domain>): Observable<Domain> { return this.api.post('/domains', data); }
  update(id: string, data: Partial<Domain>): Observable<Domain> { return this.api.patch(`/domains/${id}`, data); }
  delete(id: string): Observable<void> { return this.api.delete(`/domains/${id}`); }
}
