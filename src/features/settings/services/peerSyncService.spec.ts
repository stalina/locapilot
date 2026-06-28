import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PeerSyncService } from './peerSyncService';
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
    sentData: unknown[] = [];
    closed = false;
    open = true;

    on(evt: string, fn: (...a: any[]) => void) {
      (this.handlers[evt] ??= []).push(fn);
    }
    send(d: unknown) {
      this.sentData.push(d);
    }
    close() {
      this.closed = true;
      this.emit('close');
    }
    emit(evt: string, ...args: unknown[]) {
      (this.handlers[evt] ?? []).forEach(fn => fn(...args));
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

// ---------------------------------------------------------------------------

describe('PeerSyncService', () => {
  beforeEach(() => {
    mocks.reset();
    vi.clearAllMocks();
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

    it('accepts the correct PIN and notifies auth-ok', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.startHosting('host-peer', '654321');
      mocks.last()!.emit('open', 'host-peer');

      const incomingConn = new mocks.MockDataConn();
      mocks.last()!.emit('connection', incomingConn);
      expect(statuses).toContain('client-connected');

      incomingConn.emit('open');
      expect(statuses).toContain('connection-open');
      expect(statuses).toContain('auth-pending');

      incomingConn.emit('data', { type: 'auth', pin: '654321' });

      expect(incomingConn.sentData).toContainEqual({ type: 'auth_ok' });
      expect(statuses).toContain('auth-ok');
      expect(incomingConn.closed).toBe(false);
    });

    it('rejects a wrong PIN: sends auth_failed and closes the connection', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.startHosting('host-peer', '111111');
      mocks.last()!.emit('open', 'host-peer');

      const incomingConn = new mocks.MockDataConn();
      mocks.last()!.emit('connection', incomingConn);
      incomingConn.emit('open');

      incomingConn.emit('data', { type: 'auth', pin: '999999' });

      expect(incomingConn.sentData).toContainEqual({ type: 'auth_failed' });
      expect(statuses).toContain('auth-failed');
      expect(incomingConn.closed).toBe(true);
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
  describe('connect', () => {
    it('sends the auth message immediately after the connection channel opens', async () => {
      const statuses: PeerStatus[] = [];
      const svc = new PeerSyncService(undefined, s => statuses.push(s));

      await svc.connect('remote-host', '555555');
      mocks.last()!.emit('open', 'ephemeral-id');

      const conn = mocks.last()!.latestConn!;
      conn.emit('open');

      expect(statuses).toContain('connection-open');
      expect(statuses).toContain('auth-pending');
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

      expect(statuses).toContain('auth-failed');
      expect(peer.destroyed).toBe(true);
    });

    it('passes through non-protocol messages to onData', async () => {
      const received: unknown[] = [];
      const svc = new PeerSyncService(async d => received.push(d), undefined);

      await svc.connect('remote-host', '555555');
      mocks.last()!.emit('open', 'ephemeral-id');
      const conn = mocks.last()!.latestConn!;
      conn.emit('open');

      conn.emit('data', { type: 'ping' });
      // Allow the microtask queue to flush
      await Promise.resolve();

      expect(received).toContainEqual({ type: 'ping' });
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
