import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PeerSyncService,
  deriveSessionKey,
  generateSalt,
  generateSessionId,
  normalizeSessionId,
  generatePin,
  encryptDataMessage,
  decryptDataMessage,
  frameBlobChunk,
  unframeBlobChunk,
  chunkCount,
  parseSyncMessage,
  MAX_PIN_ATTEMPTS,
  LOCKOUT_BASE_MS,
  PROTOCOL_VERSION,
  CHUNK_BYTES,
  FLOW_WINDOW_BYTES,
  INACTIVITY_TIMEOUT_MS,
} from './peerSyncService';
import type {
  PeerStatus,
  OnManifestCb,
  ReceivedSyncPayload,
  TransferManifest,
  TransferOutcome,
} from './peerSyncService';
import {
  SYNC_TABLES,
  createSyncSource,
  type SyncTableName,
  type SyncTables,
} from './dataTransferService';

// ---------------------------------------------------------------------------
// PeerJS mock
//
// vi.hoisted() is required so these values are available inside the vi.mock()
// factory, which is itself hoisted before any import statements.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
  type Handler = (...args: never[]) => void;
  type Wire = { type?: string; [k: string]: unknown };

  class MockDataConn {
    handlers: Record<string, Handler[]> = {};
    sentData: Wire[] = [];
    closed = false;
    open = true;
    /** Other end of a bridged pair: closing one side closes the other. */
    remote: MockDataConn | null = null;
    dataChannel?: unknown;
    bufferSize?: number;

    on(evt: string, fn: Handler) {
      (this.handlers[evt] ??= []).push(fn);
    }
    send(d: Wire) {
      this.sentData.push(d);
    }
    close() {
      if (this.closed) return;
      this.closed = true;
      this.open = false;
      this.emit('close');
      const remote = this.remote;
      if (remote) queueMicrotask(() => remote.close());
    }
    emit(evt: string, ...args: unknown[]) {
      (this.handlers[evt] ?? []).forEach(fn => (fn as (...a: unknown[]) => void)(...args));
    }
    sentOfType(type: string) {
      return this.sentData.filter(m => m.type === type);
    }
  }

  class MockPeer {
    handlers: Record<string, Handler[]> = {};
    destroyed = false;
    latestConn: MockDataConn | null = null;
    connectOptions: unknown = undefined;

    on(evt: string, fn: Handler) {
      (this.handlers[evt] ??= []).push(fn);
    }
    emit(evt: string, ...args: unknown[]) {
      (this.handlers[evt] ?? []).forEach(fn => (fn as (...a: unknown[]) => void)(...args));
    }
    connect(_hostId: string, options?: unknown): MockDataConn {
      this.connectOptions = options;
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
type MockConnT = InstanceType<typeof mocks.MockDataConn>;
type Wire = { type?: string; [k: string]: unknown };
type StatusEvent = { status: PeerStatus; info?: unknown };

// One macrotask turn, NOT faked by the fake-timer tests below (they only fake
// setTimeout/clearTimeout), so the helpers work with both kinds of timers.
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

// Poll until `fn()` is truthy — used to await the real async crypto work that
// the service kicks off from synchronous PeerJS event handlers.
async function waitFor(fn: () => boolean, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out');
    await tick();
  }
}

/** Let pending async work settle for a few event-loop turns. */
async function settle(turns = 200) {
  for (let i = 0; i < turns; i++) await tick();
}

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: ArrayBuffer) => new TextDecoder().decode(b);
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const json = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));

const PIN = '424242';
const ISO = '2026-01-01T00:00:00.000Z';
const MIB = 1024 * 1024;

const has = (events: StatusEvent[], status: PeerStatus) => events.some(e => e.status === status);
const errorReasons = (events: StatusEvent[]) =>
  events
    .filter(e => e.status === 'transfer-error')
    .map(e => (e.info as { reason?: string } | undefined)?.reason);
const dataMessages = (conn: MockConnT) => conn.sentOfType('data');

/** Deterministic byte pattern. */
function bytes(n: number, seed = 1): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 31 + seed) & 0xff;
  return out;
}

function tables(overrides: Partial<SyncTables> = {}): SyncTables {
  const empty = Object.fromEntries(SYNC_TABLES.map(t => [t, [] as unknown[]])) as SyncTables;
  return { ...empty, ...overrides };
}

const source = (overrides: Partial<SyncTables> = {}) =>
  createSyncSource(tables(overrides), '1.2.0', ISO);

function doc(id: number, data: Blob | null, mimeType = 'image/jpeg') {
  return {
    id,
    name: `doc-${id}`,
    type: 'photo',
    mimeType,
    size: data ? data.size : 0,
    data,
    createdAt: ISO,
    updatedAt: ISO,
  };
}

/**
 * Bridge two mock connections: each `send` is delivered to the other side on
 * a microtask, through a filter that tests can swap to drop, duplicate,
 * reorder or tamper with messages.
 */
function bridge(hostConn: MockConnT, clientConn: MockConnT) {
  const link = {
    toClient: (m: Wire): Wire[] => [m],
    toHost: (m: Wire): Wire[] => [m],
  };
  const wire = (from: MockConnT, to: MockConnT, filter: () => (m: Wire) => Wire[]) => {
    const original = from.send.bind(from);
    from.send = (d: Wire) => {
      original(d);
      for (const m of filter()(d)) {
        queueMicrotask(() => {
          if (!to.closed) to.emit('data', m);
        });
      }
    };
  };
  wire(hostConn, clientConn, () => link.toClient);
  wire(clientConn, hostConn, () => link.toHost);
  hostConn.remote = clientConn;
  clientConn.remote = hostConn;
  return link;
}

/** A host and a client service, paired and authenticated over a bridge. */
async function pair(opts: { onManifest?: OnManifestCb } = {}) {
  const hostEvents: StatusEvent[] = [];
  const clientEvents: StatusEvent[] = [];
  const received: ReceivedSyncPayload[] = [];
  const manifests: TransferManifest[] = [];

  const host = new PeerSyncService(undefined, (status, info) => hostEvents.push({ status, info }));
  await host.startHosting('host-peer', PIN);
  const hostPeer = mocks.last()!;
  hostPeer.emit('open', 'host-peer');
  const hostConn = new mocks.MockDataConn();
  hostPeer.emit('connection', hostConn);

  const client = new PeerSyncService(
    data => {
      received.push(data);
    },
    (status, info) => clientEvents.push({ status, info }),
    async manifest => {
      manifests.push(manifest);
      return opts.onManifest ? opts.onManifest(manifest) : true;
    }
  );
  await client.connect('host-peer', PIN);
  const clientPeer = mocks.last()!;
  clientPeer.emit('open', 'client-id');
  const clientConn = clientPeer.latestConn!;
  clientConn.emit('open');

  const link = bridge(hostConn, clientConn);
  hostConn.emit('open'); // → handshake → auth → auth_ok
  await waitFor(() => has(hostEvents, 'auth-ok') && has(clientEvents, 'auth-ok'));

  return {
    host,
    client,
    hostPeer,
    hostConn,
    clientConn,
    link,
    hostEvents,
    clientEvents,
    received,
    manifests,
  };
}

