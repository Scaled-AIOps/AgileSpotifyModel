/**
 * Purpose: Compact <select> that lets the user switch the active UI language.
 * Usage:   `<app-language-switcher></app-language-switcher>` — used in the shell toolbar.
 * Goal:    A single, tiny entry point for translation control so language can be
 *          changed live without reload, with the choice persisted in localStorage.
 */
import { Component, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../app.config';

const LANG_STORAGE_KEY = 'app.lang';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [TranslateModule],
  template: `
    <label class="lang-wrap">
      <span class="visually-hidden">{{ 'language.label' | translate }}</span>
      <select class="lang-select" [value]="current" (change)="onChange($any($event.target).value)">
        @for (l of langs; track l) {
          <option [value]="l">{{ 'language.' + l | translate }}</option>
        }
      </select>
    </label>
  `,
  styles: [`
    .lang-wrap { display: inline-flex; align-items: center; }
    /* Default: white-on-transparent for the dark topbar.
       Light-background hosts (e.g. the login screen) override via ::ng-deep. */
    .lang-select {
      background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.35);
      border-radius: 6px; padding: 4px 24px 4px 8px; font-size: 0.78rem; cursor: pointer;
      appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, #fff 50%), linear-gradient(135deg, #fff 50%, transparent 50%);
      background-position: calc(100% - 12px) 50%, calc(100% - 7px) 50%;
      background-size: 5px 5px, 5px 5px;
      background-repeat: no-repeat;
    }
    .lang-select:hover  { border-color: rgba(255,255,255,0.65); }
    .lang-select:focus  { outline: none; border-color: rgba(255,255,255,0.85); box-shadow: 0 0 0 2px rgba(255,255,255,0.15); }
    .lang-select option { color: #111; background: #fff; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  `],
})
export class LanguageSwitcherComponent {
  private translate = inject(TranslateService);
  readonly langs = SUPPORTED_LANGUAGES;

  get current(): SupportedLanguage {
    return (this.translate.currentLang as SupportedLanguage) ?? this.langs[0];
  }

  onChange(value: string) {
    if (!(this.langs as readonly string[]).includes(value)) return;
    this.translate.use(value);
    try { localStorage.setItem(LANG_STORAGE_KEY, value); } catch { /* ignore */ }
  }
}
