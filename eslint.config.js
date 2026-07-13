import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

export default [
  // Ignorer les fichiers de build et dépendances
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.storybook/**',
      'storybook-static/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  // Configuration de base
  js.configs.recommended,

  // Configuration pour les fichiers TypeScript
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    plugins: {
      '@typescript-eslint': typescript,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Flag new explicit `any`. Kept at 'warn' (not 'error') because the
      // codebase still carries a large amount of legacy `any` (issue #63);
      // this guards against new occurrences without blocking CI on the backlog.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-debugger': 'off',
    },
  },

  // Configuration pour les fichiers Vue
  {
    files: ['**/*.vue'],
    plugins: {
      '@typescript-eslint': typescript,
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 'latest',
        parser: typescriptParser,
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      // See the TS block above: 'warn' guards new `any` without failing CI on
      // the existing legacy backlog (issue #63).
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off',
    },
  },
];

