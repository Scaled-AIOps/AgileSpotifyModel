import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ConfigService } from './config.service';
import { environment } from '../../../environments/environment';

describe('ConfigService', () => {
  let service: ConfigService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ConfigService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConfigService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('defaults: basic enabled, jira/ad disabled', () => {
    expect(service.basicEnabled()).toBeTrue();
    expect(service.jiraEnabled()).toBeFalse();
    expect(service.adEnabled()).toBeFalse();
  });

  it('load() applies config from API', async () => {
    const promise = service.load();
    http.expectOne(`${environment.apiUrl}/auth/config`).flush({ basic: true, jira: true, ad: false });
    await promise;
    expect(service.basicEnabled()).toBeTrue();
    expect(service.jiraEnabled()).toBeTrue();
    expect(service.adEnabled()).toBeFalse();
  });

  it('load() keeps defaults when API fails', async () => {
    const promise = service.load();
    http.expectOne(`${environment.apiUrl}/auth/config`).flush({}, { status: 500, statusText: 'Error' });
    await promise;
    expect(service.basicEnabled()).toBeTrue();
    expect(service.jiraEnabled()).toBeFalse();
  });
});
