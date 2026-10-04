import Peer, { type DataConnection } from 'peerjs';
import {
  SYNC_TABLES,
  isBlobTableName,
  isSyncTableName,
  recordBlob,
  type BlobTableName,
  type SyncSource,
  type SyncTableName,
  type SyncTables,
} from './dataTransferService';

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

// ---------------------------------------------------------------------------
// Streamed transfer protocol (issue #122 — see docs/specs/data-transfer.md,
// "P2P large-data transfer (streaming)")
//
// The whole database is never handled as one value. After `auth_ok` the host
// sends, each as its own AES-GCM message under the session key (fresh IV,
// AAD = `${transferId}|${seq}|${kind}`):
//   seq 0       manifest   (counts, total bytes, total chunk count)
//   seq 1..N-1  records    (JSON batches of ≤ RECORDS_BATCH_SIZE records)
//               blob_chunk (≤ CHUNK_BYTES of raw document bytes, Blob.slice())
//   seq N       end        (totals, N = manifest.totalChunks)
// The client consents on the manifest (`ready` / `cancel`), acknowledges what it
// processed (`ack`) so the host keeps at most FLOW_WINDOW_BYTES in flight, and
// imports only after `end` has been checked (all or nothing).
// ---------------------------------------------------------------------------

/** Version of the P2P sync protocol, carried by the `handshake`. */
export const PROTOCOL_VERSION = 2;
/** Maximum plaintext bytes of document content per `blob_chunk`. */
export const CHUNK_BYTES = 64 * 1024;
/** Maximum number of records per `records` batch. */
export const RECORDS_BATCH_SIZE = 500;
/** Maximum unacknowledged bytes the host keeps in flight (≈ 4 MiB). */
export const FLOW_WINDOW_BYTES = 4 * 1024 * 1024;
/** The client acknowledges at least every ACK_EVERY_BYTES bytes… */
export const ACK_EVERY_BYTES = 1024 * 1024;
/** …or every ACK_EVERY_CHUNKS data messages… */
export const ACK_EVERY_CHUNKS = 16;
/** …or when ACK_MAX_INTERVAL_MS elapsed since its last ack (slow links). */
export const ACK_MAX_INTERVAL_MS = 5_000;
/** A transfer is aborted after this long without any incoming message. */
export const INACTIVITY_TIMEOUT_MS = 60_000;
/** Minimum delay between two `transfer-progress` notifications (≈ 4 / s). */
export const PROGRESS_INTERVAL_MS = 250;
/** Safety-net delay when waiting for the send buffers to drain. */
const SEND_BUFFER_POLL_MS = 50;
/** AES-GCM IV length (bytes). */
const IV_BYTES = 12;

export type DataKind = 'manifest' | 'records' | 'blob_chunk' | 'end';
const DATA_KINDS: readonly DataKind[] = ['manifest', 'records', 'blob_chunk', 'end'];

/** Why a transfer stopped, as surfaced to the UI (`transfer-error`). */
export type TransferErrorReason = 'corrupted' | 'interrupted' | 'timeout';
/** Reason carried by an `abort` message (`cancelled`: the host stopped). */
export type AbortReason = TransferErrorReason | 'cancelled';
const ABORT_REASONS: readonly AbortReason[] = ['corrupted', 'interrupted', 'timeout', 'cancelled'];

/**
 * Typed protocol exchanged over the PeerJS data connection.
 *
 * A discriminated union on `type`: narrowing on `msg.type` makes the extra
 * fields type-safe only inside the matching branch. Incoming messages are
 * parsed by `parseSyncMessage`; anything that does not match is ignored.
 *
 * Handshake order: host → `handshake` (random salt + protocol version); client
 * derives the session key then → `auth` (PIN); host verifies the PIN, derives
 * the same key, and replies `auth_ok` / `auth_failed`. The streamed transfer
 * follows (control messages in clear, user data only in encrypted `data`).
 */
export type ControlMessage =
  | { type: 'handshake'; salt: string; protocolVersion: number }
  | { type: 'auth'; pin: string }
  | { type: 'auth_ok' }
  | { type: 'auth_failed' }
  | { type: 'ready'; transferId: string }
  | { type: 'ack'; transferId: string; seq: number }
  | { type: 'cancel'; transferId: string }
  | { type: 'abort'; transferId: string; reason: AbortReason };

/** Encrypted data message: binary on the wire (no base64). */
export type DataMessage = {
  type: 'data';
  transferId: string;
  seq: number;
  kind: DataKind;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: ArrayBuffer;
};

export type SyncMessage = ControlMessage | DataMessage;

/** Decrypted `manifest` payload. */
export interface TransferManifest {
  protocolVersion: number;
  appVersion: string;
  exportedAt: string;
  counts: Record<SyncTableName, number>;
  documents: number;
  totalBytes: number;
  totalChunks: number;
}

/** Decrypted `end` payload. */
export interface TransferEnd {
  totalChunks: number;
  totalBytes: number;
}

/** Header framed in front of the raw bytes of a `blob_chunk`. */
export interface BlobChunkHeader {
  table: BlobTableName;
  id: number;
  index: number;
  last: boolean;
}

/** Reference sent in place of a document's Blob `data` in a record batch. */
interface BlobRef {
  size: number;
  chunks: number;
}

/** Progress info of a `transfer-progress` notification (document bytes). */
export interface TransferProgress {
  transferredBytes: number;
  totalBytes: number;
}

/** Reassembled data handed to `onData`, ready for `importFromObject`. */
export type ReceivedSyncPayload = SyncTables & { version: string; exportedAt: string };

export type TransferOutcome = 'completed' | 'cancelled' | 'failed';

/** Narrows an incoming, untyped connection message to an indexable record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Realm-safe ArrayBuffer check (`instanceof` fails across JS realms). */
function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return (
    value instanceof ArrayBuffer || Object.prototype.toString.call(value) === '[object ArrayBuffer]'
  );
}

/** Normalise binary data received from PeerJS (ArrayBuffer or typed array). */
function toBytes(value: unknown): Uint8Array<ArrayBuffer> | null {
  if (isArrayBuffer(value)) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    if (isArrayBuffer(value.buffer)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    const copy = new Uint8Array(value.byteLength);
    copy.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    return copy;
  }
  return null;
}

/** Incoming `data` message once its binary fields are normalised. */
export type IncomingDataMessage = Omit<DataMessage, 'iv' | 'ciphertext'> & {
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
};

