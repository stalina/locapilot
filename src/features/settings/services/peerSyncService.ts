import Peer from 'peerjs';

// Runtime-injected values (via Vite define)
// @ts-ignore
const APP_VERSION = (import.meta as any).__APP_VERSION__ || '';
// @ts-ignore
const BUILD_SECRET_KEY = (import.meta as any).__BUILD_SECRET_KEY__ || '';
// application name from package.json is available via import.meta.env.PACKAGE_NAME is not standard,
// so rely on explicit package name here
const APP_NAME = 'locapilot';

// Crypto helpers
const textToUint8 = (s: string) => new TextEncoder().encode(s);
const uint8ToBase64 = (b: Uint8Array) => {
  // Convert in chunks to avoid call stack size exceeded for large arrays
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < b.length; i += chunkSize) {
    // slice to regular array for apply
    const chunk = Array.prototype.slice.call(b.subarray(i, i + chunkSize));
    binary += String.fromCharCode.apply(null, chunk as any);
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
  | 'connected'
  | 'importing'
  | 'warning'
  | 'error'
  | 'stopped';

export type OnDataCb = (data: any) => Promise<void> | void;
export type OnStatusCb = (status: PeerStatus, info?: any) => void;

export class PeerSyncService {
  private peer: any = null;
  private conn: any = null;
  private onData?: OnDataCb;
  private onStatus?: OnStatusCb;

  constructor(onData?: OnDataCb, onStatus?: OnStatusCb) {
    this.onData = onData;
    this.onStatus = onStatus;
  }

  private notify(status: PeerStatus, info?: any) {
    try {
      this.onStatus?.(status, info);
    } catch (e) {
      console.error('onStatus callback failed', e);
    }
  }

  async startHosting(id: string) {
    if (this.peer) return;
    this.notify('creating');
    this.peer = new Peer(id, { debug: 2 });

    this.peer.on('open', (peerId: string) => {
      this.notify('hosting', peerId);
    });

    this.peer.on('connection', (c: any) => {
      this.conn = c;
      this.notify('client-connected');

      this.conn.on('open', () => {
        this.notify('connection-open');
      });

      this.conn.on('close', () => {
        this.notify('stopped');
        this.conn = null;
      });

      this.conn.on('error', (err: any) => {
        this.notify('error', err);
      });
    });

    this.peer.on('error', (err: any) => {
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
    this.notify('stopped');
  }

  async connect(hostId: string) {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        console.warn('peer.destroy failed', e);
      }
      this.peer = null;
    }

    // create an ephemeral peer id to avoid passing undefined to Peer constructor
    const ephemeralId = `peer-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`;
    this.peer = new Peer(ephemeralId, { debug: 2 });

    this.peer.on('open', (id: string) => {
      this.notify('connected', id);
      this.conn = this.peer.connect(hostId);

      this.conn.on('open', () => {
        this.notify('connection-open');
      });

      this.conn.on('data', async (data: any) => {
        try {
          // Expect encrypted shape: { type: 'export', iv, payload }
          if (data?.type === 'export' && data.iv && data.payload) {
            try {
              const decrypted = await decryptPayload(data.iv, data.payload);

              await this.onData?.({ type: 'export', payload: decrypted });
            } catch (e) {
              console.error('Failed to decrypt incoming payload', e);
              this.notify('error', e);
            }
          } else {
            // pass-through for other messages
            await this.onData?.(data);
          }
        } catch (e) {
          console.error('onData handler failed', e);
        }
      });

      this.conn.on('error', (err: any) => {
        this.notify('error', err);
      });
    });

    this.peer.on('error', (err: any) => {
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
    this.notify('stopped');
  }

  sendExport(json: string) {
    if (!this.conn || this.conn.open === false) {
      throw new Error('No open connection to send data');
    }
    try {
      // encrypt payload before sending
      (async () => {
        try {
          const { iv, payload } = await encryptPayload(json);
          this.conn.send({ type: 'export', iv, payload });
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
