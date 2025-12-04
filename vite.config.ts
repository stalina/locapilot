/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Determine base path: use /locapilot/ in production build or when explicitly testing PWA
const isPWABuild = process.env.ENABLE_PWA_IN_DEV === '1' || process.env.NODE_ENV === 'production';
const basePath = isPWABuild ? '/locapilot/' : '/';

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
    environment: 'happy-dom',
    setupFiles: ['./src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/tests/', '**/*.spec.ts', '**/*.test.ts'],
    },
  },
});