export type IncomingMessage = ControlMessage | IncomingDataMessage;

/**
 * Parse an untrusted connection message into the typed protocol union, or
 * return null when it does not match any known message shape.
 */
export function parseSyncMessage(msg: unknown): IncomingMessage | null {
  if (!isRecord(msg) || typeof msg.type !== 'string') return null;
  const transferId = typeof msg.transferId === 'string' ? msg.transferId : null;

  switch (msg.type) {
    case 'handshake':
      if (typeof msg.salt !== 'string') return null;
      // A handshake without a version comes from a legacy (v1) host.
      return {
        type: 'handshake',
        salt: msg.salt,
        protocolVersion: isCount(msg.protocolVersion) ? msg.protocolVersion : 1,
      };
    case 'auth':
      return typeof msg.pin === 'string' ? { type: 'auth', pin: msg.pin } : null;
    case 'auth_ok':
      return { type: 'auth_ok' };
    case 'auth_failed':
      return { type: 'auth_failed' };
    case 'ready':
      return transferId ? { type: 'ready', transferId } : null;
    case 'cancel':
      return transferId ? { type: 'cancel', transferId } : null;
    case 'ack':
      return transferId && isCount(msg.seq) ? { type: 'ack', transferId, seq: msg.seq } : null;
    case 'abort': {
      if (!transferId) return null;
      const reason = ABORT_REASONS.find(r => r === msg.reason) ?? 'interrupted';
      return { type: 'abort', transferId, reason };
    }
    case 'data': {
      const kind = DATA_KINDS.find(k => k === msg.kind);
      const iv = toBytes(msg.iv);
      const ciphertext = toBytes(msg.ciphertext);
      if (!transferId || !isCount(msg.seq) || !kind || !iv || !ciphertext) return null;
      if (iv.byteLength !== IV_BYTES) return null;
      return { type: 'data', transferId, seq: msg.seq, kind, iv, ciphertext };
    }
    default:
      return null;
  }
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

/** AES-GCM additional authenticated data binding a message to its position. */
function additionalData(transferId: string, seq: number, kind: DataKind) {
  return textToUint8(`${transferId}|${seq}|${kind}`);
}

/**
 * Encrypt one data message: one AES-GCM call, a fresh random 12-byte IV, and
 * AAD = `${transferId}|${seq}|${kind}` so a reordered, replayed or relabelled
 * message fails authentication.
 */
export async function encryptDataMessage(
  key: CryptoKey,
  transferId: string,
  seq: number,
  kind: DataKind,
  plaintext: Uint8Array<ArrayBuffer>
): Promise<DataMessage> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(transferId, seq, kind) },
    key,
    plaintext
  );
  return { type: 'data', transferId, seq, kind, iv, ciphertext };
}

/** Decrypt one data message; rejects when the ciphertext, IV or AAD differ. */
export async function decryptDataMessage(
  key: CryptoKey,
  msg: { transferId: string; seq: number; kind: DataKind; iv: Uint8Array; ciphertext: unknown }
): Promise<Uint8Array<ArrayBuffer>> {
  const iv = toBytes(msg.iv);
  const ciphertext = toBytes(msg.ciphertext);
  if (!iv || !ciphertext) throw new Error('Invalid binary fields');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(msg.transferId, msg.seq, msg.kind) },
    key,
    ciphertext
  );
  return new Uint8Array(plain);
}

const encodeJson = (value: unknown): Uint8Array<ArrayBuffer> => textToUint8(JSON.stringify(value));
const decodeJson = (bytes: Uint8Array<ArrayBuffer>): unknown =>
  JSON.parse(new TextDecoder().decode(bytes));

/** Frame a blob chunk: [uint32 header length][JSON header][raw bytes]. */
export function frameBlobChunk(
  header: BlobChunkHeader,
  bytes: Uint8Array<ArrayBuffer>
): Uint8Array<ArrayBuffer> {
  const head = encodeJson(header);
  const out = new Uint8Array(4 + head.byteLength + bytes.byteLength);
  new DataView(out.buffer).setUint32(0, head.byteLength);
  out.set(head, 4);
  out.set(bytes, 4 + head.byteLength);
  return out;
}

/** Inverse of `frameBlobChunk`; null when the framing or header is invalid. */
export function unframeBlobChunk(
  plain: Uint8Array<ArrayBuffer>
): { header: BlobChunkHeader; bytes: Uint8Array<ArrayBuffer> } | null {
  if (plain.byteLength < 4) return null;
  const headLength = new DataView(plain.buffer, plain.byteOffset, plain.byteLength).getUint32(0);
  if (4 + headLength > plain.byteLength) return null;
  let header: unknown;
  try {
    header = decodeJson(plain.slice(4, 4 + headLength));
  } catch {
    return null;
  }
  if (
    !isRecord(header) ||
    !isBlobTableName(header.table) ||
    typeof header.id !== 'number' ||
    !isCount(header.index) ||
    typeof header.last !== 'boolean'
  ) {
    return null;
  }
  return {
    header: { table: header.table, id: header.id, index: header.index, last: header.last },
    bytes: plain.slice(4 + headLength),
  };
}

/** Number of `blob_chunk` messages for a Blob (a 0-byte Blob = one empty chunk). */
export function chunkCount(size: number): number {
  return Math.max(1, Math.ceil(size / CHUNK_BYTES));
}

function parseManifest(value: unknown): TransferManifest | null {
  if (!isRecord(value) || !isRecord(value.counts)) return null;
  const { protocolVersion, appVersion, exportedAt, documents, totalBytes, totalChunks } = value;
  if (protocolVersion !== PROTOCOL_VERSION) return null;
  if (typeof appVersion !== 'string' || typeof exportedAt !== 'string') return null;
  if (!isCount(documents) || !isCount(totalBytes) || !isCount(totalChunks) || totalChunks < 1) {
    return null;
  }
  const counts = emptyCounts();
  for (const table of SYNC_TABLES) {
    const count = value.counts[table];
    if (!isCount(count)) return null;
    counts[table] = count;
  }
  return { protocolVersion, appVersion, exportedAt, counts, documents, totalBytes, totalChunks };
}

function parseEnd(value: unknown): TransferEnd | null {
  if (!isRecord(value) || !isCount(value.totalChunks) || !isCount(value.totalBytes)) return null;
  return { totalChunks: value.totalChunks, totalBytes: value.totalBytes };
}

