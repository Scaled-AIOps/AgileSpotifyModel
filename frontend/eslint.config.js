/**
 * Purpose: ESLint flat config for the Angular frontend.
 * Usage:   `npm run lint` and `npm run lint:fix`. Lints both TS source and the
 *          inline-template Angular components.
 * Goal:    Catch unused vars / type sins and the most obvious Angular pitfalls
 *          without imposing the full angular-eslint preset (which produces a
 *          noisy first run on this codebase).
 */
const tsParser           = require('@typescript-eslint/parser');
const ts                 = require('@typescript-eslint/eslint-plugin');
const angular            = require('@angular-eslint/eslint-plugin');
const angularTemplate    = require('@angular-eslint/eslint-plugin-template');
const angularTplParser   = require('@angular-eslint/template-parser');

module.exports = [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.angular/**'],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': ts, '@angular-eslint': angular },
    rules: {
      ...ts.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
      '@angular-eslint/component-class-suffix': 'warn',
      '@angular-eslint/directive-class-suffix': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['src/**/*.html'],
    languageOptions: { parser: angularTplParser },
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: {
      ...angularTemplate.configs.recommended.rules,
    },
  },
];
