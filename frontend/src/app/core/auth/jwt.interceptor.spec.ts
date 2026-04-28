import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { jwtInterceptor } from './jwt.interceptor';
import { AuthService } from './auth.service';

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authSpy: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['getAccessToken', 'refreshToken', 'setAccessToken']);
    authSpy.getAccessToken.and.returnValue(null);
    authSpy.refreshToken.and.resolveTo(false);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: jasmine.createSpyObj('Router', ['navigate']) },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('passes request without auth header when no token', () => {
    http.get('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('adds Authorization header when token is present', () => {
    authSpy.getAccessToken.and.returnValue('my-token');
    http.get('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('Authorization')).toBe('Bearer my-token');
    req.flush({});
  });

  it('passes through non-401 errors without refreshing', (done) => {
    http.get('/api/data').subscribe({
      error: (err) => {
        expect(err.status).toBe(403);
        expect(authSpy.refreshToken).not.toHaveBeenCalled();
        done();
      },
    });
    httpMock.expectOne('/api/data').flush({}, { status: 403, statusText: 'Forbidden' });
  });

  it('does not refresh on 401 from /auth/ endpoints', (done) => {
    http.post('/api/auth/login', {}).subscribe({
      error: (err) => {
        expect(err.status).toBe(401);
        expect(authSpy.refreshToken).not.toHaveBeenCalled();
        done();
      },
    });
    httpMock.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });
  });

  it('attempts token refresh on 401 from non-auth endpoints', (done) => {
    authSpy.refreshToken.and.resolveTo(false);
    http.get('/api/data').subscribe({
      error: () => {
        expect(authSpy.refreshToken).toHaveBeenCalled();
        done();
      },
    });
    httpMock.expectOne('/api/data').flush({}, { status: 401, statusText: 'Unauthorized' });
  });

  it('calls refreshToken exactly once on 401 from non-auth endpoint', (done) => {
    authSpy.refreshToken.and.resolveTo(false);
    http.get('/api/data').subscribe({
      error: () => {
        expect(authSpy.refreshToken).toHaveBeenCalledTimes(1);
        done();
      },
    });
    httpMock.expectOne('/api/data').flush({}, { status: 401, statusText: 'Unauthorized' });
  });
});
