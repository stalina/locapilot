/**
 * Restore points (automatic backups, issue #59) — pure logic.
 *
 * A restore point is a snapshot of every business table, kept on the device in
 * the separate `locapilot-backups` database (see backupRepository). This module
 * holds the rules that do not touch any database: when a snapshot is due, when
 * the database counts as empty, which snapshots rotation deletes, how a
 * snapshot becomes an export / import payload, and the storage checks.
 */
import {
  SYNC_TABLES,
  isSyncTableName,
  serializeDocuments,
  serializeTenantDocuments,
  type ExportDataPayload,
  type SyncTableName,
} from './dataTransferService';

export const BACKUP_TRIGGERS = [
  'auto',
  'manual',
  'pre-import',
  'pre-sync',
  'pre-clear',
  'pre-restore',
] as const;

export type BackupTrigger = (typeof BACKUP_TRIGGERS)[number];

/** Metadata of a restore point (table `snapshots` of `locapilot-backups`). */
export interface BackupSnapshot {
  id?: number;
  createdAt: Date;
  trigger: BackupTrigger;
  appVersion: string;
  /** Dexie schema version of the main database (`db.verno`). */
  schemaVersion: number;
  counts: Record<SyncTableName, number>;
  /** Sum of the byte sizes of every document Blob. */
  totalBytes: number;
}

/** One business table of a restore point (table `snapshotTables`). */
export interface BackupSnapshotTable {
  id?: number;
  snapshotId: number;
  /** A SyncTableName — typed as string because a stored row is untrusted. */
  table: string;
  /** Raw records; document `data` is kept as a Blob (never base64). */
  records: unknown[];
}

/** A snapshot read back from the database: its id is always set. */
export type StoredBackupSnapshot = BackupSnapshot & { id: number };

export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const AUTO_BACKUP_CHECK_INTERVAL_MS = 60 * 60 * 1000;
export const AUTO_SNAPSHOTS_KEPT = 7;
export const OTHER_SNAPSHOTS_KEPT = 5;

export const AUTO_BACKUP_SETTING_KEY = 'autoBackupEnabled';
export const AUTO_BACKUP_LOCK_NAME = 'locapilot-auto-backup';

export const CONTINUE_WITHOUT_RESTORE_POINT_PROMPT =
  'Impossible de créer un point de restauration avant cette opération. Continuer sans point de restauration ?';
export const INVALID_SNAPSHOT_MESSAGE =
  'Ce point de restauration est invalide — restauration annulée';

export type BackupFailureReason = 'quota' | 'unavailable' | 'failed';

/** A restore point could not be created (quota, database unavailable, write). */
export class BackupFailedError extends Error {
  readonly reason: BackupFailureReason;
  /** The underlying error (Dexie, quota…), for logging. */
  readonly origin: unknown;

  constructor(reason: BackupFailureReason, options?: { cause?: unknown }) {
    super(
      reason === 'quota'
        ? 'Espace de stockage insuffisant pour créer un point de restauration'
        : reason === 'unavailable'
          ? 'Points de restauration indisponibles sur ce navigateur'
          : 'Impossible de créer le point de restauration'
    );
    this.name = 'BackupFailedError';
    this.reason = reason;
    this.origin = options?.cause;
  }
}

/** A restore point is corrupted or incompatible: it must not be restored. */
export class InvalidSnapshotError extends Error {
  /** What is wrong with the restore point, for logging. */
  readonly detail: string | undefined;

  constructor(detail?: string) {
    super(INVALID_SNAPSHOT_MESSAGE);
    this.name = 'InvalidSnapshotError';
    this.detail = detail;
  }
}

const TRIGGER_LABELS: Record<BackupTrigger, string> = {
  auto: 'Automatique',
  manual: 'Manuel',
  'pre-import': 'Avant import',
  'pre-sync': 'Avant synchronisation',
  'pre-clear': 'Avant effacement',
  'pre-restore': 'Avant restauration',
};

export function triggerLabel(trigger: BackupTrigger): string {
  return TRIGGER_LABELS[trigger];
}

/**
 * True when every business table except `settings` is empty. No restore point
 * is ever created on such a database: after an accidental "Tout effacer", the
 * daily job must not push the good snapshots out of the rotation.
 */
export function isDatabaseEmpty(counts: Partial<Record<SyncTableName, number>>): boolean {
  return SYNC_TABLES.every(table => table === 'settings' || (counts[table] ?? 0) === 0);
}

