/**
 * Purpose: Angular ApplicationConfig.
 * Usage:   Passed to `bootstrapApplication`. Provides zone change detection, the router, the JWT-aware HttpClient, animations, ngx-translate, and an APP_INITIALIZER that warms ConfigService.
 * Goal:    Single place that wires SPA-wide providers — no NgModule.
 * ToDo:    Migrate APP_INITIALIZER to provideAppInitializer() (deprecated in Angular 21).
 */
import { ApplicationConfig, APP_INITIALIZER, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/auth/jwt.interceptor';
import { ConfigService } from './core/config/config.service';

export const SUPPORTED_LANGUAGES = ['en', 'de'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';
const LANG_STORAGE_KEY = 'app.lang';

/** Picks the user's preferred language: localStorage > navigator > default. */
function pickInitialLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY) as SupportedLanguage | null;
    if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) return saved;
  } catch { /* SSR / disabled storage */ }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : '').slice(0, 2);
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(nav) ? (nav as SupportedLanguage) : DEFAULT_LANGUAGE;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideAnimations(),
    provideTranslateService({
      lang: DEFAULT_LANGUAGE,
      fallbackLang: DEFAULT_LANGUAGE,
    }),
    provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
    {
      provide: APP_INITIALIZER,
      useFactory: (config: ConfigService) => () => config.load(),
      deps: [ConfigService],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (translate: TranslateService) => () => {
        const lang = pickInitialLanguage();
        translate.addLangs(SUPPORTED_LANGUAGES as unknown as string[]);
        return translate.use(lang).toPromise();
      },
      deps: [TranslateService],
      multi: true,
    },
  ],
};