function parseBlobRef(value: unknown): BlobRef | null {
  if (!isRecord(value) || !isCount(value.size) || !isCount(value.chunks)) return null;
  if (value.chunks !== chunkCount(value.size)) return null;
  return { size: value.size, chunks: value.chunks };
}

function emptyCounts(): Record<SyncTableName, number> {
  return Object.fromEntries(SYNC_TABLES.map(table => [table, 0])) as Record<SyncTableName, number>;
}

function emptyTables(): SyncTables {
  return {
    properties: [],
    tenants: [],
    leases: [],
    rents: [],
    documents: [],
    tenantDocuments: [],
    tenantAudits: [],
    inventories: [],
    communications: [],
    chargesAdjustments: [],
    irlIndices: [],
    rentRevisions: [],
    reminders: [],
    settings: [],
  };
}

// ---------------------------------------------------------------------------
// Screen Wake Lock (feature-detected; failures never block a transfer)
// ---------------------------------------------------------------------------

/** `WakeLockSentinel` from lib.dom, derived through `Navigator`. */
type WakeLockHandle = Awaited<ReturnType<Navigator['wakeLock']['request']>>;

async function acquireWakeLock(): Promise<WakeLockHandle | null> {
  try {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return null;
    return await navigator.wakeLock.request('screen');
  } catch {
    return null;
  }
}

