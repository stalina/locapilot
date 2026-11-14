import { beforeEach, describe, expect, it } from 'vitest';
// fake-indexeddb clones values with Node's structuredClone, which only knows
// Node's Blob (jsdom's Blob would come back as {}). In a browser the DOM Blob
// round-trips the same way.
import { Blob as NodeBlob } from 'node:buffer';
import { db } from '@/db/database';
import type { Property } from '@/db/types';
import {
  BACKUP_DB_NAME,
  backupDb,
  deleteSnapshot,
  getLatestSnapshotDate,
  getSnapshot,
  getSnapshotTables,
  listSnapshots,
  openBackupDatabase,
  writeSnapshot,
} from './backupRepository';
import {
  clearBusinessData,
  fetchRawExportDataConsistent,
  importBusinessData,
} from './dataTransferRepository';
import { SYNC_TABLES, type SyncTableName, type SyncTables } from '../services/dataTransferService';
import type { BackupSnapshot, BackupTrigger } from '../services/backupService';

const HOUR = 60 * 60 * 1000;

function emptyTables(overrides: Partial<SyncTables> = {}): SyncTables {
  const tables = Object.fromEntries(SYNC_TABLES.map(t => [t, []])) as unknown as SyncTables;
  return { ...tables, ...overrides };
}

function countsOf(tables: SyncTables): Record<SyncTableName, number> {
  return Object.fromEntries(SYNC_TABLES.map(t => [t, tables[t].length])) as Record<
    SyncTableName,
    number
  >;
}

function meta(
  trigger: BackupTrigger,
  createdAt: Date,
  tables: SyncTables = emptyTables()
): Omit<BackupSnapshot, 'id'> {
  return {
    createdAt,
    trigger,
    appVersion: '1.2.0',
    schemaVersion: 12,
    counts: countsOf(tables),
    totalBytes: 0,
  };
}

