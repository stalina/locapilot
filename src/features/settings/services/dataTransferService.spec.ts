import { describe, expect, it } from 'vitest';
import type { Document } from '@/db/types';
import {
  arrayBufferToBase64,
  base64ToBlob,
  createSyncSource,
  deserializeDocuments,
  deserializeTenantDocuments,
  isBlobTableName,
  isSyncTableName,
  recordBlob,
  serializeDocuments,
  SYNC_TABLES,
  tryParseDataUrl,
  type SyncTables,
} from '@/features/settings/services/dataTransferService';

describe('dataTransferService', () => {
  it('arrayBufferToBase64/base64ToBlob round-trip preserves bytes', async () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253, 254, 255]);
    const b64 = arrayBufferToBase64(bytes.buffer);
    const blob = base64ToBlob(b64, 'application/octet-stream');
    const out = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(out)).toEqual(Array.from(bytes));
  });

  it('tryParseDataUrl parses data URL', () => {
    const parsed = tryParseDataUrl('data:text/plain;base64,SGVsbG8=');
    expect(parsed).toEqual({ mime: 'text/plain', b64: 'SGVsbG8=' });
  });

  it('serializeDocuments converts Blob to data URL and deserializeDocuments rebuilds Blob', async () => {
    const blob = new Blob([new Uint8Array([72, 105])], { type: 'text/plain' });

    const docs: Document[] = [
      {
        id: 1,
        name: 'test.txt',
        type: 'other',
        mimeType: 'text/plain',
        size: blob.size,
        data: blob,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
    ];

    const serialized = await serializeDocuments(docs);
    expect(serialized[0]?.data).toMatch(/^data:text\/plain;base64,/);

    const rebuilt = deserializeDocuments(serialized);
    const rebuiltBlob = rebuilt[0]?.data;
    if (!(rebuiltBlob instanceof Blob)) throw new Error('expected the data URL to become a Blob');
    expect(rebuiltBlob.type).toBe('text/plain');
    expect(new TextDecoder().decode(await rebuiltBlob.arrayBuffer())).toBe('Hi');
  });

  describe('deserializeDocuments — Blob data (P2P sync, #122)', () => {
    it('keeps an existing Blob as is and sets size and mimeType from it', () => {
      const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' });
      const [doc] = deserializeDocuments([
        { id: 1, name: 'photo.png', mimeType: 'application/octet-stream', size: 0, data: blob },
      ]);

      expect(doc?.data).toBe(blob);
      expect(doc?.size).toBe(4);
      expect(doc?.mimeType).toBe('image/png');
    });

    it('keeps the record mimeType when the Blob has no type', () => {
      const blob = new Blob([new Uint8Array([1, 2])]);
      const [doc] = deserializeTenantDocuments([
        { id: 1, tenantId: 1, name: 'scan', mimeType: 'application/pdf', size: 9, data: blob },
      ]);

      expect(doc?.data).toBe(blob);
      expect(doc?.size).toBe(2);
      expect(doc?.mimeType).toBe('application/pdf');
    });

    it('still sets data to null when it is neither a Blob nor a data URL', () => {
      const [doc] = deserializeDocuments([{ id: 1, data: 'not-a-data-url' }]);
      expect(doc?.data).toBeNull();
    });
  });

  describe('createSyncSource', () => {
    const tables = (): SyncTables =>
      Object.fromEntries(SYNC_TABLES.map(table => [table, [] as unknown[]])) as SyncTables;

    it('keeps the raw tables and Blobs, and computes counts and total bytes', () => {
      const a = new Blob([new Uint8Array(10)]);
      const b = new Blob([new Uint8Array(32)]);
      const t = tables();
      t.properties = [{ id: 1 }, { id: 2 }];
      t.documents = [
        { id: 1, data: a },
        { id: 2, data: null },
      ];
      t.tenantDocuments = [{ id: 1, data: b }];

      const source = createSyncSource(t, '1.2.0', '2026-01-01T00:00:00.000Z');

      expect(source.tables).toBe(t);
      expect(recordBlob(source.tables.documents[0])).toBe(a);
      expect(source.counts.properties).toBe(2);
      expect(source.counts.documents).toBe(2);
      expect(source.counts.tenantDocuments).toBe(1);
      expect(source.counts.rents).toBe(0);
      expect(source.documents).toBe(3);
      expect(source.totalBytes).toBe(42);
      expect(source.appVersion).toBe('1.2.0');
      expect(source.exportedAt).toBe('2026-01-01T00:00:00.000Z');
    });

    it('handles an empty database', () => {
      const source = createSyncSource(tables(), '1.2.0');
      expect(source.documents).toBe(0);
      expect(source.totalBytes).toBe(0);
      expect(Object.values(source.counts).every(c => c === 0)).toBe(true);
      expect(Number.isNaN(Date.parse(source.exportedAt))).toBe(false);
    });
  });

  describe('table name guards and recordBlob', () => {
    it('recognises sync and blob table names', () => {
      expect(isSyncTableName('rents')).toBe(true);
      expect(isSyncTableName('nope')).toBe(false);
      expect(isSyncTableName(42)).toBe(false);
      expect(isBlobTableName('documents')).toBe(true);
      expect(isBlobTableName('tenantDocuments')).toBe(true);
      expect(isBlobTableName('rents')).toBe(false);
    });

    it('returns the Blob of a record, or null', () => {
      const blob = new Blob([new Uint8Array(1)]);
      expect(recordBlob({ data: blob })).toBe(blob);
      expect(recordBlob({ data: 'data:text/plain;base64,SGk=' })).toBeNull();
      expect(recordBlob({ id: 1 })).toBeNull();
      expect(recordBlob(null)).toBeNull();
    });
  });
});
