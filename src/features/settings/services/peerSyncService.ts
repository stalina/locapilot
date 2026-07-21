import Peer, { type DataConnection } from 'peerjs';

// ---------------------------------------------------------------------------
// P2P security model (see docs/specs/data-transfer.md — "P2P security model")
//
// Confidentiality is NOT provided by any build-time secret. Each pairing derives
// a fresh, unique AES-GCM key bound to the shared PIN and to a random salt
// exchanged during the handshake (PBKDF2-SHA-256). Two pairings — even with the
// same PIN — produce different keys because the salt is random per connection,
// and the key cannot be derived from anything shipped in the public bundle.
// ---------------------------------------------------------------------------

/** PBKDF2 iterations for the session-key derivation. High enough to slow down
 *  offline PIN brute-forcing of a captured ciphertext. */
export const PBKDF2_ITERATIONS = 210_000;
/** Length (bytes) of the random salt exchanged at handshake. */
export const SALT_BYTES = 16;
/** Wrong-PIN attempts the host tolerates before it locks out (3–5). */
export const MAX_PIN_ATTEMPTS = 3;
/** Base delay (ms) for the exponential back-off applied after a lockout. */
export const LOCKOUT_BASE_MS = 30_000;

/**
 * Short, non-secret prefix on the session ID. Keeps Locapilot sessions in their
 * own slice of the shared public PeerJS broker ID space (fewer cross-app
 * collisions) and marks the code as a Locapilot pairing code.
 */
export const SESSION_ID_PREFIX = 'LP';
/** Number of random characters in the session ID (30^8 ≈ 39 bits of entropy). */
export const SESSION_ID_LENGTH = 8;
/**
 * Unambiguous-when-spoken alphabet (Crockford-style, 30 chars): no 0/O, 1/I/L,
 * and no U. Uppercase only. 30 is not a power of two, so the byte→index mapping
 * uses rejection sampling to stay uniform (no modulo bias).
 */
export const SESSION_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Typed protocol exchanged over the PeerJS data connection.
 *
 * A discriminated union on `type`: narrowing on `msg.type` makes the extra
 * fields (`salt`, `pin`, `iv`, `payload`) type-safe only inside the matching
 * branch. Messages whose `type` is not part of this union are ignored.
 *
 * Handshake order: host → `handshake` (random salt); client derives the session
 * key then → `auth` (PIN); host verifies the PIN, derives the same key, and
 * replies `auth_ok` / `auth_failed`; the encrypted `export` follows.
 */
export type SyncMessage =
  | { type: 'handshake'; salt: string }
  | { type: 'auth'; pin: string }
  | { type: 'auth_ok' }
  | { type: 'auth_failed' }
  | { type: 'export'; iv: string; payload: string };

/** Shape handed to `onData` once an encrypted `export` message is decrypted. */
export type DecryptedExportMessage = { type: 'export'; payload: string };

/** Narrows an incoming, untyped connection message to an indexable record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Crypto helpers
const textToUint8 = (s: string) => new TextEncoder().encode(s);
const uint8ToBase64 = (b: Uint8Array) => {
  // Convert in chunks to avoid call stack size exceeded for large arrays
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < b.length; i += chunkSize) {
    // spread a typed number[] slice to avoid the call-stack limit on large arrays
    const chunk: number[] = Array.from(b.subarray(i, i + chunkSize));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};
// Decode to a Uint8Array backed by a concrete ArrayBuffer (not ArrayBufferLike),
// so the result satisfies WebCrypto's `BufferSource` in strict build mode.
const base64ToUint8 = (s: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(s);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

/**
 * Derive the per-pairing AES-GCM session key from the shared PIN and the random
 * salt exchanged at handshake. Both peers call this with the same PIN + salt and
 * therefore obtain an identical key; a different salt (or PIN) yields a
 * different key. The result never depends on any build-time secret.
 */
