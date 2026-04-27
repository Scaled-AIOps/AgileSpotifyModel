import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

const BASE = environment.apiUrl;

describe('ApiService', () => {
  let service: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('get() sends GET request with correct URL', () => {
    service.get('/test').subscribe();
    const req = http.expectOne(`${BASE}/test`);
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('get() appends query params', () => {
    service.get('/test', { foo: 'bar' }).subscribe();
    const req = http.expectOne(`${BASE}/test?foo=bar`);
    expect(req.request.params.get('foo')).toBe('bar');
    req.flush({});
  });

  it('post() sends POST request', () => {
    service.post('/items', { name: 'x' }).subscribe();
    const req = http.expectOne(`${BASE}/items`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'x' });
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('patch() sends PATCH request', () => {
    service.patch('/items/1', { name: 'y' }).subscribe();
    const req = http.expectOne(`${BASE}/items/1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'y' });
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });

  it('delete() sends DELETE request', () => {
    service.delete('/items/1').subscribe();
    const req = http.expectOne(`${BASE}/items/1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.withCredentials).toBeTrue();
    req.flush(null);
  });
});
