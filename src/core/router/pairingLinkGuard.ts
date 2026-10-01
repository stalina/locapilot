import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router';

/**
 * Fragment key of a P2P pairing link (`#p2p=<sessionId>&pin=<pin>`, issue #118).
 *
 * Mirrors `PAIRING_FRAGMENT_KEY` in
 * `src/features/settings/services/pairingLinkService.ts`. It is kept as a local
 * literal on purpose: importing that service here would pull PeerJS and the QR
 * library into the main bundle. The guard spec checks both stay in sync.
 */
const PAIRING_FRAGMENT_KEY = 'p2p';

/** True when the location hash carries a pairing-link `p2p` key. */
export function hasPairingFragment(hash: string): boolean {
  if (!hash) return false;
  return new URLSearchParams(hash.replace(/^#/, '')).has(PAIRING_FRAGMENT_KEY);
}

/**
 * Global `beforeEach` guard: a pairing link opened on any route (typically the
 * application root, where the QR code points) is redirected to Settings while
 * keeping the fragment, so the Settings view can read and then strip it.
 */
export function pairingLinkGuard(to: RouteLocationNormalized): RouteLocationRaw | true {
  if (to.name !== 'settings' && hasPairingFragment(to.hash)) {
    return { name: 'settings', hash: to.hash, replace: true };
  }
  return true;
}
