import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from './auth.service';

describe('roleGuard', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  const orgTree = {} as any;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', [], {
      role: jasmine.createSpy('role').and.returnValue(null),
    });
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(orgTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('returns true when user role meets minimum (Admin >= TribeLead)', () => {
    (authSpy.role as jasmine.Spy).and.returnValue('Admin');
    const guard = roleGuard('TribeLead');
    const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBeTrue();
  });

  it('returns true when user has exact required role', () => {
    (authSpy.role as jasmine.Spy).and.returnValue('TribeLead');
    const guard = roleGuard('TribeLead');
    const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBeTrue();
  });

  it('returns UrlTree when role is insufficient (Member < TribeLead)', () => {
    (authSpy.role as jasmine.Spy).and.returnValue('Member');
    const guard = roleGuard('TribeLead');
    const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBe(orgTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/org']);
  });

  it('returns UrlTree when not authenticated (role is null)', () => {
    (authSpy.role as jasmine.Spy).and.returnValue(null);
    const guard = roleGuard('Member');
    const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBe(orgTree);
  });

  it('AgileCoach (rank 4) passes Admin (rank 4) requirement', () => {
    (authSpy.role as jasmine.Spy).and.returnValue('AgileCoach');
    const guard = roleGuard('Admin');
    const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBeTrue();
  });

  it('PO (rank 2) fails TribeLead (rank 3) requirement', () => {
    (authSpy.role as jasmine.Spy).and.returnValue('PO');
    const guard = roleGuard('TribeLead');
    const result = TestBed.runInInjectionContext(() => guard({} as any, {} as any));
    expect(result).toBe(orgTree);
  });
});