/** A real client facing a hand-driven host: the test crafts every message. */
async function clientWithFakeHost(opts: { onManifest?: OnManifestCb } = {}) {
  const events: StatusEvent[] = [];
  const received: ReceivedSyncPayload[] = [];
  const onManifest = vi.fn(opts.onManifest ?? (async () => true));
  const client = new PeerSyncService(
    data => {
      received.push(data);
    },
    (status, info) => events.push({ status, info }),
    onManifest
  );
  await client.connect('host-peer', PIN);
  const peer = mocks.last()!;
  peer.emit('open', 'client-id');
  const conn = peer.latestConn!;
  conn.emit('open');

  const salt = generateSalt();
  conn.emit('data', { type: 'handshake', salt: b64(salt), protocolVersion: PROTOCOL_VERSION });
  await waitFor(() => conn.sentOfType('auth').length > 0);
  const key = await deriveSessionKey(PIN, salt);
  const transferId = crypto.randomUUID();

  const send = async (
    seq: number,
    kind: 'manifest' | 'records' | 'blob_chunk' | 'end',
    plaintext: Uint8Array<ArrayBuffer>,
    id = transferId
  ) => {
    conn.emit('data', await encryptDataMessage(key, id, seq, kind, plaintext));
  };
  const authOk = async () => {
    conn.emit('data', { type: 'auth_ok' });
    await waitFor(() => has(events, 'auth-ok'));
  };
  /** Send the manifest and wait for the client's `ready`. */
  const start = async (manifest: Record<string, unknown>) => {
    await send(0, 'manifest', json(manifest));
    await waitFor(() => conn.sentOfType('ready').length > 0);
  };

  return { client, conn, peer, events, received, onManifest, key, transferId, send, authOk, start };
}

function manifestFor(
  overrides: {
    counts?: Partial<Record<SyncTableName, number>>;
    totalBytes?: number;
    totalChunks?: number;
    documents?: number;
  } = {}
) {
  const counts = Object.fromEntries(SYNC_TABLES.map(t => [t, 0]));
  return {
    protocolVersion: PROTOCOL_VERSION,
    appVersion: '1.2.0',
    exportedAt: ISO,
    documents: overrides.documents ?? 0,
    totalBytes: overrides.totalBytes ?? 0,
    totalChunks: overrides.totalChunks ?? 1,
    counts: { ...counts, ...overrides.counts },
  };
}

// ---------------------------------------------------------------------------

