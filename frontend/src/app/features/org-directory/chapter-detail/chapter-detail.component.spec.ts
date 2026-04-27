import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ChapterDetailComponent } from './chapter-detail.component';
import { ApiService } from '../../../core/api/api.service';
import { MemberApi } from '../../../core/api/member.api';

describe('ChapterDetailComponent', () => {
  let apiSpy: jasmine.SpyObj<ApiService>;
  let memberSpy: jasmine.SpyObj<MemberApi>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    memberSpy = jasmine.createSpyObj('MemberApi', ['getAll']);

    apiSpy.get.and.returnValue(of({ id: 'c1', name: 'Chapter A' } as any));
    memberSpy.getAll.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ChapterDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'c1' } } } },
        { provide: ApiService, useValue: apiSpy },
        { provide: MemberApi, useValue: memberSpy },
      ],
    }).compileComponents();
  });

  it('should create', async () => {
    const fixture = TestBed.createComponent(ChapterDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });
});
