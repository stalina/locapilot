import { toDataURL } from 'qrcode';
import {
  normalizeSessionId,
  SESSION_ID_ALPHABET,
  SESSION_ID_LENGTH,
  SESSION_ID_PREFIX,
} from './peerSyncService';

/**
 * P2P pairing link helpers (issue #118).
 *
 * A pairing link carries the host session id and PIN in the URL **fragment**
 * only: `<origin><BASE_URL>#p2p=<sessionId>&pin=<pin>`. Browsers never send the
 * fragment to the web server, the CDN or the PeerJS broker, so the credentials
 * never leave the two devices. The link targets the application root (always
 * served directly by GitHub Pages — `404.html` drops fragments) and the router
 * sends the user to Settings (see `src/core/router/pairingLinkGuard.ts`).
 *
 * The QR code is generated locally by the bundled `qrcode` library: no remote
 * QR-code API is ever called (offline-first, no credential leak).
 */

/** Fragment key carrying the host session id. */
export const PAIRING_FRAGMENT_KEY = 'p2p';
/** Fragment key carrying the 6-digit PIN. */
export const PAIRING_PIN_KEY = 'pin';

const PIN_PATTERN = /^\d{6}$/;

export type PairingFragment =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'ok'; sessionId: string; pin: string | null };

/**
 * True only for a well-formed Locapilot session id: `SESSION_ID_PREFIX`
 * followed by exactly `SESSION_ID_LENGTH` characters of `SESSION_ID_ALPHABET`
 * (the format produced by `generateSessionId()`). Expects an already
 * normalised id (see `normalizeSessionId`).
 */
export function isValidSessionId(id: string): boolean {
  if (!id.startsWith(SESSION_ID_PREFIX)) return false;
  const body = id.slice(SESSION_ID_PREFIX.length);
  if (body.length !== SESSION_ID_LENGTH) return false;
  for (const char of body) {
    if (!SESSION_ID_ALPHABET.includes(char)) return false;
  }
  return true;
}

/**
 * Build the pairing link encoded in the host QR code. The credentials live in
 * the fragment only — the link never has a query string.
 *
 * @param appRootUrl absolute URL of the application root, i.e.
 *   `new URL(import.meta.env.BASE_URL, window.location.origin).href`
 *   (`https://stalina.github.io/locapilot/` in production).
 */
export function buildPairingUrl(sessionId: string, pin: string, appRootUrl: string): string {
  return `${appRootUrl}#${PAIRING_FRAGMENT_KEY}=${sessionId}&${PAIRING_PIN_KEY}=${pin}`;
}

/**
 * Parse a location hash (`#p2p=…&pin=…`, leading `#` optional).
 *
 * - `none`: the hash carries no `p2p` key (normal navigation).
 * - `invalid`: a `p2p` key is present but is not a valid session id once
 *   normalised (uppercase, spaces/dashes stripped).
 * - `ok`: a valid session id; `pin` is the PIN only when it is exactly 6
 *   digits, `null` otherwise.
 */
export function parsePairingFragment(hash: string): PairingFragment {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const rawSessionId = params.get(PAIRING_FRAGMENT_KEY);
  if (rawSessionId === null) return { status: 'none' };

  const sessionId = normalizeSessionId(rawSessionId);
  if (!isValidSessionId(sessionId)) return { status: 'invalid' };

  const rawPin = params.get(PAIRING_PIN_KEY);
  const pin = rawPin !== null && PIN_PATTERN.test(rawPin) ? rawPin : null;
  return { status: 'ok', sessionId, pin };
}

/**
 * Render `url` as a PNG data URL, locally, with the bundled QR library.
 * Thin wrapper so components and tests can mock QR generation.
 */
export function generatePairingQrDataUrl(url: string): Promise<string> {
  return toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 220 });
}
