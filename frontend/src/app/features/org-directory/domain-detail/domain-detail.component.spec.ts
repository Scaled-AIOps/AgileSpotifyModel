import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { DomainDetailComponent } from './domain-detail.component';
import { DomainApi } from '../../../core/api/domain.api';

describe('DomainDetailComponent', () => {
  let domainSpy: jasmine.SpyObj<DomainApi>;

  beforeEach(async () => {
    domainSpy = jasmine.createSpyObj('DomainApi', ['getById', 'getTree', 'update', 'delete']);
    domainSpy.getTree.and.returnValue(of({ id: 'd1', name: 'Dom', tribes: [], subdomains: [] } as any));

    await TestBed.configureTestingModule({
      imports: [DomainDetailComponent],
      providers: [
        provideTranslateService(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'd1' } } } },
        { provide: DomainApi, useValue: domainSpy },
      ],
    }).compileComponents();
  });

  it('should create', async () => {
    const fixture = TestBed.createComponent(DomainDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