/** True when no `auto` restore point exists or the last one is 24 h old or more. */
export function isAutoBackupDue(lastAutoCreatedAt: Date | null | undefined, now: Date): boolean {
  if (!lastAutoCreatedAt) return true;
  return now.getTime() - lastAutoCreatedAt.getTime() >= AUTO_BACKUP_INTERVAL_MS;
}

/**
 * Rotation: keep the 7 most recent `auto` restore points and the 5 most recent
 * of the other triggers (one shared pool). Returns the ids to delete; the
 * restore point that was just created (`newId`) and the protected ones
 * (`keepIds`, e.g. the restore point being restored) are never among them.
 * Protected restore points count as kept, so the next-oldest ones of their
 * pool are deleted instead and each pool still ends at its limit.
 */
export function selectSnapshotsToDelete(
  snapshots: ReadonlyArray<Pick<BackupSnapshot, 'id' | 'createdAt' | 'trigger'>>,
  newId: number,
  keepIds: ReadonlyArray<number> = []
): number[] {
  const protectedIds = new Set<number>([newId, ...keepIds]);
  const isProtected = (s: Pick<BackupSnapshot, 'id'>) =>
    typeof s.id === 'number' && protectedIds.has(s.id);

  const newestFirst = (
    a: Pick<BackupSnapshot, 'id' | 'createdAt'>,
    b: Pick<BackupSnapshot, 'id' | 'createdAt'>
  ) => b.createdAt.getTime() - a.createdAt.getTime() || (b.id ?? 0) - (a.id ?? 0);

  const excess = (pool: Array<Pick<BackupSnapshot, 'id' | 'createdAt'>>, kept: number) => {
    const sorted = [...pool].sort(newestFirst);
    // The new and protected restore points always count as kept ones.
    const protectedCount = sorted.filter(isProtected).length;
    const others = sorted.filter(s => !isProtected(s));
    return others.slice(Math.max(0, kept - protectedCount)).map(s => s.id);
  };

  const auto = snapshots.filter(s => s.trigger === 'auto');
  const other = snapshots.filter(s => s.trigger !== 'auto');

  return [...excess(auto, AUTO_SNAPSHOTS_KEPT), ...excess(other, OTHER_SNAPSHOTS_KEPT)].filter(
    (id): id is number => typeof id === 'number' && !protectedIds.has(id)
  );
}

/** Rough on-disk size of a restore point: the Blobs plus ~2 KB per record. */
export function estimateSnapshotBytes(
  counts: Partial<Record<SyncTableName, number>>,
  totalBytes: number
): number {
  const records = SYNC_TABLES.reduce((sum, table) => sum + (counts[table] ?? 0), 0);
  return totalBytes + records * 2048;
}

/**
 * Records per table of a restore point, after checking it is complete: every
 * stored table must be known and hold exactly the announced number of records,
 * and every table announced with records must be stored. A table missing from
 * an older restore point (e.g. `expenses`) becomes an empty array.
 */
export function snapshotTablesToRecords(
  snapshot: Pick<BackupSnapshot, 'counts'>,
  tables: ReadonlyArray<Pick<BackupSnapshotTable, 'table' | 'records'>>
): Record<SyncTableName, unknown[]> {
  const byTable = new Map<string, unknown[]>();
  for (const row of tables) {
    if (!isSyncTableName(row.table)) {
      throw new InvalidSnapshotError(`unknown table ${row.table}`);
    }
    if (byTable.has(row.table) || !Array.isArray(row.records)) {
      throw new InvalidSnapshotError(`invalid table ${row.table}`);
    }
    byTable.set(row.table, row.records);
  }

  const counts: Partial<Record<SyncTableName, number>> = snapshot.counts ?? {};
  const result = {} as Record<SyncTableName, unknown[]>;
  for (const table of SYNC_TABLES) {
    const records = byTable.get(table) ?? [];
    const announced = counts[table] ?? 0;
    if (records.length !== announced) {
      throw new InvalidSnapshotError(
        `${table}: ${records.length} record(s) stored, ${announced} announced`
      );
    }
    result[table] = records;
  }
  return result;
}

/**
 * Payload handed to the validated import path (`importFromObject`) to restore
 * a snapshot. Document Blobs stay Blobs, exactly like a received P2P sync.
 */
export function snapshotToImportPayload(
  snapshot: Pick<BackupSnapshot, 'counts' | 'appVersion' | 'createdAt'>,
  tables: ReadonlyArray<Pick<BackupSnapshotTable, 'table' | 'records'>>
): Record<SyncTableName, unknown[]> & { version: string; exportedAt: string } {
  return {
    ...snapshotTablesToRecords(snapshot, tables),
    version: snapshot.appVersion,
    exportedAt: snapshot.createdAt.toISOString(),
  };
}