function property(name: string): Property {
  return {
    name,
    address: '1 rue',
    type: 'apartment',
    surface: 40,
    rooms: 2,
    rent: 700,
    status: 'vacant',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('backupRepository (integration, fake-indexeddb)', () => {
  beforeEach(async () => {
    await openBackupDatabase();
    await backupDb.snapshots.clear();
    await backupDb.snapshotTables.clear();
    await db.open();
    await clearBusinessData();
  });

  it('uses a separate database named locapilot-backups', () => {
    expect(BACKUP_DB_NAME).toBe('locapilot-backups');
    expect(backupDb.name).toBe('locapilot-backups');
    expect(backupDb.name).not.toBe(db.name);
  });

  it('writes the metadata and one row per business table', async () => {
    const tables = emptyTables({ properties: [{ id: 1, name: 'A' }] });

    const { id, deletedIds } = await writeSnapshot(meta('manual', new Date(), tables), tables);

    expect(deletedIds).toEqual([]);
    const stored = await getSnapshot(id);
    expect(stored?.trigger).toBe('manual');
    expect(stored?.counts.properties).toBe(1);
    const rows = await getSnapshotTables(id);
    expect(rows.map(r => r.table).sort()).toEqual([...SYNC_TABLES].sort());
    expect(rows.find(r => r.table === 'properties')?.records).toEqual([{ id: 1, name: 'A' }]);
  });

  it('keeps document Blobs as Blobs, byte-identical after a round trip', async () => {
    const bytes = new Uint8Array(4096).map((_, i) => (i * 7 + 3) % 256);
    const blob = new NodeBlob([bytes], { type: 'application/pdf' });
    const tables = emptyTables({
      documents: [{ id: 1, name: 'bail.pdf', mimeType: 'application/pdf', data: blob }],
    });

    const { id } = await writeSnapshot(meta('manual', new Date(), tables), tables);

    const rows = await getSnapshotTables(id);
    const record = rows.find(r => r.table === 'documents')?.records[0] as { data: unknown };
    expect(record.data).toBeInstanceOf(NodeBlob);
    const restored = record.data as NodeBlob;
    expect(restored.type).toBe('application/pdf');
    expect(restored.size).toBe(4096);
    expect(Array.from(new Uint8Array(await restored.arrayBuffer()))).toEqual(Array.from(bytes));
  });

  it('lists restore points newest first and finds the latest of a trigger', async () => {
    const now = Date.now();
    await writeSnapshot(meta('auto', new Date(now - 48 * HOUR)), emptyTables());
    await writeSnapshot(meta('auto', new Date(now - 24 * HOUR)), emptyTables());
    await writeSnapshot(meta('manual', new Date(now - HOUR)), emptyTables());

    const list = await listSnapshots();
    expect(list.map(s => s.trigger)).toEqual(['manual', 'auto', 'auto']);
    expect((await getLatestSnapshotDate('auto'))?.getTime()).toBe(now - 24 * HOUR);
    expect(await getLatestSnapshotDate('pre-clear')).toBeNull();
  });

  it('is atomic: a failing write leaves no partial restore point', async () => {
    const { id: previousId } = await writeSnapshot(meta('manual', new Date()), emptyTables());
    // A function cannot be stored in IndexedDB: the table rows fail to write.
    const broken = emptyTables({ rents: [{ id: 1, notCloneable: () => 1 }] });

    await expect(writeSnapshot(meta('auto', new Date()), broken)).rejects.toBeDefined();

    const list = await listSnapshots();
    expect(list.map(s => s.id)).toEqual([previousId]);
    expect(await backupDb.snapshotTables.count()).toBe(SYNC_TABLES.length);
  });

  it('rotates in the same transaction: the oldest auto point and its tables go', async () => {
    const now = Date.now();
    const ids: number[] = [];
    for (let day = 7; day >= 1; day--) {
      const { id } = await writeSnapshot(
        meta('auto', new Date(now - day * 24 * HOUR)),
        emptyTables()
      );
      ids.push(id);
    }
    const { id: manualId } = await writeSnapshot(
      meta('manual', new Date(now - HOUR)),
      emptyTables()
    );

    const { id: newId, deletedIds } = await writeSnapshot(
      meta('auto', new Date(now)),
      emptyTables()
    );

    expect(deletedIds).toEqual([ids[0]]);
    const remaining = (await listSnapshots()).map(s => s.id);
    expect(remaining).toContain(newId);
    expect(remaining).toContain(manualId);
    expect(remaining).not.toContain(ids[0]);
    expect(await getSnapshotTables(ids[0] as number)).toEqual([]);
  });

  it('deleteSnapshot removes the restore point and all its stored tables', async () => {
    const { id: keep } = await writeSnapshot(meta('manual', new Date()), emptyTables());
    const { id: drop } = await writeSnapshot(meta('manual', new Date()), emptyTables());

    await deleteSnapshot(drop);

    expect(await getSnapshot(drop)).toBeUndefined();
    expect(await getSnapshotTables(drop)).toEqual([]);
    expect((await getSnapshotTables(keep)).length).toBe(SYNC_TABLES.length);
  });

  it('clearBusinessData and importBusinessData never touch locapilot-backups', async () => {
    await writeSnapshot(meta('manual', new Date()), emptyTables());

    await clearBusinessData();
    await importBusinessData({ properties: [property('Importée')], tenants: [] });

    expect((await listSnapshots()).length).toBe(1);
    expect(await backupDb.snapshotTables.count()).toBe(SYNC_TABLES.length);
  });

  it('fetchRawExportDataConsistent reads every business table', async () => {
    await db.properties.add(property('Lue'));
    await db.settings.add({ key: 'ownerName', value: 'Jean', updatedAt: new Date() });

    const raw = await fetchRawExportDataConsistent();

    expect(raw.properties.map(p => p.name)).toEqual(['Lue']);
    expect(raw.settings.length).toBe(1);
    expect(Object.keys(raw).sort()).toEqual([...SYNC_TABLES].sort());
  });
});
