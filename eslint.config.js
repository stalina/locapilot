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
      // Explicit `any` is banned (CLAUDE.md): use `unknown` + narrowing,
      // generics or precise types. Spec files are relaxed to 'warn' below.
      '@typescript-eslint/no-explicit-any': 'error',
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
      // See the TS block above.
      '@typescript-eslint/no-explicit-any': 'error',
      'no-unused-vars': 'off',
    },
  },

  // Test files still carry legacy `any` in mocks/fixtures (issue #63): keep
  // flagging them without failing CI until that backlog is cleared too.
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];

