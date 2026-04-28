import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/auth/auth.service';
import { ConfigService } from '../../../core/config/config.service';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let configSpy: jasmine.SpyObj<ConfigService>;

  beforeEach(async () => {
    authSpy   = jasmine.createSpyObj('AuthService', ['login']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    configSpy = jasmine.createSpyObj('ConfigService', ['load'], {
      basicEnabled: () => true,
      jiraEnabled:  () => false,
      adEnabled:    () => false,
    });

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ConfigService, useValue: configSpy },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('form is invalid when empty', () => {
    expect(component.form.invalid).toBeTrue();
  });

  it('form is valid with email and passcode', () => {
    component.form.setValue({ email: 'admin@example.com', passcode: 'pass123' });
    expect(component.form.valid).toBeTrue();
  });

  it('form is invalid with bad email', () => {
    component.form.setValue({ email: 'not-an-email', passcode: 'pass123' });
    expect(component.form.invalid).toBeTrue();
  });

  it('sets errorMsg from query param on init', () => {
    component['route'] = { snapshot: { queryParamMap: { get: (k: string) => k === 'error' ? 'no-account' : null } } } as any;
    component.ngOnInit();
    expect(component.errorMsg).toBe('no-account');
  });

  describe('submit()', () => {
    it('does nothing when form is invalid', async () => {
      await component.submit();
      expect(authSpy.login).not.toHaveBeenCalled();
    });

    it('calls auth.login and navigates on success', async () => {
      authSpy.login.and.resolveTo();
      component.form.setValue({ email: 'admin@example.com', passcode: 'pass123' });
      await component.submit();
      expect(authSpy.login).toHaveBeenCalledWith('admin@example.com', 'pass123');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/apps']);
      expect(component.loading).toBeFalse();
    });

    it('sets errorMsg on login failure', async () => {
      authSpy.login.and.rejectWith({ error: { error: 'Invalid credentials' } });
      component.form.setValue({ email: 'bad@example.com', passcode: 'wrong' });
      await component.submit();
      expect(component.errorMsg).toBe('Invalid credentials');
      expect(component.loading).toBeFalse();
    });

    it('uses fallback error message when error has no message', async () => {
      authSpy.login.and.rejectWith({});
      component.form.setValue({ email: 'bad@example.com', passcode: 'wrong' });
      await component.submit();
      expect(component.errorMsg).toBe('Login failed');
    });
  });
});
