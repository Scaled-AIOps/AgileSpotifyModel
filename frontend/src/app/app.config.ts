/**
 * Purpose: Angular ApplicationConfig.
 * Usage:   Passed to `bootstrapApplication`. Provides zone change detection, the router, the JWT-aware HttpClient, animations, and an APP_INITIALIZER that warms ConfigService.
 * Goal:    Single place that wires SPA-wide providers — no NgModule.
 * ToDo:    Migrate APP_INITIALIZER to provideAppInitializer() (deprecated in Angular 21).
 */
import { ApplicationConfig, APP_INITIALIZER, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/auth/jwt.interceptor';
import { ConfigService } from './core/config/config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideAnimations(),
    {
      provide: APP_INITIALIZER,
      useFactory: (config: ConfigService) => () => config.load(),
      deps: [ConfigService],
      multi: true,
    },
  ],
};
