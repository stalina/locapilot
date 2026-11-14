import { defineStore } from 'pinia';
import { ref } from 'vue';
import pkg from '../../../../package.json';
import { logger } from '@/shared/utils/logger';
import {
  currentSchemaVersion,
  fetchRawExportDataConsistent,
} from '../repositories/dataTransferRepository';
import {
  deleteSnapshot as deleteStoredSnapshot,
  getLatestSnapshotDate,
  getSnapshot,
  getSnapshotTables,
  listSnapshots,
  openBackupDatabase,
  writeSnapshot,
} from '../repositories/backupRepository';
import { fetchSettingValue, saveSettingValue } from '../repositories/settingsRepository';
import { createSyncSource } from '../services/dataTransferService';
import { validateImportPayload } from '../services/importValidationService';
import {
  AUTO_BACKUP_CHECK_INTERVAL_MS,
  AUTO_BACKUP_LOCK_NAME,
  AUTO_BACKUP_SETTING_KEY,
  BackupFailedError,
  InvalidSnapshotError,
  estimateSnapshotBytes,
  hasStorageFor,
  isAutoBackupDue,
  isDatabaseEmpty,
  isQuotaError,
  isStoragePersisted,
  requestPersistentStorage,
  snapshotFileName,
  snapshotToExportPayload,
  snapshotToImportPayload,
  type BackupTrigger,
  type StoredBackupSnapshot,
} from '../services/backupService';
import { useDataTransferStore, type RestorePointOptions } from './dataTransferStore';

const APP_VERSION: string = pkg.version ?? '0.0.1';

export type CreateSnapshotResult = 'created' | 'skipped-empty';
export type AutoBackupResult =
  | 'created'
  | 'disabled'
  | 'not-due'
  | 'skipped-empty'
  | 'failed'
  | 'busy';

export const AUTO_BACKUP_QUOTA_WARNING =
  "Le dernier point de restauration automatique n'a pas pu être créé (espace de stockage insuffisant)";
export const AUTO_BACKUP_FAILED_WARNING =
  "Le dernier point de restauration automatique n'a pas pu être créé";

function hasWebLocks(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.locks !== 'undefined' &&
    typeof navigator.locks.request === 'function'
  );
}

/**
 * Restore points (issue #59): the list, creation (automatic, manual and
 * before destructive operations), restore, download and deletion.
 */
