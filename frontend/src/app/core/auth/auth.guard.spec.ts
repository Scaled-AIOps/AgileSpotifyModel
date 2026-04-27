import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const mockRoute = {} as any;
  const mockState = {} as any;
  const loginTree = {} as any;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['refreshToken', 'loadCurrentUser'], {
      isAuthenticated: jasmine.createSpy('isAuthenticated').and.returnValue(false),
    });
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);
    routerSpy.createUrlTree.and.returnValue(loginTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  it('returns true when already authenticated', async () => {
    (authSpy.isAuthenticated as jasmine.Spy).and.returnValue(true);
    const result = await TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    expect(result).toBeTrue();
    expect(authSpy.refreshToken).not.toHaveBeenCalled();
  });

  it('refreshes token and loads user when not authenticated', async () => {
    authSpy.refreshToken.and.resolveTo(true);
    authSpy.loadCurrentUser.and.resolveTo();
    const result = await TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    expect(authSpy.refreshToken).toHaveBeenCalledTimes(1);
    expect(authSpy.loadCurrentUser).toHaveBeenCalledTimes(1);
    expect(result).toBeTrue();
  });

  it('redirects to login when refresh fails', async () => {
    authSpy.refreshToken.and.resolveTo(false);
    const result = await TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
    expect(result).toBe(loginTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/auth/login']);
  });
});