export async function deriveSessionKey(
  pin: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  if (!pin) throw new Error('deriveSessionKey: PIN is required');
  if (!salt || salt.length === 0) throw new Error('deriveSessionKey: salt is required');

  const baseKey = await crypto.subtle.importKey('raw', textToUint8(pin), 'PBKDF2', false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Cryptographically random 16-byte salt for a new pairing. */
export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/**
 * Cryptographically random, short session identifier that can be dictated aloud
 * (e.g. `LP7K4MQ2XB`): a fixed prefix + `SESSION_ID_LENGTH` characters drawn from
 * an unambiguous alphabet via `crypto.getRandomValues`. Contains no timestamp,
 * no `Math.random()` output and no other guessable/enumerable component; the
 * bytes are debiased with rejection sampling so the alphabet is uniform.
 *
 * ~39 bits of entropy — enough to make enumeration on the shared PeerJS broker
 * impractical within the pairing window. Real confidentiality/authentication
 * still comes from the PIN (PBKDF2 session key) and the host brute-force lockout,
 * never from the secrecy of this id.
 */
export function generateSessionId(): string {
  const alphabet = SESSION_ID_ALPHABET;
  const n = alphabet.length;
  const limit = Math.floor(256 / n) * n; // largest byte multiple of n → unbiased
  const buf = new Uint8Array(1);
  let out = '';
  while (out.length < SESSION_ID_LENGTH) {
    crypto.getRandomValues(buf);
    const b = buf[0] ?? 0;
    if (b >= limit) continue; // reject the biased tail
    out += alphabet[b % n];
  }
  return `${SESSION_ID_PREFIX}${out}`;
}

/**
 * Normalise a session id typed by a human: uppercase and strip whitespace and
 * separators so re-keying tolerance (spaces, dashes, lower-case) does not break
 * the exact-match PeerJS lookup. The generated id contains no separators, so
 * this is a no-op on a correctly copied id.
 */
export function normalizeSessionId(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

/**
 * Cryptographically random 6-digit PIN, uniform over 000000–999999 with no
 * modulo bias (rejection sampling) and generated via `crypto.getRandomValues`.
 */
export function generatePin(): string {
  const range = 1_000_000; // 000000..999999
  const limit = Math.floor(0xff_ff_ff_ff / range) * range; // largest unbiased bound
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return String(value % range).padStart(6, '0');
}

async function encryptPayload(key: CryptoKey, plain: string) {
  // random IV 12 bytes
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = textToUint8(plain);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  const cipherU8 = new Uint8Array(cipher);
  return { iv: uint8ToBase64(iv), payload: uint8ToBase64(cipherU8) };
}

async function decryptPayload(key: CryptoKey, ivB64: string, payloadB64: string) {
  const iv = base64ToUint8(ivB64);
  const cipher = base64ToUint8(payloadB64);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return new TextDecoder().decode(plainBuf);
}

export type PeerStatus =
  | 'idle'
  | 'creating'
  | 'hosting'
  | 'client-connected'
  | 'connection-open'
  | 'auth-pending'
  | 'auth-ok'
  | 'auth-failed'
  | 'locked-out'
  | 'connected'
  | 'importing'
  | 'warning'
  | 'error'
  | 'stopped';

export type OnDataCb = (data: SyncMessage | DecryptedExportMessage) => Promise<void> | void;
export type OnStatusCb = (status: PeerStatus, info?: unknown) => void;

export class PeerSyncService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private onData?: OnDataCb;
  private onStatus?: OnStatusCb;
  private pairingPin: string = '';
  /** Random salt for the current pairing and the derived AES-GCM session key. */
  private salt: Uint8Array<ArrayBuffer> | null = null;
  private sessionKey: CryptoKey | null = null;
  /** Host-side wrong-PIN counter for brute-force protection. */
  private failedPinAttempts = 0;

  // Cross-session lockout state: `static` so it survives service
  // re-instantiation and a host cannot immediately re-host after being
  // brute-forced. `lockoutUntil` is the wall-clock time before which hosting is
  // refused; `lockoutCount` drives the exponential back-off.
  private static lockoutUntil = 0;
  private static lockoutCount = 0;

  constructor(onData?: OnDataCb, onStatus?: OnStatusCb) {
    this.onData = onData;
    this.onStatus = onStatus;
  }

  /** Test/utility hook: clear the module-level lockout back-off. */
  static resetLockout(): void {
    PeerSyncService.lockoutUntil = 0;
    PeerSyncService.lockoutCount = 0;
  }

  /** Remaining lockout time in ms (0 when hosting is allowed). */
  static lockoutRemainingMs(now: number = Date.now()): number {
    return Math.max(0, PeerSyncService.lockoutUntil - now);
  }

  private notify(status: PeerStatus, info?: unknown) {
    try {
      this.onStatus?.(status, info);
    } catch (e) {
      console.error('onStatus callback failed', e);
    }
  }

  private get debugLevel(): number {
    return import.meta.env.DEV ? 2 : 0;
  }

  private engageLockout() {
    const backoff = LOCKOUT_BASE_MS * 2 ** PeerSyncService.lockoutCount;
    PeerSyncService.lockoutCount += 1;
    PeerSyncService.lockoutUntil = Date.now() + backoff;
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        console.warn('peer.destroy failed', e);
      }
      this.peer = null;
    }
    this.conn = null;
    this.notify('locked-out', { attempts: this.failedPinAttempts, retryAfterMs: backoff });
  }

  async startHosting(id: string, pin: string) {
    if (this.peer) return;

    const remaining = PeerSyncService.lockoutRemainingMs();
    if (remaining > 0) {
      this.notify('locked-out', { retryAfterMs: remaining });
      return;
    }

    this.pairingPin = pin;
    this.failedPinAttempts = 0;
    this.notify('creating');
    this.peer = new Peer(id, { debug: this.debugLevel });

    this.peer.on('open', (peerId: string) => {
      this.notify('hosting', peerId);
    });

    this.peer.on('connection', (c: DataConnection) => {
      // Reject concurrent connections
      if (this.conn) {
        c.close();
        return;
      }
      this.conn = c;
      this.notify('client-connected');

      c.on('open', () => {
        this.notify('connection-open');
        // Start the handshake: send a fresh random salt for this pairing.
        this.salt = generateSalt();
        c.send({ type: 'handshake', salt: uint8ToBase64(this.salt) } satisfies SyncMessage);
        this.notify('auth-pending');
      });

      c.on('data', (msg: unknown) => {
        void this.handleHostData(c, msg);
      });

      c.on('close', () => {
        this.notify('stopped');
        this.conn = null;
      });

      c.on('error', (err: Error) => {
        this.notify('error', err);
      });
    });

    this.peer.on('error', (err: Error) => {
      this.notify('error', err);
    });
  }

  private async handleHostData(conn: DataConnection, msg: unknown) {
    if (!isRecord(msg) || msg.type !== 'auth') return;

    if (msg.pin === this.pairingPin && this.salt) {
      // Correct PIN → derive the shared session key and confirm.
      this.sessionKey = await deriveSessionKey(this.pairingPin, this.salt);
      conn.send({ type: 'auth_ok' } satisfies SyncMessage);
      this.notify('auth-ok');
      return;
    }

    // Wrong PIN → count the failure, reject, and lock out past the threshold.
    this.failedPinAttempts += 1;
    conn.send({ type: 'auth_failed' } satisfies SyncMessage);
    this.notify('auth-failed', { attempts: this.failedPinAttempts });
    try {
      conn.close();
    } catch {
      // ignore
    }
    this.conn = null;

    if (this.failedPinAttempts >= MAX_PIN_ATTEMPTS) {
      this.engageLockout();
    }
  }

  stopHosting() {
    if (this.conn) {
      try {
        this.conn.close();
      } catch (e) {
        console.warn('conn.close failed', e);
      }
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        console.warn('peer.destroy failed', e);
      }
      this.peer = null;
    }
    this.resetPairingState();
    this.notify('stopped');
  }

  async connect(hostId: string, pin: string) {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        console.warn('peer.destroy failed', e);
      }
      this.peer = null;
    }
    this.pairingPin = pin;

    // Ephemeral, non-guessable client peer id (never reused across pairings).
    const ephemeralId = `peer-${crypto.randomUUID()}`;
    this.peer = new Peer(ephemeralId, { debug: this.debugLevel });

    this.peer.on('open', (id: string) => {
      this.notify('connected', id);
      const conn = this.peer!.connect(hostId);
      this.conn = conn;

      conn.on('open', () => {
        this.notify('connection-open');
        this.notify('auth-pending');
        // Wait for the host handshake (salt) before sending the PIN.
      });

      conn.on('data', (data: unknown) => {
        void this.handleClientData(conn, data);
      });

      conn.on('error', (err: Error) => {
        this.notify('error', err);
      });
    });

    this.peer.on('error', (err: Error) => {
      this.notify('error', err);
    });
  }

  private async handleClientData(conn: DataConnection, data: unknown) {
    if (!isRecord(data) || typeof data.type !== 'string') return;

    try {
      if (data.type === 'handshake' && typeof data.salt === 'string') {
        // Derive the session key from PIN + host salt, then authenticate.
        this.salt = base64ToUint8(data.salt);
        this.sessionKey = await deriveSessionKey(this.pairingPin, this.salt);
        conn.send({ type: 'auth', pin: this.pairingPin } satisfies SyncMessage);
      } else if (data.type === 'auth_ok') {
        this.notify('auth-ok');
      } else if (data.type === 'auth_failed') {
        this.notify('auth-failed');
        this.disconnect();
      } else if (
        data.type === 'export' &&
        typeof data.iv === 'string' &&
        typeof data.payload === 'string'
      ) {
        if (!this.sessionKey) throw new Error('No session key established');
        const decrypted = await decryptPayload(this.sessionKey, data.iv, data.payload);
        await this.onData?.({ type: 'export', payload: decrypted });
      }
    } catch (e) {
      console.error('Failed to process incoming P2P data', e);
      this.notify('error', e);
    }
  }

  disconnect() {
    if (this.conn) {
      try {
        this.conn.close();
      } catch (e) {
        console.warn('conn.close failed', e);
      }
      this.conn = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        console.warn('peer.destroy failed', e);
      }
      this.peer = null;
    }
    this.resetPairingState();
    this.notify('stopped');
  }

  private resetPairingState() {
    this.pairingPin = '';
    this.salt = null;
    this.sessionKey = null;
    this.failedPinAttempts = 0;
  }

  sendExport(json: string) {
    const conn = this.conn;
    if (!conn || conn.open === false) {
      throw new Error('No open connection to send data');
    }
    const key = this.sessionKey;
    if (!key) {
      throw new Error('No session key established');
    }
    try {
      // encrypt payload before sending
      (async () => {
        try {
          const { iv, payload } = await encryptPayload(key, json);
          conn.send({ type: 'export', iv, payload } satisfies SyncMessage);
        } catch (e) {
          console.error('Encryption failed', e);
          this.notify('error', e);
        }
      })();
    } catch (e) {
      console.error('sendExport failed', e);
      this.notify('error', e);
    }
  }
}

export default PeerSyncService;
