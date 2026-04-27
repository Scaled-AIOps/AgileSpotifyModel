import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { OrgTreeDomain } from '../models/index';

export interface HeadcountEntry {
  id: string;
  name: string;
  memberCount: number;
  squads: { id: string; name: string; memberCount: number }[];
}

@Injectable({ providedIn: 'root' })
export class OrgApi {
  constructor(private api: ApiService) {}

  getTree(): Observable<OrgTreeDomain[]> { return this.api.get('/org/tree'); }
  getHeadcount(): Observable<HeadcountEntry[]> { return this.api.get('/org/headcount'); }
}