describe('PeerSyncService', () => {
  beforeEach(() => {
    mocks.reset();
    PeerSyncService.resetLockout();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    it('generateSessionId returns a short dictable code via crypto (no Math.random/timestamp)', () => {
      const rnd = vi.spyOn(Math, 'random');
      const csprng = vi.spyOn(crypto, 'getRandomValues');
      const id = generateSessionId();

      // Format: prefix "LP" + 8 chars from the unambiguous alphabet, ≤ 10 chars.
      expect(id).toMatch(/^LP[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);
      expect(id.length).toBe(10);
      // No ambiguous-when-spoken characters (0/O, 1/I/L, U) in the random part.
      expect(id.slice(2)).not.toMatch(/[01OILU]/);

      expect(csprng).toHaveBeenCalled();
      expect(rnd).not.toHaveBeenCalled(); // never derived from Math.random
      // No embedded timestamp: the id must not contain the current-time prefix.
      const now = String(Date.now());
      expect(id).not.toContain(now.slice(0, 8));
      csprng.mockRestore();
      rnd.mockRestore();

      // Uniqueness across many draws, and a spread of first random characters
      // (sanity check that the alphabet is actually exercised, i.e. not biased).
      const ids = Array.from({ length: 500 }, () => generateSessionId());
      expect(new Set(ids).size).toBe(500);
      const firstChars = new Set(ids.map(v => v[2]));
      expect(firstChars.size).toBeGreaterThan(5);
    });

    it('normalizeSessionId uppercases and strips spaces/dashes for re-keying tolerance', () => {
      expect(normalizeSessionId('lp7k4mq2xb')).toBe('LP7K4MQ2XB');
      expect(normalizeSessionId('  LP-7K4M-Q2XB ')).toBe('LP7K4MQ2XB');
      expect(normalizeSessionId('lp 7k4m q2xb')).toBe('LP7K4MQ2XB');
      // Round-trips a freshly generated id unchanged.
      const id = generateSessionId();
      expect(normalizeSessionId(id)).toBe(id);
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

    it('sends a random handshake salt and the protocol version when the connection opens', async () => {
      const svc = new PeerSyncService();
      await svc.startHosting('host-peer', '654321');
      mocks.last()!.emit('open', 'host-peer');

      const conn = new mocks.MockDataConn();
      mocks.last()!.emit('connection', conn);
      conn.emit('open');

      const handshakes = conn.sentOfType('handshake');
      expect(handshakes).toHaveLength(1);
      expect(typeof handshakes[0]?.salt).toBe('string');
      expect((handshakes[0]?.salt as string).length).toBeGreaterThan(0);
      expect(handshakes[0]?.protocolVersion).toBe(PROTOCOL_VERSION);
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
  });

  // -------------------------------------------------------------------------
  describe('host session lifecycle', () => {
    const PIN = '123456';

    async function host() {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));
      await svc.startHosting('host-peer', PIN);
      const peer = mocks.last()!;
      peer.emit('open', 'host-peer');
      return { svc, peer, statuses };
    }

    function openConn(peer: MockPeerT) {
      const conn = new mocks.MockDataConn();
      peer.emit('connection', conn);
      conn.emit('open');
      return conn;
    }

    async function authenticate(conn: InstanceType<typeof mocks.MockDataConn>) {
      conn.emit('data', { type: 'auth', pin: PIN });
      await waitFor(() => conn.sentOfType('auth_ok').length > 0);
    }

    it('notifies client-disconnected — not stopped — and keeps listening when a client leaves', async () => {
      const { peer, statuses } = await host();
      const conn = openConn(peer);

      statuses.length = 0;
      conn.close();

      expect(statuses).toEqual(['client-disconnected']);
      expect(peer.destroyed).toBe(false);
    });

    it('accepts and authenticates a new connection on the same session after a client left', async () => {
      const { peer } = await host();
      openConn(peer).close();

      const conn2 = openConn(peer);
      expect(conn2.closed).toBe(false);
      expect(conn2.sentOfType('handshake')).toHaveLength(1);

      await authenticate(conn2);
      expect(conn2.closed).toBe(false);
    });

    it('keeps hosting after a wrong PIN: reports auth-failed only, then accepts a new connection', async () => {
      const { peer, statuses } = await host();
      const conn = openConn(peer);

      statuses.length = 0;
      conn.emit('data', { type: 'auth', pin: '000000' });
      await waitFor(() => conn.closed);

      // The rejection is reported once, as auth-failed — never as stopped.
      expect(statuses).toEqual(['auth-failed']);
      expect(peer.destroyed).toBe(false);
      expect(PeerSyncService.lockoutRemainingMs()).toBe(0);

      const conn2 = openConn(peer);
      expect(conn2.closed).toBe(false);
      expect(conn2.sentOfType('handshake')).toHaveLength(1);
    });

    it('counts wrong PINs across the connections of one session, then locks out', async () => {
      const { peer, statuses } = await host();

      for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) {
        const conn = openConn(peer);
        conn.emit('data', { type: 'auth', pin: '000000' });
        await waitFor(() => conn.closed);
        expect(peer.destroyed).toBe(false);
      }

      const last = openConn(peer);
      last.emit('data', { type: 'auth', pin: '000000' });
      await waitFor(() => peer.destroyed);

      expect(statuses.filter(s => s === 'auth-failed')).toHaveLength(MAX_PIN_ATTEMPTS);
      expect(statuses[statuses.length - 1]).toBe('locked-out');
      expect(statuses).not.toContain('client-disconnected');
      expect(statuses).not.toContain('stopped');
      expect(last.closed).toBe(true);
    });

    it('discards the session key of a client that disconnected', async () => {
      const { svc, peer } = await host();
      const conn1 = openConn(peer);
      await authenticate(conn1);
      conn1.close();

      // An unauthenticated next client must not inherit the previous key.
      openConn(peer);
      await expect(svc.streamTransfer(source())).rejects.toThrow('No session key established');
    });

    it('ignores an authentication that completes after the client left', async () => {
      const key = await deriveSessionKey(PIN, generateSalt());
      let finishDerivation: (k: CryptoKey) => void = () => {};
      const deriveKey = vi
        .spyOn(crypto.subtle, 'deriveKey')
        .mockImplementationOnce(() => new Promise<CryptoKey>(r => (finishDerivation = r)));

      const { peer, statuses } = await host();
      const conn = openConn(peer);
      conn.emit('data', { type: 'auth', pin: PIN });
      await waitFor(() => deriveKey.mock.calls.length > 0);

      conn.close();
      finishDerivation(key);
      await new Promise(r => setTimeout(r, 10));

      expect(conn.sentOfType('auth_ok')).toHaveLength(0);
      expect(statuses).not.toContain('auth-ok');
      expect(peer.destroyed).toBe(false);
      deriveKey.mockRestore();
    });

    it('ends the session with transfer-complete when the client leaves after acknowledging end', async () => {
      const p = await pair();
      expect(await p.host.streamTransfer(source({ properties: [{ id: 1 }] }))).toBe('completed');
      await waitFor(() => p.received.length === 1);

      // `end` acknowledged, client still connected: the session is still open.
      expect(has(p.hostEvents, 'transfer-complete')).toBe(false);
      expect(p.hostPeer.destroyed).toBe(false);

      p.hostEvents.length = 0;
      p.client.disconnect();
      await waitFor(() => p.hostConn.closed);

      expect(p.hostEvents.map(e => e.status)).toEqual(['transfer-complete']);
      expect(p.hostPeer.destroyed).toBe(true);

      // The service can host a brand-new session afterwards.
      const instancesBefore = mocks.instances.length;
      await p.host.startHosting('host-peer-2', '654321');
      expect(mocks.instances.length).toBe(instancesBefore + 1);
    });

    it('ends the session even when the client closes right after its ack of end', async () => {
      const p = await pair();
      // The client closes as soon as it acknowledged `end`, before importing.
      p.link.toHost = m => {
        if (m.type === 'ack' && m.seq === dataMessages(p.hostConn).length - 1) {
          queueMicrotask(() => p.clientConn.close());
        }
        return [m];
      };

      expect(await p.host.streamTransfer(source({ properties: [{ id: 1 }] }))).toBe('completed');
      await waitFor(() => has(p.hostEvents, 'transfer-complete'));

      expect(errorReasons(p.hostEvents)).toEqual([]);
      expect(has(p.hostEvents, 'client-disconnected')).toBe(false);
      expect(p.hostPeer.destroyed).toBe(true);
    });

    it('keeps the session open when a client that did not complete a transfer leaves', async () => {
      const { svc, peer, statuses } = await host();
      const conn = openConn(peer);
      await authenticate(conn);

      statuses.length = 0;
      conn.close();

      expect(statuses).toEqual(['client-disconnected']);
      expect(peer.destroyed).toBe(false);
      // Not a stale completion: a new connection can still be accepted.
      const conn2 = openConn(peer);
      expect(conn2.closed).toBe(false);
      await expect(svc.streamTransfer(source())).rejects.toThrow('No session key established');
    });

    it('ignores messages from a connection that is no longer the current one', async () => {
      const { peer, statuses } = await host();
      const conn1 = openConn(peer);
      conn1.close();
      const conn2 = openConn(peer);

      statuses.length = 0;
      // Late messages delivered by the departed connection are ignored: no
      // authentication, and no wrong-PIN count against the current session.
      conn1.emit('data', { type: 'auth', pin: PIN });
      conn1.emit('data', { type: 'auth', pin: '000000' });
      await settle(20);

      expect(conn1.sentOfType('auth_ok')).toHaveLength(0);
      expect(conn1.sentOfType('auth_failed')).toHaveLength(0);
      expect(statuses).toEqual([]);
      expect(conn2.closed).toBe(false);
    });

    it('stopHosting with a connected client reports stopped only', async () => {
      const { svc, peer, statuses } = await host();
      const conn = openConn(peer);

      statuses.length = 0;
      svc.stopHosting();

      expect(statuses).toEqual(['stopped']);
      expect(conn.closed).toBe(true);
      expect(peer.destroyed).toBe(true);
    });

    it('ignores transfer control messages from an unauthenticated client', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));
      await svc.startHosting('host-peer', '123456');
      const conn = new mocks.MockDataConn();
      mocks.last()!.emit('connection', conn);
      conn.emit('open');

      conn.emit('data', { type: 'ready', transferId: 'x' });
      conn.emit('data', { type: 'ack', transferId: 'x', seq: 3 });
      conn.emit('data', { type: 'abort', transferId: 'x', reason: 'corrupted' });
      await settle(20);

      expect(statuses).not.toContain('transfer-error');
      expect(conn.sentData.map(m => m.type)).toEqual(['handshake']);
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
    it('opens an ORDERED (reliable) data connection to the host', async () => {
      const svc = new PeerSyncService();
      await svc.connect('remote-host', '555555');
      mocks.last()!.emit('open', 'ephemeral-id');

      expect(mocks.last()!.connectOptions).toEqual({ reliable: true });
    });

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
      conn.emit('data', { type: 'handshake', salt, protocolVersion: PROTOCOL_VERSION });
      await waitFor(() => conn.sentOfType('auth').length > 0);

      expect(conn.sentData).toContainEqual({ type: 'auth', pin: '555555' });
    });

    it.each([
      ['an older protocol version', 1],
      ['a newer protocol version', PROTOCOL_VERSION + 1],
      ['no protocol version (legacy host)', undefined],
    ])(
      'stops before authentication on a handshake with %s (protocol-mismatch)',
      async (_label, protocolVersion) => {
        const statuses: PeerStatus[] = [];
        const svc = new PeerSyncService(undefined, s => statuses.push(s));
        await svc.connect('remote-host', '555555');
        const peer = mocks.last()!;
        peer.emit('open', 'ephemeral-id');
        const conn = peer.latestConn!;
        conn.emit('open');

        const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
        conn.emit('data', { type: 'handshake', salt, protocolVersion });
        await waitFor(() => statuses.includes('protocol-mismatch'));

        expect(conn.sentOfType('auth')).toHaveLength(0);
        expect(peer.destroyed).toBe(true);
      }
    );

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
  describe('protocol helpers', () => {
    it('AAD binds each message to its transfer, position and kind', async () => {
      const key = await deriveSessionKey(PIN, generateSalt());
      const id = crypto.randomUUID();
      const msg = await encryptDataMessage(key, id, 3, 'blob_chunk', bytes(100));

      await expect(decryptDataMessage(key, msg)).resolves.toEqual(bytes(100));
      // Same ciphertext presented as chunk 4, as another kind or transfer → fails.
      await expect(decryptDataMessage(key, { ...msg, seq: 4 })).rejects.toBeTruthy();
      await expect(decryptDataMessage(key, { ...msg, kind: 'records' })).rejects.toBeTruthy();
      await expect(
        decryptDataMessage(key, { ...msg, transferId: crypto.randomUUID() })
      ).rejects.toBeTruthy();
    });

    it('uses a fresh 12-byte IV for every message', async () => {
      const key = await deriveSessionKey(PIN, generateSalt());
      const id = crypto.randomUUID();
      const a = await encryptDataMessage(key, id, 1, 'records', bytes(10));
      const b = await encryptDataMessage(key, id, 1, 'records', bytes(10));
      expect(a.iv).toHaveLength(12);
      expect(b64(a.iv)).not.toBe(b64(b.iv));
    });

    it('frames and unframes a blob chunk; rejects invalid framing', () => {
      const header = { table: 'documents' as const, id: 7, index: 2, last: true };
      const framed = frameBlobChunk(header, bytes(50));
      expect(unframeBlobChunk(framed)).toEqual({ header, bytes: bytes(50) });

      expect(unframeBlobChunk(new Uint8Array(2))).toBeNull();
      const badLength = new Uint8Array(8);
      new DataView(badLength.buffer).setUint32(0, 1000);
      expect(unframeBlobChunk(badLength)).toBeNull();
      const badHeader = frameBlobChunk(
        { table: 'rents' as unknown as 'documents', id: 1, index: 0, last: true },
        bytes(1)
      );
      expect(unframeBlobChunk(badHeader)).toBeNull();
    });

    it('counts chunks: 0-byte → 1, exact multiple of 64 KiB → no extra chunk', () => {
      expect(chunkCount(0)).toBe(1);
      expect(chunkCount(1)).toBe(1);
      expect(chunkCount(CHUNK_BYTES)).toBe(1);
      expect(chunkCount(2 * CHUNK_BYTES)).toBe(2);
      expect(chunkCount(2 * CHUNK_BYTES + 1)).toBe(3);
    });

    it('ignores unknown or malformed messages safely', () => {
      expect(parseSyncMessage({ type: 'export', iv: 'x', payload: 'y' })).toBeNull();
      expect(parseSyncMessage({ type: 'bogus' })).toBeNull();
      expect(parseSyncMessage('auth')).toBeNull();
      expect(parseSyncMessage({ type: 'ack', transferId: 'x', seq: -1 })).toBeNull();
      expect(
        parseSyncMessage({
          type: 'data',
          transferId: 'x',
          seq: 0,
          kind: 'manifest',
          iv: new Uint8Array(4),
          ciphertext: new ArrayBuffer(1),
        })
      ).toBeNull();
      expect(
        parseSyncMessage({
          type: 'data',
          transferId: 'x',
          seq: 0,
          kind: 'manifest',
          iv: 'base64-iv',
          ciphertext: 'base64-payload',
        })
      ).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  describe('streamed transfer (issue #122)', () => {
    it('streams records and a 200 KiB Blob in ≤ 64 KiB chunks; the client reassembles it byte-identical', async () => {
      const content = bytes(200 * 1024);
      const p = await pair();

      const outcome = await p.host.streamTransfer(
        source({
          properties: [{ id: 1, name: 'Villa' }],
          documents: [doc(7, new Blob([content], { type: 'image/jpeg' }))],
        })
      );

      expect(outcome).toBe('completed');
      await waitFor(() => p.received.length === 1);
      const payload = p.received[0]!;
      expect(payload.version).toBe('1.2.0');
      expect(payload.exportedAt).toBe(ISO);
      expect(payload.properties).toEqual([{ id: 1, name: 'Villa' }]);
      const received = payload.documents[0] as Record<string, unknown>;
      expect(received).not.toHaveProperty('blobRef');
      const blob = received.data as Blob;
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');
      expect(new Uint8Array(await blob.arrayBuffer())).toEqual(content);

      const data = dataMessages(p.hostConn);
      const kinds = data.map(m => m.kind);
      expect(kinds[0]).toBe('manifest');
      expect(kinds.at(-1)).toBe('end');
      expect(kinds.filter(k => k === 'blob_chunk')).toHaveLength(4);
      // Strictly increasing sequence 0..N.
      expect(data.map(m => m.seq)).toEqual(data.map((_, i) => i));
      for (const chunk of data.filter(m => m.kind === 'blob_chunk')) {
        // ciphertext = ≤ 64 KiB of bytes + small framed header + 16-byte GCM tag
        expect((chunk.ciphertext as ArrayBuffer).byteLength).toBeLessThanOrEqual(
          CHUNK_BYTES + 16 + 4 + 128
        );
      }
      expect(p.manifests[0]).toMatchObject({
        totalBytes: content.byteLength,
        totalChunks: data.length - 1,
        documents: 1,
      });
      expect(p.manifests[0]!.counts.properties).toBe(1);
      // `transfer-complete` means "session ended": only once the client leaves.
      expect(has(p.hostEvents, 'transfer-complete')).toBe(false);
      expect(has(p.clientEvents, 'importing')).toBe(true);
      expect(errorReasons(p.hostEvents)).toEqual([]);
      expect(errorReasons(p.clientEvents)).toEqual([]);
    });

    it('encrypts every data message with its own IV, binary on the wire, never base64', async () => {
      const p = await pair();
      await p.host.streamTransfer(
        source({
          tenants: [{ id: 1 }],
          documents: [doc(1, new Blob([bytes(150 * 1024)]))],
        })
      );

      const all = [...p.hostConn.sentData, ...p.clientConn.sentData];
      for (const m of all) expect(m).not.toHaveProperty('payload');
      expect(all.some(m => m.type === 'export')).toBe(false);

      const data = dataMessages(p.hostConn);
      for (const m of data) {
        expect(ArrayBuffer.isView(m.iv)).toBe(true);
        // Realm-safe ArrayBuffer check (WebCrypto buffers come from another realm in jsdom).
        expect(Object.prototype.toString.call(m.ciphertext)).toBe('[object ArrayBuffer]');
      }
      const ivs = new Set(data.map(m => b64(m.iv as Uint8Array)));
      expect(ivs.size).toBe(data.length);
      // Only control messages travel in clear, and they carry no user data.
      const clear = all.filter(m => m.type !== 'data').map(m => m.type);
      expect(new Set(clear)).toEqual(new Set(['handshake', 'auth', 'auth_ok', 'ready', 'ack']));
    });

    it('synchronises an empty database (manifest and end still flow)', async () => {
      const p = await pair();

      expect(await p.host.streamTransfer(source())).toBe('completed');
      await waitFor(() => p.received.length === 1);

      expect(dataMessages(p.hostConn).map(m => m.kind)).toEqual(['manifest', 'end']);
      expect(p.manifests[0]).toMatchObject({ documents: 0, totalBytes: 0, totalChunks: 1 });
      for (const table of SYNC_TABLES) expect(p.received[0]![table]).toEqual([]);
    });

    it('sends a document without content as metadata only (data null, no chunk)', async () => {
      const p = await pair();
      await p.host.streamTransfer(source({ documents: [doc(3, null)] }));
      await waitFor(() => p.received.length === 1);

      expect(dataMessages(p.hostConn).some(m => m.kind === 'blob_chunk')).toBe(false);
      expect(p.received[0]!.documents[0]).toMatchObject({ id: 3, data: null });
    });

    it('handles a 0-byte Blob and a Blob that is an exact multiple of 64 KiB', async () => {
      const exact = bytes(2 * CHUNK_BYTES, 9);
      const p = await pair();
      await p.host.streamTransfer(
        source({
          documents: [
            doc(1, new Blob([], { type: 'text/plain' }), 'text/plain'),
            doc(2, new Blob([exact])),
          ],
          tenantDocuments: [
            {
              id: 5,
              tenantId: 1,
              name: 'cni',
              mimeType: 'image/png',
              size: 3,
              uploadedAt: ISO,
              data: new Blob([bytes(3)], { type: 'image/png' }),
            },
          ],
        })
      );
      await waitFor(() => p.received.length === 1);

      // 1 empty chunk + 2 chunks + 1 chunk
      expect(dataMessages(p.hostConn).filter(m => m.kind === 'blob_chunk')).toHaveLength(4);
      const [empty, multiple] = p.received[0]!.documents as Array<{ data: Blob }>;
      expect(empty!.data.size).toBe(0);
      expect(empty!.data.type).toBe('text/plain');
      expect(new Uint8Array(await multiple!.data.arrayBuffer())).toEqual(exact);
      const [tenantDoc] = p.received[0]!.tenantDocuments as Array<{ data: Blob }>;
      expect(new Uint8Array(await tenantDoc!.data.arrayBuffer())).toEqual(bytes(3));
    });

    it('sends nothing but the manifest before the client replies ready', async () => {
      let consent: (ok: boolean) => void = () => {};
      const p = await pair({ onManifest: () => new Promise<boolean>(r => (consent = r)) });

      const run = p.host.streamTransfer(
        source({ properties: [{ id: 1 }], documents: [doc(1, new Blob([bytes(1000)]))] })
      );
      await waitFor(() => p.manifests.length === 1);
      await settle();

      expect(dataMessages(p.hostConn).map(m => m.kind)).toEqual(['manifest']);
      expect(has(p.hostEvents, 'transfer-pending')).toBe(true);

      consent(true);
      expect(await run).toBe('completed');
    });

    it('stops after the manifest when the client cancels', async () => {
      const p = await pair({ onManifest: () => false });

      const outcome = await p.host.streamTransfer(
        source({ properties: [{ id: 1 }], documents: [doc(1, new Blob([bytes(1000)]))] })
      );

      expect(outcome).toBe('cancelled');
      expect(dataMessages(p.hostConn).map(m => m.kind)).toEqual(['manifest']);
      expect(p.clientConn.sentOfType('cancel')).toHaveLength(1);
      expect(has(p.hostEvents, 'transfer-cancelled')).toBe(true);
      expect(has(p.clientEvents, 'transfer-cancelled')).toBe(true);
      expect(errorReasons(p.hostEvents)).toEqual([]);
      expect(p.received).toHaveLength(0);

      // The client leaves after its `cancel`: the hosting session stays open.
      await waitFor(() => has(p.hostEvents, 'client-disconnected'));
      expect(has(p.hostEvents, 'transfer-complete')).toBe(false);
      expect(has(p.hostEvents, 'stopped')).toBe(false);
      expect(p.hostPeer.destroyed).toBe(false);
    });

    it('ignores a second ready and duplicate acks', async () => {
      const p = await pair();
      p.link.toHost = m => (m.type === 'ready' || m.type === 'ack' ? [m, m] : [m]);

      const outcome = await p.host.streamTransfer(
        source({ documents: [doc(1, new Blob([bytes(3 * MIB)]))] })
      );

      expect(outcome).toBe('completed');
      await waitFor(() => p.received.length === 1);
    });

    describe('integrity: the client aborts and imports nothing', () => {
      const integritySource = () =>
        source({
          properties: [{ id: 1 }],
          documents: [doc(1, new Blob([bytes(200 * 1024)]))],
        });

      async function expectCorruptedAbort(
        p: Awaited<ReturnType<typeof pair>>,
        run: Promise<TransferOutcome>
      ) {
        expect(await run).toBe('failed');
        await waitFor(() => has(p.clientEvents, 'transfer-error'));
        expect(errorReasons(p.clientEvents)).toEqual(['corrupted']);
        expect(errorReasons(p.hostEvents)).toEqual(['corrupted']);
        expect(p.clientConn.sentOfType('abort')).toHaveLength(1);
        expect(p.received).toHaveLength(0);
        expect(dataMessages(p.hostConn).some(m => m.kind === 'end')).toBe(false);
      }

      it('a tampered chunk fails AES-GCM authentication', async () => {
        const p = await pair();
        p.link.toClient = m => {
          if (m.type !== 'data' || m.seq !== 4) return [m];
          const tampered = new Uint8Array((m.ciphertext as ArrayBuffer).slice(0));
          tampered[10] = (tampered[10] ?? 0) ^ 0xff;
          return [{ ...m, ciphertext: tampered.buffer }];
        };
        await expectCorruptedAbort(p, p.host.streamTransfer(integritySource()));
      });

      it('a reordered chunk is detected by the sequence check', async () => {
        const p = await pair();
        let held: Wire | null = null;
        p.link.toClient = m => {
          if (m.type === 'data' && m.seq === 3) {
            held = m;
            return [];
          }
          if (m.type === 'data' && m.seq === 4 && held) return [m, held];
          return [m];
        };
        await expectCorruptedAbort(p, p.host.streamTransfer(integritySource()));
      });

      it('a duplicated chunk is detected by the sequence check', async () => {
        const p = await pair();
        p.link.toClient = m => (m.type === 'data' && m.seq === 3 ? [m, m] : [m]);
        await expectCorruptedAbort(p, p.host.streamTransfer(integritySource()));
      });

      it('a missing chunk is detected by the sequence check', async () => {
        const p = await pair();
        p.link.toClient = m => (m.type === 'data' && m.seq === 3 ? [] : [m]);
        await expectCorruptedAbort(p, p.host.streamTransfer(integritySource()));
      });
    });

    describe('flow control', () => {
      it('keeps at most the window unacknowledged, and resumes on ack', async () => {
        const p = await pair();
        const withheld: Wire[] = [];
        p.link.toHost = m => {
          if (m.type === 'ack') {
            withheld.push(m);
            return [];
          }
          return [m];
        };

        const run = p.host.streamTransfer(
          source({ documents: [doc(1, new Blob([bytes(8 * MIB)]))] })
        );
        const inFlight = () =>
          dataMessages(p.hostConn)
            .filter(m => (m.seq as number) > 0) // the manifest is acknowledged by `ready`
            .reduce((sum, m) => sum + (m.ciphertext as ArrayBuffer).byteLength, 0);

        // The host fills the window, then stalls: nothing more is sent.
        await waitFor(() => inFlight() > FLOW_WINDOW_BYTES - 2 * CHUNK_BYTES);
        await settle();
        const stalledAt = dataMessages(p.hostConn).length;
        await settle();
        expect(dataMessages(p.hostConn)).toHaveLength(stalledAt);
        expect(inFlight()).toBeLessThanOrEqual(FLOW_WINDOW_BYTES);
        expect(withheld.length).toBeGreaterThan(0);
        expect(dataMessages(p.hostConn).some(m => m.kind === 'end')).toBe(false);

        // Release the acks: the host resumes and completes.
        p.link.toHost = m => [m];
        p.hostConn.emit('data', withheld.at(-1));
        expect(await run).toBe('completed');
        await waitFor(() => p.received.length === 1);
        expect((p.received[0]!.documents[0] as { data: Blob }).data.size).toBe(8 * MIB);
      });

      it('waits while the data channel send buffer is above the threshold', async () => {
        const p = await pair();
        const listeners = new Set<() => void>();
        const channel = {
          bufferedAmount: 2 * FLOW_WINDOW_BYTES,
          bufferedAmountLowThreshold: 0,
          addEventListener: vi.fn((_type: string, fn: () => void) => listeners.add(fn)),
          removeEventListener: vi.fn((_type: string, fn: () => void) => listeners.delete(fn)),
        };
        p.hostConn.dataChannel = channel;

        const run = p.host.streamTransfer(source({ properties: [{ id: 1 }] }));
        await settle();
        expect(dataMessages(p.hostConn)).toHaveLength(0);
        expect(channel.addEventListener).toHaveBeenCalledWith(
          'bufferedamountlow',
          expect.any(Function)
        );
        expect(channel.bufferedAmountLowThreshold).toBe(FLOW_WINDOW_BYTES / 2);

        channel.bufferedAmount = 0;
        listeners.forEach(fn => fn());
        expect(await run).toBe('completed');
      });

      it("waits while PeerJS's own send queue is not empty", async () => {
        const p = await pair();
        p.hostConn.bufferSize = 2;

        const run = p.host.streamTransfer(source({ properties: [{ id: 1 }] }));
        await settle();
        expect(dataMessages(p.hostConn)).toHaveLength(0);

        p.hostConn.bufferSize = 0;
        expect(await run).toBe('completed');
      });
    });

    describe('interruption', () => {
      async function blockedTransfer() {
        const p = await pair();
        p.link.toHost = m => (m.type === 'ack' ? [] : [m]); // stall at the window
        const run = p.host.streamTransfer(
          source({ documents: [doc(1, new Blob([bytes(8 * MIB)]))] })
        );
        await waitFor(() => p.manifests.length === 1);
        await waitFor(() => dataMessages(p.hostConn).length > 10);
        return { p, run };
      }

      it('a connection close mid-transfer notifies interrupted on both sides', async () => {
        const { p, run } = await blockedTransfer();

        p.clientConn.close();

        expect(await run).toBe('failed');
        await waitFor(() => has(p.clientEvents, 'transfer-error'));
        expect(errorReasons(p.clientEvents)).toEqual(['interrupted']);
        expect(errorReasons(p.hostEvents)).toEqual(['interrupted']);
        expect(p.received).toHaveLength(0);
        // The interruption does not end the hosting session.
        expect(has(p.hostEvents, 'client-disconnected')).toBe(true);
        expect(has(p.hostEvents, 'transfer-complete')).toBe(false);
        expect(has(p.hostEvents, 'stopped')).toBe(false);
        expect(p.hostPeer.destroyed).toBe(false);
      });

      it('a network loss (error then close) mid-transfer keeps "interrupted" as the outcome', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { p, run } = await blockedTransfer();

        // PeerJS emits 'error' (e.g. NegotiationFailed on ICE failure) before 'close'.
        p.hostConn.emit('error', new Error('NegotiationFailed'));
        p.clientConn.emit('error', new Error('NegotiationFailed'));
        p.clientConn.close();

        expect(await run).toBe('failed');
        await waitFor(() => has(p.clientEvents, 'transfer-error'));
        expect(errorReasons(p.clientEvents)).toEqual(['interrupted']);
        expect(errorReasons(p.hostEvents)).toEqual(['interrupted']);
        // No generic 'error' status overwrites the outcome on either side.
        expect(has(p.hostEvents, 'error')).toBe(false);
        expect(has(p.clientEvents, 'error')).toBe(false);
        expect(p.received).toHaveLength(0);
        // The host session stays open.
        expect(has(p.hostEvents, 'stopped')).toBe(false);
        expect(p.hostPeer.destroyed).toBe(false);
        warn.mockRestore();
      });

      it('a connection error outside a transfer is still notified as error', async () => {
        const p = await pair();

        p.hostConn.emit('error', new Error('boom'));
        p.clientConn.emit('error', new Error('boom'));

        expect(has(p.hostEvents, 'error')).toBe(true);
        expect(has(p.clientEvents, 'error')).toBe(true);
      });

      it('the host stopping mid-transfer aborts the client, which imports nothing', async () => {
        const { p, run } = await blockedTransfer();

        p.host.stopHosting();

        expect(await run).toBe('cancelled');
        expect(p.hostConn.sentOfType('abort')).toEqual([
          expect.objectContaining({ type: 'abort', reason: 'cancelled' }),
        ]);
        await waitFor(() => has(p.clientEvents, 'transfer-error'));
        expect(errorReasons(p.clientEvents)).toEqual(['interrupted']);
        expect(errorReasons(p.hostEvents)).toEqual([]);
        expect(p.received).toHaveLength(0);
      });

      it('the host aborts after 60 s without any message from the client', async () => {
        const p = await pair();
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        p.link.toHost = m => (m.type === 'ack' ? [] : [m]);
        const run = p.host.streamTransfer(
          source({ documents: [doc(1, new Blob([bytes(8 * MIB)]))] })
        );
        await waitFor(() => dataMessages(p.hostConn).length > 10);
        await settle();

        vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);

        expect(await run).toBe('failed');
        expect(errorReasons(p.hostEvents)).toEqual(['timeout']);
        expect(p.hostConn.sentOfType('abort')).toEqual([
          expect.objectContaining({ reason: 'timeout' }),
        ]);
        expect(p.hostConn.closed).toBe(true);
        // The host keeps listening for a new attempt.
        expect(has(p.hostEvents, 'client-disconnected')).toBe(true);
        expect(p.hostPeer.destroyed).toBe(false);
      });
    });

    it('holds a screen wake lock on both devices and releases it at the end', async () => {
      const release = vi.fn(async () => {});
      const request = vi.fn(async () => ({ release }));
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
      try {
        const p = await pair();
        await p.host.streamTransfer(source({ properties: [{ id: 1 }] }));
        await waitFor(() => p.received.length === 1);

        expect(request).toHaveBeenCalledTimes(2);
        expect(request).toHaveBeenCalledWith('screen');
        await waitFor(() => release.mock.calls.length === 2);
      } finally {
        Reflect.deleteProperty(navigator, 'wakeLock');
      }
    });

    it('takes the host wake lock only once the client replied ready', async () => {
      const release = vi.fn(async () => {});
      const request = vi.fn(async () => ({ release }));
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
      try {
        let consent: (ok: boolean) => void = () => {};
        const p = await pair({ onManifest: () => new Promise<boolean>(r => (consent = r)) });
        const run = p.host.streamTransfer(source({ properties: [{ id: 1 }] }));
        await waitFor(() => p.manifests.length === 1);
        await settle();

        // Consent pending on the client: neither device holds a wake lock.
        expect(request).not.toHaveBeenCalled();

        consent(false);
        expect(await run).toBe('cancelled');
        expect(request).not.toHaveBeenCalled();
      } finally {
        Reflect.deleteProperty(navigator, 'wakeLock');
      }
    });

    it('continues the transfer when the wake lock is refused', async () => {
      const request = vi.fn(async () => {
        throw new Error('NotAllowedError');
      });
      Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
      try {
        const p = await pair();
        expect(await p.host.streamTransfer(source({ properties: [{ id: 1 }] }))).toBe('completed');
        expect(request).toHaveBeenCalled();
      } finally {
        Reflect.deleteProperty(navigator, 'wakeLock');
      }
    });

    it('streamTransfer throws without an open connection or a session key', async () => {
      const svc = new PeerSyncService();
      await expect(svc.streamTransfer(source())).rejects.toThrow('No open connection to send data');

      const host = new PeerSyncService();
      await host.startHosting('host-peer', PIN);
      const conn = new mocks.MockDataConn();
      mocks.last()!.emit('connection', conn);
      conn.emit('open');
      await expect(host.streamTransfer(source())).rejects.toThrow('No session key established');
    });
  });

  // -------------------------------------------------------------------------
  describe('client receive state machine (hand-driven host)', () => {
    it('ignores data messages received before auth_ok', async () => {
      const h = await clientWithFakeHost();

      await h.send(0, 'manifest', json(manifestFor()));
      await settle();

      expect(h.onManifest).not.toHaveBeenCalled();
      expect(h.conn.sentData.map(m => m.type)).toEqual(['auth']);
      expect(h.events.some(e => e.status.startsWith('transfer-'))).toBe(false);
    });

    it('asks for consent with the decrypted manifest, then replies ready', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();

      const manifest = manifestFor({ counts: { rents: 2 }, totalBytes: 5, totalChunks: 4 });
      await h.start(manifest);

      expect(h.onManifest).toHaveBeenCalledWith(manifest);
      expect(h.conn.sentOfType('ready')).toEqual([{ type: 'ready', transferId: h.transferId }]);
    });

    it('aborts when the manifest is not the first message', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();

      await h.send(1, 'records', json({ table: 'rents', records: [] }));
      await waitFor(() => has(h.events, 'transfer-error'));

      expect(errorReasons(h.events)).toEqual(['corrupted']);
      expect(h.onManifest).not.toHaveBeenCalled();
    });

    it('rejects end totals that differ from the manifest', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();
      await h.start(manifestFor({ counts: { properties: 1 }, totalChunks: 2 }));

      await h.send(1, 'records', json({ table: 'properties', records: [{ id: 1 }] }));
      await h.send(2, 'end', json({ totalChunks: 2, totalBytes: 999 }));
      await waitFor(() => has(h.events, 'transfer-error'));

      expect(errorReasons(h.events)).toEqual(['corrupted']);
      expect(h.received).toHaveLength(0);
      expect(h.conn.sentOfType('abort')).toHaveLength(1);
    });

    it('rejects an end arriving after fewer chunks than announced', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();
      await h.start(manifestFor({ counts: { properties: 1 }, totalChunks: 3 }));

      await h.send(1, 'records', json({ table: 'properties', records: [{ id: 1 }] }));
      await h.send(2, 'end', json({ totalChunks: 3, totalBytes: 0 }));
      await waitFor(() => has(h.events, 'transfer-error'));

      expect(h.received).toHaveLength(0);
    });

    it('rejects more records than announced for a table', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();
      await h.start(manifestFor({ counts: { properties: 1 }, totalChunks: 2 }));

      await h.send(1, 'records', json({ table: 'properties', records: [{ id: 1 }, { id: 2 }] }));
      await waitFor(() => has(h.events, 'transfer-error'));

      expect(h.received).toHaveLength(0);
    });

    it('aborts on a chunk for an unknown document id', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();
      await h.start(manifestFor({ totalChunks: 2, totalBytes: 4 }));

      await h.send(
        1,
        'blob_chunk',
        frameBlobChunk({ table: 'documents', id: 99, index: 0, last: true }, bytes(4))
      );
      await waitFor(() => has(h.events, 'transfer-error'));

      expect(errorReasons(h.events)).toEqual(['corrupted']);
    });

    it('aborts when a document receives more bytes than announced', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();
      await h.start(manifestFor({ counts: { documents: 1 }, totalChunks: 3, totalBytes: 2 }));

      await h.send(
        1,
        'records',
        json({
          table: 'documents',
          records: [{ id: 1, mimeType: 'x', blobRef: { size: 2, chunks: 1 } }],
        })
      );
      await h.send(
        2,
        'blob_chunk',
        frameBlobChunk({ table: 'documents', id: 1, index: 0, last: true }, bytes(5))
      );
      await waitFor(() => has(h.events, 'transfer-error'));

      expect(h.received).toHaveLength(0);
    });

    it('imports the reassembled data after a valid end and acknowledges it', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();
      await h.start(manifestFor({ counts: { documents: 1 }, totalChunks: 4, totalBytes: 6 }));

      await h.send(
        1,
        'records',
        json({
          table: 'documents',
          records: [{ id: 1, mimeType: 'text/plain', blobRef: { size: 6, chunks: 1 } }],
        })
      );
      // The content arrives in one chunk of 6 bytes.
      await h.send(
        2,
        'blob_chunk',
        frameBlobChunk(
          { table: 'documents', id: 1, index: 0, last: true },
          enc('coucou') as Uint8Array<ArrayBuffer>
        )
      );
      await h.send(3, 'records', json({ table: 'rents', records: [] }));
      await h.send(4, 'end', json({ totalChunks: 4, totalBytes: 6 }));
      await waitFor(() => h.received.length === 1);

      const [document] = h.received[0]!.documents as Array<{ data: Blob; blobRef?: unknown }>;
      expect(document!.blobRef).toBeUndefined();
      expect(document!.data.type).toBe('text/plain');
      expect(await document!.data.text()).toBe('coucou');
      expect(h.conn.sentOfType('ack').at(-1)).toEqual({
        type: 'ack',
        transferId: h.transferId,
        seq: 4,
      });
    });

    it('a host abort interrupts the client without importing', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();
      await h.start(manifestFor({ counts: { properties: 1 }, totalChunks: 2 }));

      h.conn.emit('data', { type: 'abort', transferId: h.transferId, reason: 'timeout' });
      await waitFor(() => has(h.events, 'transfer-error'));

      expect(errorReasons(h.events)).toEqual(['timeout']);
      expect(h.conn.sentOfType('abort')).toHaveLength(0); // no echo
      expect(h.peer.destroyed).toBe(true);
    });

    it('a connection close mid-transfer notifies interrupted and drops the staged data', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();
      await h.start(manifestFor({ counts: { properties: 2 }, totalChunks: 3 }));
      await h.send(1, 'records', json({ table: 'properties', records: [{ id: 1 }] }));
      await settle(20);

      h.conn.close();

      expect(errorReasons(h.events)).toEqual(['interrupted']);
      expect(h.received).toHaveLength(0);
      expect(h.peer.destroyed).toBe(true);
    });

    it('times out after 60 s without any message', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      await h.start(manifestFor({ counts: { properties: 1 }, totalChunks: 2 }));

      vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1);
      expect(has(h.events, 'transfer-error')).toBe(false);

      vi.advanceTimersByTime(1);
      expect(errorReasons(h.events)).toEqual(['timeout']);
      expect(h.conn.sentOfType('abort')).toEqual([
        { type: 'abort', transferId: h.transferId, reason: 'timeout' },
      ]);
      expect(h.received).toHaveLength(0);
    });

    it('never times out a long transfer whose messages keep arriving', async () => {
      const h = await clientWithFakeHost();
      await h.authOk();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      await h.start(manifestFor({ counts: { properties: 6 }, totalChunks: 7 }));

      // 6 batches, one every 30 s: 3 minutes in total, well past 60 s.
      for (let seq = 1; seq <= 6; seq++) {
        vi.advanceTimersByTime(30_000);
        await h.send(seq, 'records', json({ table: 'properties', records: [{ id: seq }] }));
      }
      vi.advanceTimersByTime(30_000);
      await h.send(7, 'end', json({ totalChunks: 7, totalBytes: 0 }));
      await waitFor(() => h.received.length === 1);

      expect(has(h.events, 'transfer-error')).toBe(false);
      expect(h.received[0]!.properties).toHaveLength(6);
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
