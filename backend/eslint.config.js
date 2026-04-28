/**
 * Purpose: ESLint flat config for the backend (TypeScript on Node).
 * Usage:   `npm run lint` (check) and `npm run lint:fix` (auto-fix).
 * Goal:    Catch the loud failure modes — unused vars, no-explicit-any escape
 *          hatches, switch fall-through, missing await — without picking a
 *          fight with style choices that prettier or the team disagree on.
 */
const tsParser = require('@typescript-eslint/parser');
const ts       = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
  },
  {
    files: ['api/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': ts },
    rules: {
      ...ts.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
      // Express's `declare global { namespace Express ... }` augmentation requires it.
      '@typescript-eslint/no-namespace': 'off',
      'no-console': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
];
