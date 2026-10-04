import type { Document, TenantDocument } from '@/db/types';

export type SerializedDocument = Omit<Document, 'data'> & { data: string | null };
export type SerializedTenantDocument = Omit<TenantDocument, 'data'> & { data: string | null };

export type ExportDataPayload = {
  properties: unknown[];
  tenants: unknown[];
  leases: unknown[];
  rents: unknown[];
  documents: SerializedDocument[];
  tenantDocuments: SerializedTenantDocument[];
  tenantAudits: unknown[];
  inventories: unknown[];
  communications: unknown[];
  chargesAdjustments: unknown[];
  irlIndices: unknown[];
  rentRevisions: unknown[];
  reminders: unknown[];
  settings: unknown[];
  exportedAt: string;
  version: string;
};

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export function base64ToBlob(b64: string, mime = 'application/octet-stream'): Blob {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function tryParseDataUrl(input: string): { mime: string; b64: string } | null {
  const matches = input.match(/^data:(.+);base64,(.*)$/);
  if (!matches) return null;
  return { mime: matches[1] ?? 'application/octet-stream', b64: matches[2] ?? '' };
}

// Serialize a single record whose `data` field may hold a Blob, into a base64
// data URL. Shared by documents and tenantDocuments (cf. issue #55).
async function serializeBlobRecord(
  record: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const copy: Record<string, unknown> = { ...record };
  try {
    const data = record.data;
    if (data instanceof Blob) {
      const ab = await data.arrayBuffer();
      const b64 = arrayBufferToBase64(ab);
      copy.data = `data:${record.mimeType};base64,${b64}`;
    } else if (typeof data === 'string') {
      copy.data = data;
    } else {
      copy.data = null;
    }
  } catch {
    copy.data = null;
  }
  return copy;
}

function deserializeBlobRecord(record: Record<string, unknown>): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...record };
  try {
    const data = record.data;
    if (data instanceof Blob) {
      // P2P sync (issue #122): the content arrives already reassembled as a
      // Blob — keep it as is (never round-trip it through a string).
      copy.data = data;
      if (data.type) copy.mimeType = data.type;
      copy.size = data.size;
    } else if (typeof data === 'string' && data.startsWith('data:')) {
      const parsed = tryParseDataUrl(data);
      if (parsed) {
        const blob = base64ToBlob(parsed.b64, parsed.mime);
        copy.data = blob;
        copy.mimeType = parsed.mime;
        copy.size = blob.size;
      } else {
        copy.data = null;
      }
    } else {
      copy.data = null;
    }
  } catch {
    copy.data = null;
  }
  return copy;
}

export async function serializeDocuments(
  documentsRaw: Array<Partial<Document> & { data?: unknown }>
): Promise<SerializedDocument[]> {
  return Promise.all(
    documentsRaw.map(d => serializeBlobRecord(d as Record<string, unknown>))
  ) as Promise<SerializedDocument[]>;
}

export function deserializeDocuments(documents: unknown[]): Array<Record<string, unknown>> {
  return documents.map(d => deserializeBlobRecord(d as Record<string, unknown>));
}

export async function serializeTenantDocuments(
  tenantDocumentsRaw: Array<Partial<TenantDocument> & { data?: unknown }>
): Promise<SerializedTenantDocument[]> {
  return Promise.all(
    tenantDocumentsRaw.map(d => serializeBlobRecord(d as Record<string, unknown>))
  ) as Promise<SerializedTenantDocument[]>;
}

export function deserializeTenantDocuments(
  tenantDocuments: unknown[]
): Array<Record<string, unknown>> {
  return tenantDocuments.map(d => deserializeBlobRecord(d as Record<string, unknown>));
}

// ---------------------------------------------------------------------------
// P2P streamed sync source (issue #122)
//
// The P2P channel never builds the whole database as one JSON string: it
// streams the raw tables (documents keep their Blob `data`) in batches and
// chunks. This is the data the host hands to `PeerSyncService.streamTransfer`.
// ---------------------------------------------------------------------------

/** Every business table carried by a P2P sync, in streaming order. */
export const SYNC_TABLES = [
  'properties',
  'tenants',
  'leases',
  'rents',
  'documents',
  'tenantDocuments',
  'tenantAudits',
  'inventories',
  'communications',
  'chargesAdjustments',
  'irlIndices',
  'rentRevisions',
  'reminders',
  'settings',
] as const;

export type SyncTableName = (typeof SYNC_TABLES)[number];

/** Tables whose records may carry binary `data` (a Blob), sent as chunks. */
export const BLOB_TABLES = ['documents', 'tenantDocuments'] as const;

export type BlobTableName = (typeof BLOB_TABLES)[number];

export function isSyncTableName(value: unknown): value is SyncTableName {
  return typeof value === 'string' && (SYNC_TABLES as readonly string[]).includes(value);
}

export function isBlobTableName(value: unknown): value is BlobTableName {
  return typeof value === 'string' && (BLOB_TABLES as readonly string[]).includes(value);
}

export type SyncTables = Record<SyncTableName, unknown[]>;

export interface SyncSource {
  appVersion: string;
  exportedAt: string;
  /** Raw records per table; document `data` is kept as a Blob (no base64). */
  tables: SyncTables;
  /** Record count per table, announced in the manifest. */
  counts: Record<SyncTableName, number>;
  /** Number of document records (documents + tenantDocuments). */
  documents: number;
  /** Sum of the byte sizes of every document Blob. */
  totalBytes: number;
}

/** The Blob held in a record's `data`, or null when it carries no Blob. */
export function recordBlob(record: unknown): Blob | null {
  if (typeof record !== 'object' || record === null || !('data' in record)) return null;
  return record.data instanceof Blob ? record.data : null;
}

/**
 * Build the P2P sync source from the raw tables: no serialization, Blobs kept
 * as they are, plus the manifest counts and the total Blob byte size.
 */
export function createSyncSource(
  tables: SyncTables,
  appVersion: string,
  exportedAt: string = new Date().toISOString()
): SyncSource {
  const counts = Object.fromEntries(
    SYNC_TABLES.map(table => [table, tables[table].length])
  ) as Record<SyncTableName, number>;

  let totalBytes = 0;
  for (const table of BLOB_TABLES) {
    for (const record of tables[table]) {
      totalBytes += recordBlob(record)?.size ?? 0;
    }
  }

  return {
    appVersion,
    exportedAt,
    tables,
    counts,
    documents: counts.documents + counts.tenantDocuments,
    totalBytes,
  };
}
