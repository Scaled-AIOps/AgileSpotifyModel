import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MemberListComponent } from './member-list.component';
import { MemberApi } from '../../../core/api/member.api';
import { AuthService } from '../../../core/auth/auth.service';
import type { Member } from '../../../core/models/index';

const MEMBERS: Member[] = [
  { id: 'm1', name: 'Alice', email: 'alice@test.com', role: 'Admin' },
  { id: 'm2', name: 'Bob', email: 'bob@test.com', role: 'Member' },
] as Member[];

describe('MemberListComponent', () => {
  let memberSpy: jasmine.SpyObj<MemberApi>;
  let component: MemberListComponent;

  beforeEach(async () => {
    memberSpy = jasmine.createSpyObj('MemberApi', ['getAll', 'delete']);
    memberSpy.getAll.and.returnValue(of(MEMBERS));
    memberSpy.delete.and.returnValue(of(undefined));

    const authStub = {
      currentUser: () => ({ email: 'a@b.com', role: 'Admin' }),
    };

    await TestBed.configureTestingModule({
      imports: [MemberListComponent],
      providers: [
        provideTranslateService(),
        provideRouter([]),
        { provide: MemberApi, useValue: memberSpy },
        { provide: AuthService, useValue: authStub },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(MemberListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => expect(component).toBeTruthy());

  it('loads members on init', () => {
    expect(component.members.length).toBe(2);
    expect(component.filtered.length).toBe(2);
    expect(component.loading).toBeFalse();
  });

  it('applyFilter filters by name', () => {
    component.searchQuery = 'alice';
    component.applyFilter();
    expect(component.filtered.length).toBe(1);
    expect(component.filtered[0].name).toBe('Alice');
  });

  it('applyFilter filters by email', () => {
    component.searchQuery = 'bob@';
    component.applyFilter();
    expect(component.filtered.length).toBe(1);
  });

  it('isFullAdmin returns true for Admin', () => {
    expect(component.isFullAdmin).toBeTrue();
  });

  it('roleClass returns correct badge class', () => {
    expect(component.roleClass('Admin')).toBe('badge-danger');
    expect(component.roleClass('Member')).toBe('badge-muted');
    expect(component.roleClass('Unknown')).toBe('badge-muted');
  });
});
