import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { ShellComponent } from './shell.component';
import { AuthService } from '../core/auth/auth.service';
import { FeatureFlagsService } from '../core/feature-flags/feature-flags.service';

function makeAuth(role?: string) {
  const user = role ? { email: 'test@test.com', role } : null;
  return {
    currentUser: () => user,
    isAuthenticated: () => user !== null,
    logout: jasmine.createSpy('logout').and.returnValue(Promise.resolve()),
  };
}

const flagsStub = { isEnabled: (f: string) => f === 'appRegistry' };

describe('ShellComponent', () => {
  let fixture: ComponentFixture<ShellComponent>;
  let component: ShellComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService(),
        { provide: AuthService, useValue: makeAuth('Admin') },
        { provide: FeatureFlagsService, useValue: flagsStub },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ShellComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => expect(component).toBeTruthy());

  it('initials returns first char of email uppercased', () => {
    expect(component.initials).toBe('T');
  });

  it('canAccessAdmin is true for Admin', () => {
    expect(component.canAccessAdmin).toBeTrue();
  });

  it('logout() calls auth.logout()', () => {
    const authSpy = TestBed.inject(AuthService) as any;
    component.logout();
    expect(authSpy.logout).toHaveBeenCalled();
  });
});

describe('ShellComponent role visibility', () => {
  async function createWithRole(role: string) {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService(),
        { provide: AuthService, useValue: makeAuth(role) },
        { provide: FeatureFlagsService, useValue: flagsStub },
      ],
    }).compileComponents();
    return TestBed.createComponent(ShellComponent).componentInstance;
  }

  it('canAccessAdmin is true for TribeLead', async () => {
    const c = await createWithRole('TribeLead');
    expect(c.canAccessAdmin).toBeTrue();
  });

  it('canAccessAdmin is true for AgileCoach', async () => {
    const c = await createWithRole('AgileCoach');
    expect(c.canAccessAdmin).toBeTrue();
  });

  it('canAccessAdmin is false for Member', async () => {
    const c = await createWithRole('Member');
    expect(c.canAccessAdmin).toBeFalse();
  });

  it('initials falls back to U when no user', async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService(),
        { provide: AuthService, useValue: { currentUser: () => null, logout: jasmine.createSpy() } },
        { provide: FeatureFlagsService, useValue: flagsStub },
      ],
    }).compileComponents();
    const c = TestBed.createComponent(ShellComponent).componentInstance;
    expect(c.initials).toBe('U');
  });
});
