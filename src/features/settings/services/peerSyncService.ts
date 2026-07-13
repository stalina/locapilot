import Peer, { type DataConnection } from 'peerjs';

// Runtime-injected values (via Vite define). Typed through the `ImportMeta`
// augmentation in `src/vite-env.d.ts`, so no `@ts-ignore`/`as any` is needed.
const APP_VERSION = import.meta.__APP_VERSION__ || '';
const BUILD_SECRET_KEY = import.meta.__BUILD_SECRET_KEY__ || '';
const APP_NAME = 'locapilot';

/**
 * Typed protocol exchanged over the PeerJS data connection.
 *
 * A discriminated union on `type`: narrowing on `msg.type` makes the extra
 * fields (`pin`, `iv`, `payload`) type-safe only inside the matching branch.
 * Messages whose `type` is not part of this union are treated as pass-through
 * (see `connect()`), never as a protocol error.
 */
export type SyncMessage =
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
const base64ToUint8 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function deriveKey(): Promise<CryptoKey> {
  // Concatenate app name + version + build secret
  const seed = `${APP_NAME}:${APP_VERSION}:${BUILD_SECRET_KEY}`;
  const ikm = textToUint8(seed);

  // Import as raw key for HKDF
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveKey']);

  // Derive a 256-bit AES-GCM key using HKDF-SHA-256
  const derived = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(16), info: new Uint8Array(0) },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return derived;
}

async function encryptPayload(plain: string) {
  const key = await deriveKey();
  // random IV 12 bytes
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = textToUint8(plain);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  const cipherU8 = new Uint8Array(cipher);
  return { iv: uint8ToBase64(iv), payload: uint8ToBase64(cipherU8) };
}

async function decryptPayload(ivB64: string, payloadB64: string) {
  const key = await deriveKey();
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

  constructor(onData?: OnDataCb, onStatus?: OnStatusCb) {
    this.onData = onData;
    this.onStatus = onStatus;
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

  async startHosting(id: string, pin: string) {
    if (this.peer) return;
    this.pairingPin = pin;
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
        this.notify('auth-pending');
      });

      c.on('data', (msg: unknown) => {
        if (isRecord(msg) && msg.type === 'auth') {
          if (msg.pin === this.pairingPin) {
            c.send({ type: 'auth_ok' } satisfies SyncMessage);
            this.notify('auth-ok');
          } else {
            c.send({ type: 'auth_failed' } satisfies SyncMessage);
            this.notify('auth-failed');
            try {
              c.close();
            } catch {
              // ignore
            }
            this.conn = null;
          }
        }
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
    this.pairingPin = '';
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

    // create an ephemeral peer id to avoid passing undefined to Peer constructor
    const ephemeralId = `peer-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
    this.peer = new Peer(ephemeralId, { debug: this.debugLevel });

    this.peer.on('open', (id: string) => {
      this.notify('connected', id);
      const conn = this.peer!.connect(hostId);
      this.conn = conn;

      conn.on('open', () => {
        this.notify('connection-open');
        // Send pairing authentication immediately after channel opens
        conn.send({ type: 'auth', pin: this.pairingPin } satisfies SyncMessage);
        this.notify('auth-pending');
      });

      conn.on('data', async (data: unknown) => {
        try {
          if (isRecord(data) && data.type === 'auth_ok') {
            this.notify('auth-ok');
          } else if (isRecord(data) && data.type === 'auth_failed') {
            this.notify('auth-failed');
            this.disconnect();
          } else if (
            isRecord(data) &&
            data.type === 'export' &&
            typeof data.iv === 'string' &&
            typeof data.payload === 'string'
          ) {
            try {
              const decrypted = await decryptPayload(data.iv, data.payload);
              await this.onData?.({ type: 'export', payload: decrypted });
            } catch (e) {
              console.error('Failed to decrypt incoming payload', e);
              this.notify('error', e);
            }
          } else {
            // Unknown message type: pass through unchanged. The remote payload is
            // untyped at this boundary, so it is forwarded as-is to `onData`.
            await this.onData?.(data as SyncMessage | DecryptedExportMessage);
          }
        } catch (e) {
          console.error('onData handler failed', e);
        }
      });

      conn.on('error', (err: Error) => {
        this.notify('error', err);
      });
    });

    this.peer.on('error', (err: Error) => {
      this.notify('error', err);
    });
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
    this.pairingPin = '';
    this.notify('stopped');
  }

  sendExport(json: string) {
    const conn = this.conn;
    if (!conn || conn.open === false) {
      throw new Error('No open connection to send data');
    }
    try {
      // encrypt payload before sending
      (async () => {
        try {
          const { iv, payload } = await encryptPayload(json);
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
