import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PeerSyncService,
  deriveSessionKey,
  generateSalt,
  generateSessionId,
  generatePin,
  MAX_PIN_ATTEMPTS,
  LOCKOUT_BASE_MS,
} from './peerSyncService';
import type { PeerStatus } from './peerSyncService';

// ---------------------------------------------------------------------------
// PeerJS mock
//
// vi.hoisted() is required so these values are available inside the vi.mock()
// factory, which is itself hoisted before any import statements.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  class MockDataConn {
    handlers: Record<string, Array<(...a: any[]) => void>> = {};
    sentData: Array<{ type?: string; [k: string]: unknown }> = [];
    closed = false;
    open = true;

    on(evt: string, fn: (...a: any[]) => void) {
      (this.handlers[evt] ??= []).push(fn);
    }
    send(d: { type?: string; [k: string]: unknown }) {
      this.sentData.push(d);
    }
    close() {
      this.closed = true;
      this.emit('close');
    }
    emit(evt: string, ...args: unknown[]) {
      (this.handlers[evt] ?? []).forEach(fn => fn(...args));
    }
    sentOfType(type: string) {
      return this.sentData.filter(m => m.type === type);
    }
  }

  class MockPeer {
    handlers: Record<string, Array<(...a: any[]) => void>> = {};
    destroyed = false;
    latestConn: MockDataConn | null = null;

    on(evt: string, fn: (...a: any[]) => void) {
      (this.handlers[evt] ??= []).push(fn);
    }
    emit(evt: string, ...args: unknown[]) {
      (this.handlers[evt] ?? []).forEach(fn => fn(...args));
    }
    connect(_hostId: string): MockDataConn {
      this.latestConn = new MockDataConn();
      return this.latestConn;
    }
    destroy() {
      this.destroyed = true;
    }
  }

  const instances: MockPeer[] = [];

  class PeerConstructor extends MockPeer {
    constructor(_id?: string, _opts?: unknown) {
      super();
      instances.push(this);
    }
  }

  return {
    MockDataConn,
    MockPeer,
    PeerConstructor,
    instances,
    last: () => instances[instances.length - 1] as MockPeer | undefined,
    reset() {
      instances.splice(0);
    },
  };
});

vi.mock('peerjs', () => ({ default: mocks.PeerConstructor }));

type MockPeerT = InstanceType<typeof mocks.MockPeer>;

// Poll until `fn()` is truthy — used to await the real async crypto work that
// the service kicks off from synchronous PeerJS event handlers.
async function waitFor(fn: () => boolean, timeout = 3000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 5));
  }
}

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: ArrayBuffer) => new TextDecoder().decode(b);
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

// ---------------------------------------------------------------------------

