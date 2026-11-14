/**
 * Restore points storage (issue #59): a SEPARATE, device-local Dexie database
 * `locapilot-backups`, never the main `locapilot` database. "Tout effacer",
 * file imports, exports and P2P syncs only touch the main database, so they
 * never read, replace or delete restore points.
 */
import Dexie, { type Table } from 'dexie';
import { SYNC_TABLES, type SyncTables } from '../services/dataTransferService';
import {
  selectSnapshotsToDelete,
  type BackupSnapshot,
  type BackupSnapshotTable,
  type BackupTrigger,
  type StoredBackupSnapshot,
} from '../services/backupService';

export const BACKUP_DB_NAME = 'locapilot-backups';

class BackupDatabase extends Dexie {
  snapshots!: Table<BackupSnapshot, number>;
  snapshotTables!: Table<BackupSnapshotTable, number>;

  constructor() {
    super(BACKUP_DB_NAME);
    this.version(1).stores({
      snapshots: '++id, createdAt, trigger',
      snapshotTables: '++id, snapshotId, [snapshotId+table]',
    });
  }
}

export const backupDb = new BackupDatabase();

const withId = (snapshot: BackupSnapshot): snapshot is StoredBackupSnapshot =>
  typeof snapshot.id === 'number';

/** Open `locapilot-backups`; throws when the browser refuses (e.g. private mode). */
export async function openBackupDatabase(): Promise<void> {
  if (!backupDb.isOpen()) await backupDb.open();
}

/** Every restore point's metadata, newest first. */
export async function listSnapshots(): Promise<StoredBackupSnapshot[]> {
  const snapshots = await backupDb.snapshots.orderBy('createdAt').reverse().toArray();
  return snapshots.filter(withId);
}

export async function getSnapshot(id: number): Promise<StoredBackupSnapshot | undefined> {
  const snapshot = await backupDb.snapshots.get(id);
  return snapshot && withId(snapshot) ? snapshot : undefined;
}

/** Creation date of the most recent restore point with this trigger. */
export async function getLatestSnapshotDate(trigger: BackupTrigger): Promise<Date | null> {
  const latest = await backupDb.snapshots
    .orderBy('createdAt')
    .reverse()
    .filter(s => s.trigger === trigger)
    .first();
  return latest?.createdAt ?? null;
}

/** The stored tables of a restore point (one row per business table). */
export async function getSnapshotTables(snapshotId: number): Promise<BackupSnapshotTable[]> {
  return backupDb.snapshotTables.where('snapshotId').equals(snapshotId).toArray();
}

/**
 * Write a restore point — metadata, one row per business table and the
 * rotation deletions — in a single read-write transaction: it is either
 * complete or absent, and rotation only happens when the write succeeded.
 */
export async function writeSnapshot(
  meta: Omit<BackupSnapshot, 'id'>,
  tables: SyncTables
): Promise<{ id: number; deletedIds: number[] }> {
  return backupDb.transaction('rw', backupDb.snapshots, backupDb.snapshotTables, async () => {
    const id = await backupDb.snapshots.add({ ...meta });
    await backupDb.snapshotTables.bulkAdd(
      SYNC_TABLES.map(table => ({ snapshotId: id, table, records: tables[table] }))
    );

    const all = await backupDb.snapshots.toArray();
    const deletedIds = selectSnapshotsToDelete(all, id);
    if (deletedIds.length > 0) {
      await backupDb.snapshots.bulkDelete(deletedIds);
      await backupDb.snapshotTables.where('snapshotId').anyOf(deletedIds).delete();
    }
    return { id, deletedIds };
  });
}

/** Delete a restore point and all its stored tables, atomically. */
export async function deleteSnapshot(id: number): Promise<void> {
  await backupDb.transaction('rw', backupDb.snapshots, backupDb.snapshotTables, async () => {
    await backupDb.snapshots.delete(id);
    await backupDb.snapshotTables.where('snapshotId').equals(id).delete();
  });
}
