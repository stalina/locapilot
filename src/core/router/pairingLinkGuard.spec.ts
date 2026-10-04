import { describe, it, expect, vi } from 'vitest';
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router';
import { hasPairingFragment, pairingLinkGuard } from './pairingLinkGuard';
import {
  PAIRING_FRAGMENT_KEY,
  buildPairingUrl,
} from '@/features/settings/services/pairingLinkService';

// The app router lazy-loads these views; stub them so navigation stays cheap.
vi.mock('@features/dashboard/views/DashboardView.vue', () => ({
  default: { template: '<div>dashboard</div>' },
}));
vi.mock('@features/properties/views/PropertiesView.vue', () => ({
  default: { template: '<div>properties</div>' },
}));
vi.mock('@/features/settings/views/SettingsView.vue', () => ({
  default: { template: '<div>settings</div>' },
}));

const LINK_HASH = '#p2p=LP7K4MQ2XB&pin=482913';

function locationFor(name: string, hash: string): RouteLocationNormalized {
  return { name, hash } as RouteLocationNormalized;
}

function createTestRouter() {
  const Stub = { template: '<div />' };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: Stub },
      { path: '/properties', name: 'properties', component: Stub },
      { path: '/settings', name: 'settings', component: Stub },
    ],
  });
  router.beforeEach(pairingLinkGuard);
  return router;
}

describe('pairingLinkGuard', () => {
  describe('hasPairingFragment', () => {
    it.each([LINK_HASH, '#p2p=', 'p2p=LP7K4MQ2XB', '#pin=482913&p2p=LP7K4MQ2XB'])(
      'detects a pairing fragment (%j)',
      hash => {
        expect(hasPairingFragment(hash)).toBe(true);
      }
    );

    it.each(['', '#', '#section', '#pin=482913', '#p2pfoo=1', '#foo=p2p'])(
      'ignores other hashes (%j)',
      hash => {
        expect(hasPairingFragment(hash)).toBe(false);
      }
    );

    it('stays in sync with the links built by pairingLinkService', () => {
      const url = buildPairingUrl('LP7K4MQ2XB', '482913', 'https://stalina.github.io/locapilot/');
      const hash = new URL(url).hash;
      expect(hash.startsWith(`#${PAIRING_FRAGMENT_KEY}=`)).toBe(true);
      expect(hasPairingFragment(hash)).toBe(true);
    });
  });

  describe('guard function', () => {
    it('redirects a pairing link on another route to settings, keeping the hash', () => {
      expect(pairingLinkGuard(locationFor('dashboard', LINK_HASH))).toEqual({
        name: 'settings',
        hash: LINK_HASH,
        replace: true,
      });
    });

    it('lets a pairing link already on settings through', () => {
      expect(pairingLinkGuard(locationFor('settings', LINK_HASH))).toBe(true);
    });

    it('lets navigations without a pairing fragment through', () => {
      expect(pairingLinkGuard(locationFor('dashboard', ''))).toBe(true);
      expect(pairingLinkGuard(locationFor('properties', '#section'))).toBe(true);
    });
  });

  describe('with vue-router', () => {
    it.each(['/', '/properties'])(
      'sends a pairing link opened on %s to settings with the fragment kept',
      async path => {
        const router = createTestRouter();
        await router.push(`${path}${LINK_HASH}`);

        expect(router.currentRoute.value.name).toBe('settings');
        expect(router.currentRoute.value.hash).toBe(LINK_HASH);
        expect(router.currentRoute.value.fullPath).toBe(`/settings${LINK_HASH}`);
      }
    );

    it('does not redirect other hashes', async () => {
      const router = createTestRouter();
      await router.push('/properties#section');

      expect(router.currentRoute.value.name).toBe('properties');
      expect(router.currentRoute.value.hash).toBe('#section');
    });

    it('is registered on the application router', async () => {
      const { default: appRouter } = await import('./index');
      await appRouter.push(`/${LINK_HASH}`);

      expect(appRouter.currentRoute.value.name).toBe('settings');
      expect(appRouter.currentRoute.value.hash).toBe(LINK_HASH);

      await appRouter.push('/properties');
      expect(appRouter.currentRoute.value.name).toBe('properties');
    });
  });
});
