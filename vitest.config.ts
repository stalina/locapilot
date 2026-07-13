import { defineConfig, configDefaults } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // `.claude/worktrees/*` holds throwaway git worktrees (each with its own
    // node_modules); without excluding them vitest picks up their duplicated
    // specs and loads a second copy of Vue, breaking component rendering.
    exclude: [...configDefaults.exclude, 'e2e/**', '**/.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.spec.ts',
        '**/*.test.ts',
        'src/main.ts',
        'src/db/seed.ts',
        'e2e/**',
      ],
      // Minimum coverage floor enforced in CI (`npm run test:coverage`).
      // Set a few points below current levels so accidental regressions fail
      // the build while leaving headroom for minor run-to-run variation.
      // Raise these as coverage improves toward the 70% target (see CLAUDE.md).
      thresholds: {
        statements: 65,
        branches: 53,
        functions: 65,
        lines: 65,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
    },
  },
});
