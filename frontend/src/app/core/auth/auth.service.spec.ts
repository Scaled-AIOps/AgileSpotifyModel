import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/auth`;

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('isAuthenticated is false initially', () => {
    expect(service.isAuthenticated()).toBeFalse();
  });

  it('role is null initially', () => {
    expect(service.role()).toBeNull();
  });

  it('getAccessToken returns null initially', () => {
    expect(service.getAccessToken()).toBeNull();
  });

  it('setAccessToken stores the token', () => {
    service.setAccessToken('my-token');
    expect(service.getAccessToken()).toBe('my-token');
  });

  describe('login', () => {
    it('sets currentUser and accessToken on success', async () => {
      const user = { id: 'u-1', email: 'admin@example.com', role: 'Admin' as const, memberId: 'm-1' };
      const loginPromise = service.login('admin@example.com', 'password');
      const req = http.expectOne(`${API}/login`);
      expect(req.request.method).toBe('POST');
      req.flush({ accessToken: 'tok', user });
      await loginPromise;
      expect(service.isAuthenticated()).toBeTrue();
      expect(service.currentUser()?.email).toBe('admin@example.com');
      expect(service.getAccessToken()).toBe('tok');
    });

    it('throws on HTTP error', async () => {
      const loginPromise = service.login('bad@example.com', 'wrong');
      const req = http.expectOne(`${API}/login`);
      req.flush({ error: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });
      await expectAsync(loginPromise).toBeRejected();
    });
  });

  describe('logout', () => {
    it('clears user and token then redirects', async () => {
      service.setAccessToken('tok');
      const logoutPromise = service.logout();
      const req = http.expectOne(`${API}/logout`);
      req.flush({});
      await logoutPromise;
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.getAccessToken()).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });

    it('clears user even if logout request fails', async () => {
      service.setAccessToken('tok');
      const logoutPromise = service.logout();
      const req = http.expectOne(`${API}/logout`);
      req.flush({ error: 'error' }, { status: 500, statusText: 'Error' });
      // finally block always runs — the error is re-thrown after clearing state
      await logoutPromise.catch(() => {});
      expect(service.getAccessToken()).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('refreshToken', () => {
    it('returns true and sets token on success', async () => {
      const refreshPromise = service.refreshToken();
      const req = http.expectOne(`${API}/refresh`);
      req.flush({ accessToken: 'new-tok' });
      const result = await refreshPromise;
      expect(result).toBeTrue();
      expect(service.getAccessToken()).toBe('new-tok');
    });

    it('returns false and clears token on failure', async () => {
      const refreshPromise = service.refreshToken();
      const req = http.expectOne(`${API}/refresh`);
      req.flush({ error: 'error' }, { status: 401, statusText: 'Unauthorized' });
      const result = await refreshPromise;
      expect(result).toBeFalse();
      expect(service.getAccessToken()).toBeNull();
    });
  });

  describe('loadCurrentUser', () => {
    it('sets currentUser on success', async () => {
      const user = { id: 'u-1', email: 'admin@example.com', role: 'Admin' as const, memberId: 'm-1' };
      const promise = service.loadCurrentUser();
      const req = http.expectOne(`${API}/me`);
      req.flush(user);
      await promise;
      expect(service.currentUser()?.email).toBe('admin@example.com');
      expect(service.role()).toBe('Admin');
    });

    it('does not throw on failure (not authenticated)', async () => {
      const promise = service.loadCurrentUser();
      const req = http.expectOne(`${API}/me`);
      req.flush({ error: 'error' }, { status: 401, statusText: 'Unauthorized' });
      await expectAsync(promise).toBeResolved();
      expect(service.currentUser()).toBeNull();
    });
  });
});