/**
 * Backup file of a restore point, in the same format as the manual export
 * (documents as data URLs). Tables missing from older snapshots become `[]`.
 */
export async function snapshotToExportPayload(
  snapshot: Pick<BackupSnapshot, 'counts' | 'appVersion' | 'createdAt'>,
  tables: ReadonlyArray<Pick<BackupSnapshotTable, 'table' | 'records'>>
): Promise<ExportDataPayload> {
  const records = snapshotTablesToRecords(snapshot, tables);
  return {
    properties: records.properties,
    tenants: records.tenants,
    leases: records.leases,
    rents: records.rents,
    documents: await serializeDocuments(records.documents as Array<Record<string, unknown>>),
    tenantDocuments: await serializeTenantDocuments(
      records.tenantDocuments as Array<Record<string, unknown>>
    ),
    tenantAudits: records.tenantAudits,
    inventories: records.inventories,
    communications: records.communications,
    chargesAdjustments: records.chargesAdjustments,
    irlIndices: records.irlIndices,
    rentRevisions: records.rentRevisions,
    reminders: records.reminders,
    expenses: records.expenses,
    settings: records.settings,
    exportedAt: snapshot.createdAt.toISOString(),
    version: snapshot.appVersion,
  };
}

/** `locapilot-restore-point-YYYY-MM-DD.json`, from the local creation date. */
export function snapshotFileName(createdAt: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${createdAt.getFullYear()}-${pad(createdAt.getMonth() + 1)}-${pad(createdAt.getDate())}`;
  return `locapilot-restore-point-${day}.json`;
}

/** Bytes → "Mo" for display (e.g. 612, 3,5, 0). */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb.toLocaleString('fr-FR', { maximumFractionDigits: mb < 10 ? 1 : 0 });
}

/** True when the error (or the error Dexie wraps) is a storage quota error. */
export function isQuotaError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && typeof current === 'object' && current !== null; depth++) {
    if ('name' in current && current.name === 'QuotaExceededError') return true;
    current = 'inner' in current ? current.inner : undefined;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Storage checks (navigator.storage, when supported)
// ---------------------------------------------------------------------------

export type StorageLike = Partial<Pick<StorageManager, 'estimate' | 'persist' | 'persisted'>>;

function browserStorage(): StorageLike | undefined {
  return typeof navigator !== 'undefined' ? navigator.storage : undefined;
}

/**
 * False when `navigator.storage.estimate()` reports less free quota than
 * `requiredBytes`. True when the estimate is unsupported or fails.
 */
export async function hasStorageFor(
  requiredBytes: number,
  storage: StorageLike | undefined = browserStorage()
): Promise<boolean> {
  if (!storage || typeof storage.estimate !== 'function') return true;
  try {
    const { quota, usage } = await storage.estimate();
    if (typeof quota !== 'number') return true;
    return quota - (usage ?? 0) >= requiredBytes;
  } catch {
    return true;
  }
}

/** Ask for persistent storage. Null when the API is unsupported or fails. */
export async function requestPersistentStorage(
  storage: StorageLike | undefined = browserStorage()
): Promise<boolean | null> {
  if (!storage || typeof storage.persist !== 'function') return null;
  try {
    return await storage.persist();
  } catch {
    return null;
  }
}

/** Whether storage is already persistent. Null when unsupported or failing. */
export async function isStoragePersisted(
  storage: StorageLike | undefined = browserStorage()
): Promise<boolean | null> {
  if (!storage || typeof storage.persisted !== 'function') return null;
  try {
    return await storage.persisted();
  } catch {
    return null;
  }
}

/**
 * Run a destructive operation that takes a restore point first. When that
 * restore point cannot be created, ask whether to continue without it: on
 * "OK" the operation runs again with `skipSnapshot = true`, otherwise nothing
 * is done (the database is left unchanged).
 */
export async function runWithRestorePointFallback<T>(
  operation: (skipSnapshot: boolean) => Promise<T>,
  askToContinue: (message: string) => boolean
): Promise<{ status: 'done'; result: T } | { status: 'declined' }> {
  try {
    return { status: 'done', result: await operation(false) };
  } catch (error) {
    if (!(error instanceof BackupFailedError)) throw error;
    if (!askToContinue(CONTINUE_WITHOUT_RESTORE_POINT_PROMPT)) return { status: 'declined' };
    return { status: 'done', result: await operation(true) };
  }
}