describe('PeerSyncService', () => {
  beforeEach(() => {
    mocks.reset();
    PeerSyncService.resetLockout();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  describe('session key derivation (deriveSessionKey)', () => {
    it('derives the same AES-GCM key for the same PIN + salt (round-trips)', async () => {
      const salt = generateSalt();
      const k1 = await deriveSessionKey('123456', salt);
      const k2 = await deriveSessionKey('123456', salt);

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k1, enc('secret'));
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k2, cipher);
      expect(dec(plain)).toBe('secret');
    });

    it('derives a DIFFERENT key when the PIN differs', async () => {
      const salt = generateSalt();
      const kA = await deriveSessionKey('111111', salt);
      const kB = await deriveSessionKey('222222', salt);

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kA, enc('secret'));
      await expect(crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kB, cipher)).rejects.toBeTruthy();
    });

    it('yields a different key per pairing (different random salt, same PIN)', async () => {
      const kA = await deriveSessionKey('123456', generateSalt());
      const kB = await deriveSessionKey('123456', generateSalt());

      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kA, enc('secret'));
      // A ciphertext from pairing A must NOT decrypt under pairing B's key.
      await expect(crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kB, cipher)).rejects.toBeTruthy();
    });

    it('rejects an empty PIN or empty salt', async () => {
      await expect(deriveSessionKey('', generateSalt())).rejects.toThrow(/PIN/);
      await expect(deriveSessionKey('123456', new Uint8Array(0))).rejects.toThrow(/salt/);
    });
  });

  // -------------------------------------------------------------------------
  describe('CSPRNG generators', () => {
    it('generateSalt uses crypto.getRandomValues and returns 16 random bytes', () => {
      const spy = vi.spyOn(crypto, 'getRandomValues');
      const s1 = generateSalt();
      const s2 = generateSalt();
      expect(spy).toHaveBeenCalled();
      expect(s1).toHaveLength(16);
      expect(b64(s1)).not.toBe(b64(s2)); // overwhelmingly unlikely to collide
      spy.mockRestore();
    });

    it('generateSessionId returns lcp-<uuid v4> with no timestamp/Math.random component', () => {
      const spy = vi.spyOn(Math, 'random');
      const id = generateSessionId();
      const uuidV4 = /^lcp-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidV4);
      expect(spy).not.toHaveBeenCalled(); // never derived from Math.random
      // No embedded timestamp: the id must not contain the current-time prefix.
      const now = String(Date.now());
      expect(id).not.toContain(now.slice(0, 8));
      spy.mockRestore();

      const ids = new Set(Array.from({ length: 200 }, () => generateSessionId()));
      expect(ids.size).toBe(200); // unique
    });

    it('generatePin returns a uniform 6-digit PIN via crypto (no Math.random, no bias)', () => {
      const rnd = vi.spyOn(Math, 'random');
      const csprng = vi.spyOn(crypto, 'getRandomValues');
      const pins = Array.from({ length: 500 }, () => generatePin());

      expect(csprng).toHaveBeenCalled();
      expect(rnd).not.toHaveBeenCalled();
      for (const pin of pins) expect(pin).toMatch(/^\d{6}$/);
      // Entropy sanity: 500 draws should not all be identical.
      expect(new Set(pins).size).toBeGreaterThan(1);
      csprng.mockRestore();
      rnd.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  describe('startHosting', () => {
    it('notifies creating then hosting when the peer channel opens', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.startHosting('host-peer', '123456');
      expect(statuses).toContain('creating');

      mocks.last()!.emit('open', 'host-peer');
      expect(statuses).toContain('hosting');
    });

    it('sends a random handshake salt when the connection opens', async () => {
      const svc = new PeerSyncService();
      await svc.startHosting('host-peer', '654321');
      mocks.last()!.emit('open', 'host-peer');

      const conn = new mocks.MockDataConn();
      mocks.last()!.emit('connection', conn);
      conn.emit('open');

      const handshakes = conn.sentOfType('handshake');
      expect(handshakes).toHaveLength(1);
      expect(typeof handshakes[0].salt).toBe('string');
      expect((handshakes[0].salt as string).length).toBeGreaterThan(0);
    });

    it('accepts the correct PIN, derives the session key and notifies auth-ok', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.startHosting('host-peer', '654321');
      mocks.last()!.emit('open', 'host-peer');

      const conn = new mocks.MockDataConn();
      mocks.last()!.emit('connection', conn);
      expect(statuses).toContain('client-connected');
      conn.emit('open');
      expect(statuses).toContain('connection-open');
      expect(statuses).toContain('auth-pending');

      conn.emit('data', { type: 'auth', pin: '654321' });
      await waitFor(() => conn.sentOfType('auth_ok').length > 0);

      expect(statuses).toContain('auth-ok');
      expect(conn.closed).toBe(false);
    });

    it('rejects a wrong PIN: sends auth_failed and closes the connection', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.startHosting('host-peer', '111111');
      mocks.last()!.emit('open', 'host-peer');

      const conn = new mocks.MockDataConn();
      mocks.last()!.emit('connection', conn);
      conn.emit('open');

      conn.emit('data', { type: 'auth', pin: '999999' });
      await waitFor(() => conn.sentOfType('auth_failed').length > 0);

      expect(statuses).toContain('auth-failed');
      expect(conn.closed).toBe(true);
    });

    it('rejects a second concurrent connection while one is already open', async () => {
      const svc = new PeerSyncService();
      await svc.startHosting('host-peer', '123456');

      const conn1 = new mocks.MockDataConn();
      mocks.last()!.emit('connection', conn1);

      const conn2 = new mocks.MockDataConn();
      mocks.last()!.emit('connection', conn2);

      expect(conn1.closed).toBe(false);
      expect(conn2.closed).toBe(true);
    });

    it('notifies stopped when the connection closes', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.startHosting('host-peer', '123456');
      const conn = new mocks.MockDataConn();
      mocks.last()!.emit('connection', conn);
      conn.emit('open');

      conn.close();
      expect(statuses).toContain('stopped');
    });
  });

  // -------------------------------------------------------------------------
  describe('brute-force lockout', () => {
    async function sendWrongPin(peer: MockPeerT, pin = '000000') {
      const conn = new mocks.MockDataConn();
      peer.emit('connection', conn);
      conn.emit('open');
      conn.emit('data', { type: 'auth', pin });
      await waitFor(() => conn.sentOfType('auth_failed').length > 0);
      return conn;
    }

    it(`destroys the peer and locks out after ${MAX_PIN_ATTEMPTS} wrong PINs`, async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.startHosting('host-peer', '123456');
      const peer = mocks.last()!;
      peer.emit('open', 'host-peer');

      for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
        await sendWrongPin(peer);
      }

      expect(statuses.filter(s => s === 'auth-failed')).toHaveLength(MAX_PIN_ATTEMPTS);
      expect(statuses).toContain('locked-out');
      expect(peer.destroyed).toBe(true);
      // A back-off is armed, bounded by the base delay for the first lockout.
      const remaining = PeerSyncService.lockoutRemainingMs();
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(LOCKOUT_BASE_MS);
    });

    it('refuses to host again while the back-off is active', async () => {
      const svc = new PeerSyncService();
      await svc.startHosting('host-peer', '123456');
      const peer = mocks.last()!;
      peer.emit('open', 'host-peer');
      for (let i = 0; i < MAX_PIN_ATTEMPTS; i++) {
        await sendWrongPin(peer);
      }
      expect(PeerSyncService.lockoutRemainingMs()).toBeGreaterThan(0);

      const instancesBefore = mocks.instances.length;
      const statuses: PeerStatus[] = [];
      const svc2 = new PeerSyncService(undefined, s => statuses.push(s));
      await svc2.startHosting('host-peer-2', '654321');

      expect(statuses).toContain('locked-out');
      // No new Peer was created — hosting was refused before construction.
      expect(mocks.instances.length).toBe(instancesBefore);
    });
  });

  // -------------------------------------------------------------------------
  describe('connect', () => {
    it('waits for the handshake, then sends the PIN once the salt arrives', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.connect('remote-host', '555555');
      mocks.last()!.emit('open', 'ephemeral-id');
      const conn = mocks.last()!.latestConn!;
      conn.emit('open');

      expect(statuses).toContain('connection-open');
      expect(statuses).toContain('auth-pending');
      // No PIN is leaked before the host's handshake salt is received.
      expect(conn.sentOfType('auth')).toHaveLength(0);

      const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
      conn.emit('data', { type: 'handshake', salt });
      await waitFor(() => conn.sentOfType('auth').length > 0);

      expect(conn.sentData).toContainEqual({ type: 'auth', pin: '555555' });
    });

    it('notifies auth-ok when the host confirms authentication', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.connect('remote-host', '555555');
      mocks.last()!.emit('open', 'ephemeral-id');
      const conn = mocks.last()!.latestConn!;
      conn.emit('open');

      conn.emit('data', { type: 'auth_ok' });
      await waitFor(() => statuses.includes('auth-ok'));
      expect(statuses).toContain('auth-ok');
    });

    it('notifies auth-failed and disconnects when the host rejects authentication', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.connect('remote-host', '555555');
      const peer = mocks.last()!;
      peer.emit('open', 'ephemeral-id');
      const conn = peer.latestConn!;
      conn.emit('open');

      conn.emit('data', { type: 'auth_failed' });
      await waitFor(() => peer.destroyed);

      expect(statuses).toContain('auth-failed');
      expect(peer.destroyed).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('end-to-end encryption round-trip', () => {
    it('host encrypts with the session key; client decrypts with the same key', async () => {
      // Host side
      const host = new PeerSyncService();
      await host.startHosting('host-peer', '424242');
      const hostPeer = mocks.last()!;
      hostPeer.emit('open', 'host-peer');
      const hostConn = new mocks.MockDataConn();
      hostPeer.emit('connection', hostConn);
      hostConn.emit('open');
      const salt = hostConn.sentOfType('handshake')[0].salt as string;

      // Client side derives the key from the same salt + PIN
      const received: string[] = [];
      const client = new PeerSyncService(async data => {
        if (data.type === 'export') received.push(data.payload);
      });
      await client.connect('host-peer', '424242');
      const clientPeer = mocks.last()!;
      clientPeer.emit('open', 'client-id');
      const clientConn = clientPeer.latestConn!;
      clientConn.emit('open');
      clientConn.emit('data', { type: 'handshake', salt });
      await waitFor(() => clientConn.sentOfType('auth').length > 0);

      // Host validates the PIN → derives the key, then sends an encrypted export
      hostConn.emit('data', { type: 'auth', pin: '424242' });
      await waitFor(() => hostConn.sentOfType('auth_ok').length > 0);

      const payload = JSON.stringify({ properties: [{ id: 1 }], version: '1.0.0' });
      host.sendExport(payload);
      await waitFor(() => hostConn.sentOfType('export').length > 0);

      // Feed the host's encrypted export into the client's data handler
      const exportMsg = hostConn.sentOfType('export')[0];
      clientConn.emit('data', exportMsg);
      await waitFor(() => received.length > 0);

      expect(received[0]).toBe(payload);
    });
  });

  // -------------------------------------------------------------------------
  describe('sendExport', () => {
    it('throws synchronously when there is no open connection', () => {
      const svc = new PeerSyncService();
      expect(() => svc.sendExport('{"test":1}')).toThrow('No open connection to send data');
    });
  });

  // -------------------------------------------------------------------------
  describe('stopHosting', () => {
    it('destroys the peer and notifies stopped', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.startHosting('host-peer', '123456');
      const peer = mocks.last()!;

      svc.stopHosting();

      expect(peer.destroyed).toBe(true);
      expect(statuses).toContain('stopped');
    });
  });
});