export const useBackupStore = defineStore('backup', () => {
  const snapshots = ref<StoredBackupSnapshot[]>([]);
  const isCreating = ref(false);
  const isRestoring = ref(false);
  const lastAutoError = ref<string | null>(null);
  /** `locapilot-backups` cannot be opened (e.g. private browsing). */
  const unavailable = ref(false);
  /** Persistent storage: granted, refused, or unknown/unsupported (null). */
  const persisted = ref<boolean | null>(null);
  const autoBackupEnabled = ref(true);

  let persistenceRequested = false;
  let autoBackupRunning = false;
  let schedulerTimer: ReturnType<typeof setInterval> | null = null;

  async function ensureAvailable(): Promise<void> {
    try {
      await openBackupDatabase();
      unavailable.value = false;
    } catch (error) {
      unavailable.value = true;
      throw new BackupFailedError('unavailable', { cause: error });
    }
  }

  async function loadSnapshots(): Promise<void> {
    try {
      await ensureAvailable();
      snapshots.value = await listSnapshots();
    } catch (error) {
      logger.warn('Restore points could not be loaded', { source: 'backup' }, error);
      snapshots.value = [];
    }
    if (persisted.value === null) persisted.value = await isStoragePersisted();
  }

  async function loadAutoBackupSetting(): Promise<boolean> {
    try {
      const value = await fetchSettingValue<unknown>(AUTO_BACKUP_SETTING_KEY);
      // Default on: only an explicit `false` disables automatic restore points.
      autoBackupEnabled.value = value !== false;
    } catch {
      autoBackupEnabled.value = true;
    }
    return autoBackupEnabled.value;
  }

  async function setAutoBackupEnabled(enabled: boolean): Promise<void> {
    await saveSettingValue(AUTO_BACKUP_SETTING_KEY, enabled);
    autoBackupEnabled.value = enabled;
    // Turning it back on checks right away (in the background).
    if (enabled) void runAutoBackupIfDue();
  }

  /**
   * Snapshot every business table (one read-only transaction) into
   * `locapilot-backups` (one read-write transaction, rotation included).
   * Never snapshots an empty database. Throws BackupFailedError on a quota or
   * database failure; nothing is written and no restore point is deleted then.
   */
  async function createSnapshot(trigger: BackupTrigger): Promise<CreateSnapshotResult> {
    isCreating.value = true;
    try {
      await ensureAvailable();

      let source;
      try {
        const raw = await fetchRawExportDataConsistent();
        source = createSyncSource(raw, APP_VERSION);
      } catch (error) {
        throw new BackupFailedError('failed', { cause: error });
      }

      if (isDatabaseEmpty(source.counts)) return 'skipped-empty';

      if (!(await hasStorageFor(estimateSnapshotBytes(source.counts, source.totalBytes)))) {
        throw new BackupFailedError('quota');
      }

      try {
        await writeSnapshot(
          {
            createdAt: new Date(),
            trigger,
            appVersion: APP_VERSION,
            schemaVersion: currentSchemaVersion(),
            counts: source.counts,
            totalBytes: source.totalBytes,
          },
          source.tables
        );
      } catch (error) {
        throw new BackupFailedError(isQuotaError(error) ? 'quota' : 'failed', { cause: error });
      }

      if (!persistenceRequested && persisted.value !== true) {
        persistenceRequested = true;
        const granted = await requestPersistentStorage();
        if (granted !== null) persisted.value = granted;
      }

      await loadSnapshots();
      return 'created';
    } finally {
      isCreating.value = false;
    }
  }

  async function checkAndCreateAuto(): Promise<AutoBackupResult> {
    if (!(await loadAutoBackupSetting())) return 'disabled';
    // Read again under the lock: another tab may have just created one.
    await ensureAvailable();
    if (!isAutoBackupDue(await getLatestSnapshotDate('auto'), new Date())) return 'not-due';
    return createSnapshot('auto');
  }

  /**
   * Periodic check: create an `auto` restore point when enabled and the last
   * one is 24 h old. Runs under a Web Lock so several tabs create only one.
   * Never throws: a failure is logged and shown as a non-blocking warning.
   */
  async function runAutoBackupIfDue(): Promise<AutoBackupResult> {
    if (autoBackupRunning) return 'busy';
    autoBackupRunning = true;
    try {
      const result = hasWebLocks()
        ? await navigator.locks.request(AUTO_BACKUP_LOCK_NAME, () => checkAndCreateAuto())
        : await checkAndCreateAuto();
      if (result === 'created') lastAutoError.value = null;
      return result;
    } catch (error) {
      const quota = error instanceof BackupFailedError && error.reason === 'quota';
      lastAutoError.value = quota ? AUTO_BACKUP_QUOTA_WARNING : AUTO_BACKUP_FAILED_WARNING;
      logger.error(
        'Automatic restore point failed',
        {
          source: 'backup',
          reason: error instanceof BackupFailedError ? error.reason : 'unknown',
        },
        error
      );
      return 'failed';
    } finally {
      autoBackupRunning = false;
    }
  }

  /** Check now, then every hour while the application stays open. */
  function startAutoBackupScheduler(): () => void {
    if (!schedulerTimer) {
      void runAutoBackupIfDue();
      schedulerTimer = setInterval(() => {
        void runAutoBackupIfDue();
      }, AUTO_BACKUP_CHECK_INTERVAL_MS);
    }
    return stopAutoBackupScheduler;
  }

  function stopAutoBackupScheduler(): void {
    if (schedulerTimer) clearInterval(schedulerTimer);
    schedulerTimer = null;
  }

  async function deleteSnapshot(id: number): Promise<void> {
    await deleteStoredSnapshot(id);
    await loadSnapshots();
  }

  async function readSnapshot(id: number) {
    const snapshot = await getSnapshot(id);
    if (!snapshot) throw new InvalidSnapshotError('missing snapshot');
    const tables = await getSnapshotTables(id);
    return { snapshot, tables };
  }

  /**
   * Replace the business data with a restore point, through the single
   * validated import path. A `pre-restore` restore point of the current data
   * is taken first (after validation, before any clear()), unless skipped.
   */
  async function restoreSnapshot(
    id: number,
    options: Pick<RestorePointOptions, 'skipSnapshot'> = {}
  ): Promise<void> {
    isRestoring.value = true;
    try {
      const { snapshot, tables } = await readSnapshot(id);

      let payload;
      try {
        payload = snapshotToImportPayload(snapshot, tables);
        validateImportPayload(payload);
      } catch (error) {
        logger.warn('Invalid restore point', { source: 'backup', snapshotId: id }, error);
        throw error instanceof InvalidSnapshotError
          ? error
          : new InvalidSnapshotError(error instanceof Error ? error.message : undefined);
      }

      await useDataTransferStore().importFromObject(payload, {
        snapshotTrigger: 'pre-restore',
        skipSnapshot: options.skipSnapshot,
      });
      await loadSnapshots();
    } finally {
      isRestoring.value = false;
    }
  }

  /** Download a restore point in the same format as the manual export. */
  async function downloadSnapshot(id: number): Promise<void> {
    const { snapshot, tables } = await readSnapshot(id);
    const payload = await snapshotToExportPayload(snapshot, tables);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = snapshotFileName(snapshot.createdAt);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    snapshots,
    isCreating,
    isRestoring,
    lastAutoError,
    unavailable,
    persisted,
    autoBackupEnabled,
    loadSnapshots,
    loadAutoBackupSetting,
    setAutoBackupEnabled,
    createSnapshot,
    runAutoBackupIfDue,
    startAutoBackupScheduler,
    stopAutoBackupScheduler,
    deleteSnapshot,
    restoreSnapshot,
    downloadSnapshot,
  };
});
