import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { MemberFormComponent } from './member-form.component';
import { MemberApi } from '../../../core/api/member.api';
import { SquadApi } from '../../../core/api/squad.api';
import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import type { Member } from '../../../core/models/index';

describe('MemberFormComponent', () => {
  let memberSpy: jasmine.SpyObj<MemberApi>;
  let squadSpy: jasmine.SpyObj<SquadApi>;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const authStub = { currentUser: () => ({ email: 'a@b.com', role: 'Admin' }) };

  function setup(paramId?: string) {
    return TestBed.configureTestingModule({
      imports: [MemberFormComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => paramId ?? null } } },
        },
        { provide: MemberApi, useValue: memberSpy },
        { provide: SquadApi, useValue: squadSpy },
        { provide: ApiService, useValue: apiSpy },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();
  }

  beforeEach(() => {
    memberSpy = jasmine.createSpyObj('MemberApi', ['getAll', 'getById', 'create', 'update', 'delete']);
    squadSpy = jasmine.createSpyObj('SquadApi', ['getAll']);
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);

    memberSpy.create.and.returnValue(of({} as Member));
    memberSpy.update.and.returnValue(of({} as Member));
    memberSpy.getById.and.returnValue(of({ id: 'm1', name: 'Alice', email: 'a@test.com', role: 'Member', squadId: '' } as any));
    squadSpy.getAll.and.returnValue(of([]));
    apiSpy.get.and.returnValue(of([]));
  });

  it('creates in create mode', async () => {
    await setup();
    const fixture = TestBed.createComponent(MemberFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.componentInstance.isEdit).toBeFalse();
  });

  it('creates in edit mode', async () => {
    await setup('m1');
    const fixture = TestBed.createComponent(MemberFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const c = fixture.componentInstance;
    expect(c.isEdit).toBeTrue();
    expect(c.memberId).toBe('m1');
  });

  it('submit() does nothing when form is invalid', async () => {
    await setup();
    const fixture = TestBed.createComponent(MemberFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const c = fixture.componentInstance;
    c.form.reset();
    await c.submit();
    expect(memberSpy.create).not.toHaveBeenCalled();
  });

  it('submit() creates member and navigates', async () => {
    await setup();
    const fixture = TestBed.createComponent(MemberFormComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const c = fixture.componentInstance;
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    c.form.setValue({ name: 'Bob', email: 'bob@test.com', signet: 'pass1234', role: 'Member', squadId: '' });
    await c.submit();
    expect(memberSpy.create).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/members']);
  });

  it('isFullAdmin returns true for Admin', async () => {
    await setup();
    const fixture = TestBed.createComponent(MemberFormComponent);
    expect(fixture.componentInstance.isFullAdmin).toBeTrue();
  });
});
