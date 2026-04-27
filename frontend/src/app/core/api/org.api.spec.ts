import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OrgApi } from './org.api';
import { ApiService } from './api.service';

describe('OrgApi', () => {
  let api: OrgApi;
  let svc: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    svc = jasmine.createSpyObj('ApiService', ['get']);
    svc.get.and.returnValue(of(null as any));

    TestBed.configureTestingModule({ providers: [OrgApi, { provide: ApiService, useValue: svc }] });
    api = TestBed.inject(OrgApi);
  });

  it('getTree() calls GET /org/tree', () => {
    api.getTree().subscribe();
    expect(svc.get).toHaveBeenCalledWith('/org/tree');
  });

  it('getHeadcount() calls GET /org/headcount', () => {
    api.getHeadcount().subscribe();
    expect(svc.get).toHaveBeenCalledWith('/org/headcount');
  });
});