function releaseWakeLock(sentinel: WakeLockHandle | null): void {
  if (!sentinel) return;
  try {
    void sentinel.release().catch(() => {});
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Transfer state
// ---------------------------------------------------------------------------

interface BlobPlanItem {
  table: BlobTableName;
  id: number;
  blob: Blob;
  chunks: number;
}

interface TransferPlan {
  batches: Array<{ table: SyncTableName; records: unknown[] }>;
  blobs: BlobPlanItem[];
  totalBytes: number;
  totalChunks: number;
}

/**
 * Split the source into record batches and blob chunks. Document records are
 * sent without their Blob: `data` is replaced by a `blobRef` (size, chunk
 * count) or set to null when there is no binary content.
 */
function planTransfer(source: SyncSource): TransferPlan {
  const batches: TransferPlan['batches'] = [];
  const blobs: BlobPlanItem[] = [];

  for (const table of SYNC_TABLES) {
    const wireRecords = source.tables[table].map(record => {
      if (!isBlobTableName(table) || !isRecord(record)) return record;
      const { data, ...rest } = record;
      const blob = recordBlob(record);
      if (blob && typeof rest.id === 'number') {
        const chunks = chunkCount(blob.size);
        blobs.push({ table, id: rest.id, blob, chunks });
        return { ...rest, blobRef: { size: blob.size, chunks } satisfies BlobRef };
      }
      return { ...rest, data: typeof data === 'string' ? data : null };
    });
    for (let i = 0; i < wireRecords.length; i += RECORDS_BATCH_SIZE) {
      batches.push({ table, records: wireRecords.slice(i, i + RECORDS_BATCH_SIZE) });
    }
  }

  const totalBytes = blobs.reduce((sum, item) => sum + item.blob.size, 0);
  const blobChunks = blobs.reduce((sum, item) => sum + item.chunks, 0);
  // seq 0 = manifest, then every batch and chunk; `end` carries seq = totalChunks.
  return { batches, blobs, totalBytes, totalChunks: 1 + batches.length + blobChunks };
}

/** Thrown inside the host stream loop once the transfer has been stopped. */
class TransferStoppedError extends Error {
  constructor() {
    super('Transfer stopped');
    this.name = 'TransferStoppedError';
  }
}

type OutgoingState = 'awaiting-ready' | 'streaming' | 'completed' | 'cancelled' | 'failed';

interface OutgoingTransfer {
  id: string;
  conn: DataConnection;
  key: CryptoKey;
  state: OutgoingState;
  decision: 'ready' | 'cancel' | null;
  nextSeq: number;
  /** Ciphertext bytes sent / acknowledged (flow-control window). */
  sentBytes: number;
  ackedBytes: number;
  /** Cumulative `sentBytes` right after each unacknowledged seq. */
  sentBytesAtSeq: Map<number, number>;
  lastAckedSeq: number;
  /** Sequence number of the `end` message once it is sent (-1 before). */
  endSeq: number;
  /** Document bytes read and sent (progress). */
  transferredBytes: number;
  totalBytes: number;
  lastProgressAt: number;
}

type IncomingState = 'awaiting-consent' | 'receiving' | 'done' | 'cancelled' | 'failed';

interface PendingBlob {
  record: Record<string, unknown>;
  size: number;
  chunks: number;
  mimeType: string;
  parts: ArrayBuffer[];
  received: number;
}

interface IncomingTransfer {
  id: string;
  manifest: TransferManifest;
  state: IncomingState;
  expectedSeq: number;
  tables: SyncTables;
  pendingBlobs: Map<string, PendingBlob>;
  receivedBytes: number;
  bytesSinceAck: number;
  chunksSinceAck: number;
  lastAckAt: number;
  lastProgressAt: number;
  wakeLock: WakeLockHandle | null;
}

const blobKey = (table: BlobTableName, id: number) => `${table}:${id}`;

/**
 * Host session lifecycle (see docs/specs/data-transfer.md — "P2P host session
 * lifecycle"): a client connection closing never ends the hosting session on
 * its own. The host `Peer` keeps listening (`client-disconnected`, or
 * `auth-failed` for a rejected PIN) until one of the terminal statuses:
 * `stopped` (explicit stop), `locked-out` (too many wrong PINs) or
 * `transfer-complete` (the client acknowledged the `end` of a streamed
 * transfer and then disconnected).
 */
export type PeerStatus =
  | 'idle'
  | 'creating'
  | 'hosting'
  | 'client-connected'
  | 'client-disconnected'
  | 'connection-open'
  | 'auth-pending'
  | 'auth-ok'
  | 'auth-failed'
  | 'locked-out'
  | 'connected'
  | 'protocol-mismatch'
  | 'transfer-pending'
  | 'transfer-progress'
  | 'transfer-cancelled'
  | 'transfer-error'
  | 'importing'
  | 'transfer-complete'
  | 'warning'
  | 'error'
  | 'stopped';

export type OnDataCb = (data: ReceivedSyncPayload) => Promise<void> | void;
export type OnStatusCb = (status: PeerStatus, info?: unknown) => void;
/** Client consent on the manifest: resolve true to receive, false to cancel. */
export type OnManifestCb = (manifest: TransferManifest) => Promise<boolean> | boolean;

export class PeerSyncService {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private onData?: OnDataCb;
  private onStatus?: OnStatusCb;
  private onManifest?: OnManifestCb;
  private pairingPin: string = '';
  /** Random salt for the current pairing and the derived AES-GCM session key. */
  private salt: Uint8Array<ArrayBuffer> | null = null;
  private sessionKey: CryptoKey | null = null;
  /** Host-side wrong-PIN counter for brute-force protection. Kept for the whole
   *  hosting session, across successive client connections. */
  private failedPinAttempts = 0;
  /** Host side: the client acknowledged the `end` of a streamed transfer over
   *  the current connection; the session ends once it disconnects. */
  private transferCompleted = false;
  /** Client side: true once the host replied `auth_ok`. */
  private authenticated = false;

  private outgoing: OutgoingTransfer | null = null;
  private incoming: IncomingTransfer | null = null;
  /** Client side: incoming messages are processed strictly one at a time. */
  private rxQueue: Promise<void> = Promise.resolve();
  /** Wakes the host stream loop (ack, ready/cancel, abort, close). */
  private signalWaiters = new Set<() => void>();
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private onInactivity: (() => void) | null = null;

  // Cross-session lockout state: `static` so it survives service
  // re-instantiation and a host cannot immediately re-host after being
  // brute-forced. `lockoutUntil` is the wall-clock time before which hosting is
  // refused; `lockoutCount` drives the exponential back-off.
  private static lockoutUntil = 0;
  private static lockoutCount = 0;

  constructor(onData?: OnDataCb, onStatus?: OnStatusCb, onManifest?: OnManifestCb) {
    this.onData = onData;
    this.onStatus = onStatus;
    this.onManifest = onManifest;
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

  /**
   * Close the connection and destroy the peer. The fields are cleared first so
   * the `close` events this triggers (emitted synchronously by PeerJS) are
   * recognised as part of the teardown and not reported as a client leaving.
   */
  private releasePeer() {
    const { conn, peer } = this;
    this.conn = null;
    this.peer = null;
    if (conn) {
      try {
        conn.close();
      } catch (e) {
        console.warn('conn.close failed', e);
      }
    }
    if (peer) {
      try {
        peer.destroy();
      } catch (e) {
        console.warn('peer.destroy failed', e);
      }
    }
  }

  private engageLockout() {
    const backoff = LOCKOUT_BASE_MS * 2 ** PeerSyncService.lockoutCount;
    PeerSyncService.lockoutCount += 1;
    PeerSyncService.lockoutUntil = Date.now() + backoff;
    const attempts = this.failedPinAttempts;
    this.releasePeer();
    this.resetPairingState();
    this.notify('locked-out', { attempts, retryAfterMs: backoff });
  }

  /** Forget the key material of a client connection that is gone. */
  private resetConnectionState() {
    this.salt = null;
    this.sessionKey = null;
    this.transferCompleted = false;
  }

  /**
   * A client connection closed while the host peer is still listening. The
   * hosting session only ends if a streamed transfer was completed over it
   * (the client acknowledged `end`); otherwise (client left before or without
   * a transfer, transfer refused, cancelled or interrupted) the session ID, PIN
   * and failed-attempt counter stay valid for a new connection.
   */
  private handleClientClosed(c: DataConnection) {
    // Not the current connection: rejected by the host or already released.
    if (this.conn !== c) return;
    this.conn = null;

    if (this.transferCompleted) {
      this.releasePeer();
      this.resetPairingState();
      this.notify('transfer-complete');
      return;
    }
    // A transfer still in flight over this connection is interrupted; the
    // hosting session stays open for a new attempt.
    const t = this.outgoing;
    if (t && t.conn === c) this.stopOutgoing(t, 'interrupted', { sendAbort: false });
    this.resetConnectionState();
    this.notify('client-disconnected');
  }

  // -------------------------------------------------------------------------
  // Inactivity timer (both sides, only while a transfer is streaming)
  // -------------------------------------------------------------------------

  private armInactivity(onTimeout: () => void) {
    this.onInactivity = onTimeout;
    this.touchInactivity();
  }

  /** Reset the inactivity timer (called on every incoming message). */
  private touchInactivity() {
    if (!this.onInactivity) return;
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    const handler = this.onInactivity;
    this.inactivityTimer = setTimeout(() => {
      this.inactivityTimer = null;
      this.onInactivity = null;
      handler();
    }, INACTIVITY_TIMEOUT_MS);
  }

  private clearInactivity() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = null;
    this.onInactivity = null;
  }

  // -------------------------------------------------------------------------
  // Host
  // -------------------------------------------------------------------------

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
        c.send({
          type: 'handshake',
          salt: uint8ToBase64(this.salt),
          protocolVersion: PROTOCOL_VERSION,
        } satisfies SyncMessage);
        this.notify('auth-pending');
      });

      c.on('data', (msg: unknown) => {
        this.touchInactivity();
        void this.handleHostData(c, msg);
      });

      c.on('close', () => {
        this.handleClientClosed(c);
      });

      c.on('error', (err: Error) => {
        const t = this.outgoing;
        if (t && t.conn === c) {
          // A network loss (PeerJS emits 'error' then 'close'): the transfer
          // outcome is the status shown, not a generic error over it.
          this.stopOutgoing(t, 'interrupted', { sendAbort: false });
          console.warn('P2P connection error during transfer', err);
          return;
        }
        this.notify('error', err);
      });
    });

    this.peer.on('error', (err: Error) => {
      this.notify('error', err);
    });
  }

  private async handleHostData(conn: DataConnection, raw: unknown) {
    // Messages from a connection that is no longer the current one are ignored.
    if (conn !== this.conn) return;
    const msg = parseSyncMessage(raw);
    if (!msg) return;

    if (msg.type === 'auth') {
      await this.handleHostAuth(conn, msg.pin);
      return;
    }

    // Transfer control messages: only from the authenticated client, only for
    // the current transfer.
    const t = this.outgoing;
    if (!t || t.conn !== conn || !this.sessionKey) return;
    if (
      (msg.type === 'ready' ||
        msg.type === 'cancel' ||
        msg.type === 'ack' ||
        msg.type === 'abort') &&
      msg.transferId !== t.id
    ) {
      return;
    }

    switch (msg.type) {
      case 'ready':
        if (t.decision !== null) return; // a second `ready` is ignored
        t.decision = 'ready';
        this.acknowledge(t, 0); // `ready` acknowledges the manifest (seq 0)
        this.signal();
        break;
      case 'cancel':
        if (t.decision !== null) return;
        // Terminal right away: the client usually closes the connection just
        // after `cancel`, which must not be reported as an interruption.
        t.decision = 'cancel';
        t.state = 'cancelled';
        this.notify('transfer-cancelled');
        this.signal();
        break;
      case 'ack':
        this.acknowledge(t, msg.seq);
        break;
      case 'abort':
        this.stopOutgoing(t, msg.reason === 'cancelled' ? 'interrupted' : msg.reason, {
          sendAbort: false,
        });
        break;
      default:
        break;
    }
  }

  private async handleHostAuth(conn: DataConnection, pin: string) {
    if (pin === this.pairingPin && this.salt) {
      // Correct PIN → derive the shared session key and confirm.
      const sessionKey = await deriveSessionKey(this.pairingPin, this.salt);
      // The client left (or the session ended) during the derivation: this key
      // must not be used for whichever connection comes next.
      if (conn !== this.conn) return;
      this.sessionKey = sessionKey;
      conn.send({ type: 'auth_ok' } satisfies SyncMessage);
      this.notify('auth-ok');
      return;
    }

    // Wrong PIN → count the failure and reject. The session stays open for a
    // new connection until the lockout threshold is reached.
    this.failedPinAttempts += 1;
    conn.send({ type: 'auth_failed' } satisfies SyncMessage);
    this.notify('auth-failed', { attempts: this.failedPinAttempts });

    if (this.failedPinAttempts >= MAX_PIN_ATTEMPTS) {
      this.engageLockout();
      return;
    }
    // Detach before closing: `auth-failed` already reports this disconnection.
    this.conn = null;
    this.resetConnectionState();
    try {
      conn.close();
    } catch {
      // ignore
    }
  }

  /** Cumulative acknowledgement of every data message up to `seq`. */
  private acknowledge(t: OutgoingTransfer, seq: number) {
    if (seq <= t.lastAckedSeq || seq >= t.nextSeq) return; // duplicate or bogus ack
    t.lastAckedSeq = seq;
    t.ackedBytes = t.sentBytesAtSeq.get(seq) ?? t.ackedBytes;
    // `end` acknowledged: the stream is complete over this connection.
    if (t.endSeq >= 0 && seq >= t.endSeq && t.conn === this.conn) this.transferCompleted = true;
    for (const s of t.sentBytesAtSeq.keys()) {
      if (s > seq) break;
      t.sentBytesAtSeq.delete(s);
    }
    this.signal();
  }

  private signal() {
    const waiters = [...this.signalWaiters];
    this.signalWaiters.clear();
    waiters.forEach(wake => wake());
  }

  /**
   * Wait for the next signal (ack, decision, abort, close), or for the data
   * channel's `bufferedamountlow` event, or for `timeoutMs` — never a busy loop.
   */
  private nextSignal(options: { timeoutMs?: number; channel?: RTCDataChannel } = {}) {
    return new Promise<void>(resolve => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const { channel } = options;
      const wake = () => {
        this.signalWaiters.delete(wake);
        if (timer) clearTimeout(timer);
        channel?.removeEventListener('bufferedamountlow', wake);
        resolve();
      };
      this.signalWaiters.add(wake);
      if (options.timeoutMs !== undefined) timer = setTimeout(wake, options.timeoutMs);
      if (channel) {
        channel.bufferedAmountLowThreshold = FLOW_WINDOW_BYTES / 2;
        channel.addEventListener('bufferedamountlow', wake);
      }
    });
  }

  private assertActive(t: OutgoingTransfer) {
    if (t.state !== 'awaiting-ready' && t.state !== 'streaming') throw new TransferStoppedError();
    if (t.conn.open === false) {
      this.stopOutgoing(t, 'interrupted', { sendAbort: false });
      throw new TransferStoppedError();
    }
  }

  /** Flow control: bounded unacknowledged window + send-buffer back-pressure. */
  private async waitForCapacity(t: OutgoingTransfer, nextBytes: number) {
    for (;;) {
      this.assertActive(t);
      const unacked = t.sentBytes - t.ackedBytes;
      if (unacked > 0 && unacked + nextBytes > FLOW_WINDOW_BYTES) {
        await this.nextSignal();
        continue;
      }
      const channel: RTCDataChannel | undefined = t.conn.dataChannel;
      if (channel && channel.bufferedAmount > FLOW_WINDOW_BYTES) {
        await this.nextSignal({ channel, timeoutMs: SEND_BUFFER_POLL_MS });
        continue;
      }
      // PeerJS keeps its own queue (in messages) once the channel is saturated.
      const conn = t.conn;
      if ('bufferSize' in conn && typeof conn.bufferSize === 'number' && conn.bufferSize > 0) {
        await this.nextSignal({ timeoutMs: SEND_BUFFER_POLL_MS });
        continue;
      }
      return;
    }
  }

  private async sendData(t: OutgoingTransfer, kind: DataKind, plaintext: Uint8Array<ArrayBuffer>) {
    await this.waitForCapacity(t, plaintext.byteLength);
    const seq = t.nextSeq++;
    const msg = await encryptDataMessage(t.key, t.id, seq, kind, plaintext);
    this.assertActive(t);
    t.conn.send(msg);
    t.sentBytes += msg.ciphertext.byteLength;
    t.sentBytesAtSeq.set(seq, t.sentBytes);
  }

  private emitProgress(progress: TransferProgress) {
    this.notify('transfer-progress', {
      transferredBytes: progress.transferredBytes,
      totalBytes: progress.totalBytes,
    } satisfies TransferProgress);
  }

  private maybeEmitOutgoingProgress(t: OutgoingTransfer, force = false) {
    const now = Date.now();
    if (!force && now - t.lastProgressAt < PROGRESS_INTERVAL_MS) return;
    t.lastProgressAt = now;
    this.emitProgress(t);
  }

  /**
   * Stop the current outgoing transfer: optionally tell the client (`abort`),
   * notify `transfer-error` (except for a host-initiated cancel) and wake the
   * stream loop so it exits.
   */
  private stopOutgoing(t: OutgoingTransfer, reason: AbortReason, options: { sendAbort: boolean }) {
    if (t.state !== 'awaiting-ready' && t.state !== 'streaming') return;
    t.state = reason === 'cancelled' ? 'cancelled' : 'failed';
    this.clearInactivity();
    if (options.sendAbort) {
      try {
        t.conn.send({ type: 'abort', transferId: t.id, reason } satisfies SyncMessage);
      } catch {
        // ignore — the connection may already be gone
      }
    }
    if (reason !== 'cancelled') this.notify('transfer-error', { reason });
    this.signal();
  }

  /**
   * Host: stream the database to the authenticated client (issue #122).
   *
   * Sends the encrypted manifest, waits for the client's consent (`ready` /
   * `cancel`), then the record batches, every document Blob in chunks of at
   * most CHUNK_BYTES read with `Blob.slice()`, and `end`; resolves once the
   * client acknowledged `end`. Never builds the whole database as one value.
   */
  async streamTransfer(source: SyncSource): Promise<TransferOutcome> {
    const conn = this.conn;
    if (!conn || conn.open === false) {
      throw new Error('No open connection to send data');
    }
    const key = this.sessionKey;
    if (!key) {
      throw new Error('No session key established');
    }
    if (this.outgoing) {
      throw new Error('A transfer is already in progress');
    }

    const plan = planTransfer(source);
    const t: OutgoingTransfer = {
      id: crypto.randomUUID(),
      conn,
      key,
      state: 'awaiting-ready',
      decision: null,
      nextSeq: 0,
      sentBytes: 0,
      ackedBytes: 0,
      sentBytesAtSeq: new Map(),
      lastAckedSeq: -1,
      endSeq: -1,
      transferredBytes: 0,
      totalBytes: plan.totalBytes,
      lastProgressAt: 0,
    };
    this.outgoing = t;
    // Taken once the client replied `ready`, not while its consent is pending.
    let wakeLock: WakeLockHandle | null = null;

    try {
      const manifest: TransferManifest = {
        protocolVersion: PROTOCOL_VERSION,
        appVersion: source.appVersion,
        exportedAt: source.exportedAt,
        counts: { ...source.counts },
        documents: source.documents,
        totalBytes: plan.totalBytes,
        totalChunks: plan.totalChunks,
      };
      await this.sendData(t, 'manifest', encodeJson(manifest));
      this.notify('transfer-pending', { totalBytes: plan.totalBytes });

      // Nothing else is sent before the client's consent; a `cancel` makes the
      // transfer terminal, so assertActive() exits the loop with 'cancelled'.
      while (t.decision === null) {
        this.assertActive(t);
        await this.nextSignal();
      }
      this.assertActive(t);

      wakeLock = await acquireWakeLock();
      this.assertActive(t);
      t.state = 'streaming';
      this.armInactivity(() => {
        this.stopOutgoing(t, 'timeout', { sendAbort: true });
        this.closeConnection(t.conn);
      });
      this.maybeEmitOutgoingProgress(t, true);

      for (const batch of plan.batches) {
        await this.sendData(t, 'records', encodeJson(batch));
      }

      for (const item of plan.blobs) {
        for (let index = 0; index < item.chunks; index++) {
          const start = index * CHUNK_BYTES;
          const slice = item.blob.slice(start, Math.min(start + CHUNK_BYTES, item.blob.size));
          const bytes = new Uint8Array(await slice.arrayBuffer());
          const header: BlobChunkHeader = {
            table: item.table,
            id: item.id,
            index,
            last: index === item.chunks - 1,
          };
          await this.sendData(t, 'blob_chunk', frameBlobChunk(header, bytes));
          t.transferredBytes += bytes.byteLength;
          this.maybeEmitOutgoingProgress(t);
        }
      }

      const endSeq = t.nextSeq;
      t.endSeq = endSeq;
      const end: TransferEnd = { totalChunks: endSeq, totalBytes: t.transferredBytes };
      await this.sendData(t, 'end', encodeJson(end));

      // The transfer is complete once the client has acknowledged `end`
      // (`acknowledge` then marks the connection as `transferCompleted`). The
      // hosting session itself ends when the client disconnects, see
      // handleClientClosed (`transfer-complete`).
      while (t.lastAckedSeq < endSeq) {
        this.assertActive(t);
        await this.nextSignal();
      }

      t.state = 'completed';
      this.clearInactivity();
      // Unless the session already ended (client gone right after its ack).
      if (this.conn === t.conn) this.maybeEmitOutgoingProgress(t, true);
      return 'completed';
    } catch (e) {
      if (e instanceof TransferStoppedError) {
        return t.state === 'cancelled' ? 'cancelled' : 'failed';
      }
      // Unexpected failure (Blob read, encryption…): stop and tell the client.
      console.error('P2P transfer failed', e);
      this.stopOutgoing(t, 'interrupted', { sendAbort: true });
      return 'failed';
    } finally {
      if (this.outgoing === t) this.outgoing = null;
      this.clearInactivity();
      releaseWakeLock(wakeLock);
    }
  }

  stopHosting() {
    this.teardown();
    this.notify('stopped');
  }

  /**
   * End the local role (host or client): stop any transfer in flight (the host
   * tells the client with `abort`; a client drops everything it staged), then
   * release the connection and the peer and forget the pairing material.
   */
  private teardown() {
    const out = this.outgoing;
    // Host clicked "Arrêter" (or left) mid-transfer: tell the client first.
    if (out) this.stopOutgoing(out, 'cancelled', { sendAbort: true });
    const inc = this.incoming;
    if (inc) {
      // Leaving mid-transfer: drop everything staged (nothing was imported).
      this.incoming = null;
      inc.state = 'failed';
      inc.pendingBlobs.clear();
      releaseWakeLock(inc.wakeLock);
      inc.wakeLock = null;
    }
    this.clearInactivity();
    this.releasePeer();
    this.resetPairingState();
  }

  private closeConnection(conn: DataConnection) {
    try {
      conn.close();
    } catch (e) {
      console.warn('conn.close failed', e);
    }
  }

  // -------------------------------------------------------------------------
  // Client
  // -------------------------------------------------------------------------

  async connect(hostId: string, pin: string) {
    this.releasePeer();
    this.pairingPin = pin;
    this.authenticated = false;

    // Ephemeral, non-guessable client peer id (never reused across pairings).
    const ephemeralId = `peer-${crypto.randomUUID()}`;
    this.peer = new Peer(ephemeralId, { debug: this.debugLevel });

    this.peer.on('open', (id: string) => {
      this.notify('connected', id);
      // `reliable: true` → an ORDERED data channel (PeerJS defaults to
      // `ordered: false`). The streamed protocol relies on arrival order: the
      // strict sequence check aborts on any reordered message.
      const conn = this.peer!.connect(hostId, { reliable: true });
      this.conn = conn;

      conn.on('open', () => {
        this.notify('connection-open');
        this.notify('auth-pending');
        // Wait for the host handshake (salt) before sending the PIN.
      });

      conn.on('data', (data: unknown) => {
        this.touchInactivity();
        // Strictly sequential processing: the sequence check and the
        // reassembly rely on the arrival order.
        this.rxQueue = this.rxQueue
          .then(() => this.handleClientData(conn, data))
          .catch(e => console.error('P2P receive queue failed', e));
      });

      conn.on('close', () => {
        if (this.conn !== conn) return; // closed by this service
        this.conn = null;
        if (this.incoming) {
          this.failIncoming('interrupted', { sendAbort: false });
        } else {
          this.disconnect();
        }
      });

      conn.on('error', (err: Error) => {
        if (this.incoming && this.conn === conn) {
          // Same as the host: keep "interrupted" as the displayed outcome.
          this.failIncoming('interrupted', { sendAbort: false });
          console.warn('P2P connection error during transfer', err);
          return;
        }
        this.notify('error', err);
      });
    });

    this.peer.on('error', (err: Error) => {
      this.notify('error', err);
    });
  }

  private async handleClientData(conn: DataConnection, raw: unknown) {
    const msg = parseSyncMessage(raw);
    if (!msg) return;

    try {
      switch (msg.type) {
        case 'handshake':
          if (msg.protocolVersion !== PROTOCOL_VERSION) {
            // Incompatible host: never send the PIN.
            this.notify('protocol-mismatch', {
              local: PROTOCOL_VERSION,
              remote: msg.protocolVersion,
            });
            this.disconnect();
            return;
          }
          // Derive the session key from PIN + host salt, then authenticate.
          this.salt = base64ToUint8(msg.salt);
          this.sessionKey = await deriveSessionKey(this.pairingPin, this.salt);
          conn.send({ type: 'auth', pin: this.pairingPin } satisfies SyncMessage);
          break;
        case 'auth_ok':
          this.authenticated = true;
          this.notify('auth-ok');
          break;
        case 'auth_failed':
          this.notify('auth-failed');
          this.disconnect();
          break;
        case 'abort':
          if (this.incoming && msg.transferId === this.incoming.id) {
            this.failIncoming(msg.reason === 'timeout' ? 'timeout' : 'interrupted', {
              sendAbort: false,
            });
          }
          break;
        case 'data':
          // Data before authentication is ignored and never touches anything.
          if (!this.authenticated || !this.sessionKey) return;
          await this.handleIncomingData(conn, msg, this.sessionKey);
          break;
        default:
          break;
      }
    } catch (e) {
      console.error('Failed to process incoming P2P data', e);
      this.notify('error', e);
    }
  }

  private sendControl(conn: DataConnection, msg: ControlMessage) {
    try {
      conn.send(msg);
    } catch (e) {
      console.warn('Failed to send P2P control message', e);
    }
  }

  private sendAck(conn: DataConnection, t: IncomingTransfer, seq: number) {
    this.sendControl(conn, { type: 'ack', transferId: t.id, seq });
    t.bytesSinceAck = 0;
    t.chunksSinceAck = 0;
    t.lastAckAt = Date.now();
  }

  private maybeEmitIncomingProgress(t: IncomingTransfer, force = false) {
    const now = Date.now();
    if (!force && now - t.lastProgressAt < PROGRESS_INTERVAL_MS) return;
    t.lastProgressAt = now;
    this.emitProgress({ transferredBytes: t.receivedBytes, totalBytes: t.manifest.totalBytes });
  }

  /**
   * Client: abort the incoming transfer. Everything received is dropped (the
   * local database was never touched), the host is told (`abort`) and the
   * connection is closed.
   */
  private failIncoming(
    reason: TransferErrorReason,
    options: { sendAbort: boolean; detail?: string }
  ) {
    const t = this.incoming;
    if (!t) return;
    console.warn(`P2P transfer aborted (${reason})${options.detail ? `: ${options.detail}` : ''}`);
    this.incoming = null;
    t.state = 'failed';
    t.tables = emptyTables();
    t.pendingBlobs.clear();
    this.clearInactivity();
    releaseWakeLock(t.wakeLock);
    t.wakeLock = null;
    if (options.sendAbort && this.conn) {
      this.sendControl(this.conn, { type: 'abort', transferId: t.id, reason });
    }
    this.notify('transfer-error', { reason });
    this.disconnect();
  }

  /** Abort a stream whose manifest could not even be accepted. */
  private rejectStream(conn: DataConnection, transferId: string) {
    this.sendControl(conn, { type: 'abort', transferId, reason: 'corrupted' });
    this.notify('transfer-error', { reason: 'corrupted' satisfies TransferErrorReason });
    this.disconnect();
  }

  private async handleIncomingData(conn: DataConnection, msg: IncomingDataMessage, key: CryptoKey) {
    const current = this.incoming;
    if (!current) {
      await this.handleManifest(conn, msg, key);
      return;
    }
    const t = current;

    // Strict sequence: same transfer, after consent, exactly the next seq.
    if (msg.transferId !== t.id || t.state !== 'receiving' || msg.seq !== t.expectedSeq) {
      this.failIncoming('corrupted', {
        sendAbort: true,
        detail: `unexpected ${msg.kind} seq ${msg.seq} (expected ${t.expectedSeq}, ${t.state})`,
      });
      return;
    }
    t.expectedSeq += 1;

    let plain: Uint8Array<ArrayBuffer>;
    try {
      plain = await decryptDataMessage(key, msg);
    } catch {
      this.failIncoming('corrupted', {
        sendAbort: true,
        detail: `authentication failed for ${msg.kind} seq ${msg.seq}`,
      });
      return;
    }
    if (this.incoming !== t) return; // aborted while decrypting

    const accepted =
      msg.kind === 'records'
        ? this.acceptRecords(t, plain)
        : msg.kind === 'blob_chunk'
          ? this.acceptBlobChunk(t, plain)
          : msg.kind === 'end'
            ? this.acceptEnd(t, msg.seq, plain)
            : false; // a second manifest
    if (!accepted) {
      this.failIncoming('corrupted', {
        sendAbort: true,
        detail: `invalid ${msg.kind} seq ${msg.seq}`,
      });
      return;
    }

    if (msg.kind === 'end') {
      this.sendAck(conn, t, msg.seq);
      t.state = 'done';
      this.incoming = null;
      this.clearInactivity();
      this.maybeEmitIncomingProgress(t, true);
      releaseWakeLock(t.wakeLock);
      t.wakeLock = null;
      const payload: ReceivedSyncPayload = {
        ...t.tables,
        version: t.manifest.appVersion,
        exportedAt: t.manifest.exportedAt,
      };
      this.notify('importing');
      await this.onData?.(payload);
      return;
    }

    t.bytesSinceAck += plain.byteLength;
    t.chunksSinceAck += 1;
    if (
      t.bytesSinceAck >= ACK_EVERY_BYTES ||
      t.chunksSinceAck >= ACK_EVERY_CHUNKS ||
      Date.now() - t.lastAckAt >= ACK_MAX_INTERVAL_MS
    ) {
      this.sendAck(conn, t, msg.seq);
    }
    this.maybeEmitIncomingProgress(t);
  }

  private async handleManifest(conn: DataConnection, msg: IncomingDataMessage, key: CryptoKey) {
    if (msg.kind !== 'manifest' || msg.seq !== 0) {
      this.rejectStream(conn, msg.transferId);
      return;
    }
    let manifest: TransferManifest | null = null;
    try {
      manifest = parseManifest(decodeJson(await decryptDataMessage(key, msg)));
    } catch {
      manifest = null;
    }
    if (!manifest) {
      this.rejectStream(conn, msg.transferId);
      return;
    }

    const t: IncomingTransfer = {
      id: msg.transferId,
      manifest,
      state: 'awaiting-consent',
      expectedSeq: 1,
      tables: emptyTables(),
      pendingBlobs: new Map(),
      receivedBytes: 0,
      bytesSinceAck: 0,
      chunksSinceAck: 0,
      lastAckAt: Date.now(),
      lastProgressAt: 0,
      wakeLock: null,
    };
    this.incoming = t;

    let consent = false;
    try {
      consent = (await this.onManifest?.(manifest)) === true;
    } catch (e) {
      console.error('onManifest callback failed', e);
      consent = false;
    }
    // The connection may have closed while the user was deciding.
    if (this.incoming !== t || t.state !== 'awaiting-consent') return;

    if (!consent) {
      t.state = 'cancelled';
      this.incoming = null;
      this.sendControl(conn, { type: 'cancel', transferId: t.id });
      this.notify('transfer-cancelled');
      this.disconnect();
      return;
    }

    t.state = 'receiving';
    t.wakeLock = await acquireWakeLock();
    if (this.incoming !== t) {
      releaseWakeLock(t.wakeLock);
      return;
    }
    this.armInactivity(() => this.failIncoming('timeout', { sendAbort: true }));
    t.lastAckAt = Date.now();
    this.sendControl(conn, { type: 'ready', transferId: t.id });
    this.maybeEmitIncomingProgress(t, true);
  }

  private acceptRecords(t: IncomingTransfer, plain: Uint8Array<ArrayBuffer>): boolean {
    let batch: unknown;
    try {
      batch = decodeJson(plain);
    } catch {
      return false;
    }
    if (!isRecord(batch) || !isSyncTableName(batch.table) || !Array.isArray(batch.records)) {
      return false;
    }
    const table = batch.table;
    const staged = t.tables[table];
    if (staged.length + batch.records.length > t.manifest.counts[table]) return false;

    for (const record of batch.records) {
      if (isBlobTableName(table) && isRecord(record) && 'blobRef' in record) {
        const { blobRef, ...rest } = record;
        const ref = parseBlobRef(blobRef);
        if (!ref || typeof rest.id !== 'number') return false;
        const key = blobKey(table, rest.id);
        if (t.pendingBlobs.has(key)) return false;
        t.pendingBlobs.set(key, {
          record: rest,
          size: ref.size,
          chunks: ref.chunks,
          mimeType: typeof rest.mimeType === 'string' ? rest.mimeType : '',
          parts: [],
          received: 0,
        });
        staged.push(rest);
      } else {
        staged.push(record);
      }
    }
    return true;
  }

  private acceptBlobChunk(t: IncomingTransfer, plain: Uint8Array<ArrayBuffer>): boolean {
    const chunk = unframeBlobChunk(plain);
    if (!chunk) return false;
    const { header, bytes } = chunk;
    const key = blobKey(header.table, header.id);
    const pending = t.pendingBlobs.get(key);
    if (!pending) return false; // chunk for an unknown document
    if (header.index !== pending.parts.length) return false;
    if (header.last !== (header.index === pending.chunks - 1)) return false;
    if (bytes.byteLength > CHUNK_BYTES) return false;

    pending.parts.push(bytes.buffer);
    pending.received += bytes.byteLength;
    t.receivedBytes += bytes.byteLength;
    if (pending.received > pending.size) return false;

    if (header.last) {
      if (pending.received !== pending.size) return false;
      // Never converted to a string: the browser manages the Blob storage.
      pending.record.data = new Blob(pending.parts, { type: pending.mimeType });
      t.pendingBlobs.delete(key);
    }
    return true;
  }

  private acceptEnd(t: IncomingTransfer, seq: number, plain: Uint8Array<ArrayBuffer>): boolean {
    let end: TransferEnd | null;
    try {
      end = parseEnd(decodeJson(plain));
    } catch {
      return false;
    }
    const { manifest } = t;
    if (!end) return false;
    if (seq !== manifest.totalChunks || end.totalChunks !== manifest.totalChunks) return false;
    if (end.totalBytes !== manifest.totalBytes || t.receivedBytes !== manifest.totalBytes) {
      return false;
    }
    if (t.pendingBlobs.size > 0) return false;
    return SYNC_TABLES.every(table => t.tables[table].length === manifest.counts[table]);
  }

  disconnect() {
    this.teardown();
    this.notify('stopped');
  }

  private resetPairingState() {
    this.pairingPin = '';
    this.failedPinAttempts = 0;
    this.authenticated = false;
    this.resetConnectionState();
  }
}

export default PeerSyncService;
