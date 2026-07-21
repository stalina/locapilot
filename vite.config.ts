/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import type { PluginOption } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Note: P2P sync confidentiality no longer relies on a build-time secret. The
// AES-GCM key is derived per pairing from the PIN + a random handshake salt
// (see src/features/settings/services/peerSyncService.ts), so BUILD_SECRET_KEY
// is no longer injected into the bundle and there is no production fail-fast.

// Determine base path: use /locapilot/ in production build or when explicitly testing PWA
const isPWABuild = process.env.ENABLE_PWA_IN_DEV === '1' || process.env.NODE_ENV === 'production';
const basePath = isPWABuild ? '/locapilot/' : '/';

// Bundle visualizer, opt-in via `ANALYZE=1` (see the `analyze` npm script).
// It only emits `dist/stats.html` on demand and never affects normal builds.
const analyzePlugins: PluginOption[] =
  process.env.ANALYZE === '1' || process.env.ANALYZE === 'true'
    ? [
        visualizer({
          filename: 'dist/stats.html',
          template: 'treemap',
          gzipSize: true,
          brotliSize: true,
        }),
      ]
    : [];

export default defineConfig({
  // Inject package version at build time so runtime can access it via `import.meta.env.__APP_VERSION__`
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.1'),
  },
  base: basePath,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'robots.txt'],
      manifest: {
        name: 'Locapilot - Gestion Locative',
        short_name: 'Locapilot',
        description: 'Application de gestion locative offline-first',
        theme_color: '#4f46e5',
        background_color: '#ffffff',
        display: 'standalone',
        scope: basePath,
        start_url: basePath,
        lang: 'fr',
        icons: [
          {
            src: 'icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: process.env.ENABLE_PWA_IN_DEV === '1' || process.env.ENABLE_PWA_IN_DEV === 'true',
      },
    }),
    ...analyzePlugins,
  ],
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
      '@core': path.resolve(dirname, './src/core'),
      '@features': path.resolve(dirname, './src/features'),
      '@db': path.resolve(dirname, './src/db'),
      '@shared': path.resolve(dirname, './src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    // Exclude throwaway git worktrees under .claude/ so their duplicated specs
    // (and second copy of Vue) don't get loaded — see vitest.config.ts.
    exclude: [...configDefaults.exclude, 'e2e/**', '**/.claude/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/tests/', '**/*.spec.ts', '**/*.test.ts'],
    },
  },
});
