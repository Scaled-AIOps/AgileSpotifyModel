import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TribeDetailComponent } from './tribe-detail.component';
import { TribeApi } from '../../../core/api/tribe.api';
import { ApiService } from '../../../core/api/api.service';

describe('TribeDetailComponent', () => {
  let tribeSpy: jasmine.SpyObj<TribeApi>;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    tribeSpy = jasmine.createSpyObj('TribeApi', ['getById', 'getSquads', 'update', 'assignLead']);
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);

    tribeSpy.getById.and.returnValue(of({ id: 't1', name: 'Tribe A' } as any));
    tribeSpy.getSquads.and.returnValue(of([]));
    apiSpy.get.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [TribeDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 't1' } } } },
        { provide: TribeApi, useValue: tribeSpy },
        { provide: ApiService, useValue: apiSpy },
      ],
    }).compileComponents();
  });

  it('should create', async () => {
    const fixture = TestBed.createComponent(TribeDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
