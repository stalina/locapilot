import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import {
  useBackupStore,
  AUTO_BACKUP_QUOTA_WARNING,
  AUTO_BACKUP_FAILED_WARNING,
} from './backupStore';
import { useDataTransferStore } from './dataTransferStore';
import { SYNC_TABLES, type SyncTableName } from '../services/dataTransferService';
import {
  AUTO_BACKUP_CHECK_INTERVAL_MS,
  BackupFailedError,
  InvalidSnapshotError,
  selectSnapshotsToDelete,
  type BackupSnapshot,
  type BackupSnapshotTable,
  type StoredBackupSnapshot,
} from '../services/backupService';
import type { RawExportData } from '../repositories/dataTransferRepository';

vi.mock('../repositories/backupRepository', () => ({
  openBackupDatabase: vi.fn(),
  listSnapshots: vi.fn(),
  getSnapshot: vi.fn(),
  getSnapshotTables: vi.fn(),
  getLatestSnapshotDate: vi.fn(),
  writeSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
}));

vi.mock('../repositories/dataTransferRepository', () => ({
  fetchRawExportData: vi.fn(),
  fetchRawExportDataConsistent: vi.fn(),
  currentSchemaVersion: vi.fn(() => 12),
  importBusinessData: vi.fn(),
  clearBusinessData: vi.fn(),
}));

vi.mock('../repositories/settingsRepository', () => ({
  fetchSettingValue: vi.fn(),
  saveSettingValue: vi.fn(),
}));

vi.mock('@/shared/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  deleteSnapshot,
  getLatestSnapshotDate,
  getSnapshot,
  getSnapshotTables,
  listSnapshots,
  openBackupDatabase,
  writeSnapshot,
} from '../repositories/backupRepository';
import {
  fetchRawExportDataConsistent,
  importBusinessData,
} from '../repositories/dataTransferRepository';
import { fetchSettingValue, saveSettingValue } from '../repositories/settingsRepository';
import { logger } from '@/shared/utils/logger';

const HOUR = 60 * 60 * 1000;
const iso = '2026-01-01T00:00:00.000Z';

function property(name = 'Appartement') {
  return {
    id: 1,
    name,
    address: '1 rue',
    type: 'apartment' as const,
    surface: 40,
    rooms: 2,
    rent: 700,
    status: 'vacant' as const,
    createdAt: new Date(iso),
    updatedAt: new Date(iso),
  };
}

function raw(overrides: Partial<RawExportData> = {}): RawExportData {
  const empty = Object.fromEntries(SYNC_TABLES.map(t => [t, []])) as unknown as RawExportData;
  return { ...empty, ...overrides };
}

function counts(overrides: Partial<Record<SyncTableName, number>> = {}) {
  const zero = Object.fromEntries(SYNC_TABLES.map(t => [t, 0])) as Record<SyncTableName, number>;
  return { ...zero, ...overrides };
}

function stored(id: number, overrides: Partial<BackupSnapshot> = {}): StoredBackupSnapshot {
  return {
    id,
    createdAt: new Date('2026-11-10T08:00:00Z'),
    trigger: 'manual',
    appVersion: '1.2.0',
    schemaVersion: 12,
    counts: counts({ properties: 1 }),
    totalBytes: 0,
    ...overrides,
  };
}

function rowsFor(id: number, tables: Partial<Record<SyncTableName, unknown[]>>) {
  return SYNC_TABLES.map(
    (table): BackupSnapshotTable => ({ snapshotId: id, table, records: tables[table] ?? [] })
  );
}

function stubStorage(storage: Record<string, unknown> | undefined) {
  Object.defineProperty(navigator, 'storage', { configurable: true, value: storage });
}

function stubLocks(locks: unknown) {
  Object.defineProperty(navigator, 'locks', { configurable: true, value: locks });
}

/** A Web Lock that runs the callbacks one after the other, like the browser. */
function serialLocks() {
  let queue: Promise<unknown> = Promise.resolve();
  const request = vi.fn((_name: string, callback: () => Promise<unknown>) => {
    const run = queue.then(callback);
    queue = run.catch(() => undefined);
    return run;
  });
  return { request };
}

describe('backupStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    stubStorage(undefined);
    stubLocks(undefined);
    vi.mocked(openBackupDatabase).mockResolvedValue(undefined);
    vi.mocked(listSnapshots).mockResolvedValue([]);
    vi.mocked(getLatestSnapshotDate).mockResolvedValue(null);
    vi.mocked(writeSnapshot).mockResolvedValue({ id: 1, deletedIds: [] });
    vi.mocked(fetchRawExportDataConsistent).mockResolvedValue(raw({ properties: [property()] }));
    vi.mocked(fetchSettingValue).mockResolvedValue(undefined);
    vi.mocked(importBusinessData).mockResolvedValue(undefined);
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'storage');
    Reflect.deleteProperty(navigator, 'locks');
    vi.useRealTimers();
  });

  describe('createSnapshot', () => {
    it('writes a restore point of every table with its metadata', async () => {
      const blob = new Blob([new Uint8Array(10)], { type: 'application/pdf' });
      vi.mocked(fetchRawExportDataConsistent).mockResolvedValue(
        raw({
          properties: [property()],
          documents: [
            {
              id: 1,
              name: 'bail.pdf',
              type: 'lease',
              mimeType: 'application/pdf',
              size: 10,
              data: blob,
              createdAt: new Date(iso),
              updatedAt: new Date(iso),
            },
          ],
        })
      );
      const listed = [stored(1)];
      vi.mocked(listSnapshots).mockResolvedValue(listed);
      const store = useBackupStore();

      await expect(store.createSnapshot('manual')).resolves.toBe('created');

      expect(writeSnapshot).toHaveBeenCalledTimes(1);
      const [meta, tables] = vi.mocked(writeSnapshot).mock.calls[0] ?? [];
      expect(meta).toMatchObject({
        trigger: 'manual',
        schemaVersion: 12,
        counts: counts({ properties: 1, documents: 1 }),
        totalBytes: 10,
      });
      expect(meta?.createdAt).toBeInstanceOf(Date);
      expect((tables?.documents[0] as { data: unknown }).data).toBe(blob);
      expect(store.snapshots).toEqual(listed);
      expect(store.isCreating).toBe(false);
    });

    it('never snapshots an empty database (settings alone do not count)', async () => {
      vi.mocked(fetchRawExportDataConsistent).mockResolvedValue(
        raw({ settings: [{ key: 'theme', value: 'light', updatedAt: new Date() }] })
      );
      const store = useBackupStore();

      await expect(store.createSnapshot('pre-clear')).resolves.toBe('skipped-empty');
      expect(writeSnapshot).not.toHaveBeenCalled();
    });

    it('fails with a quota error, without writing, when the free quota is too small', async () => {
      stubStorage({ estimate: vi.fn(async () => ({ quota: 1000, usage: 999 })) });
      const store = useBackupStore();

      const error = await store.createSnapshot('manual').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BackupFailedError);
      expect((error as BackupFailedError).reason).toBe('quota');
      expect(writeSnapshot).not.toHaveBeenCalled();
    });

    it('reports a QuotaExceededError while writing as a quota failure', async () => {
      vi.mocked(writeSnapshot).mockRejectedValue({
        name: 'AbortError',
        inner: { name: 'QuotaExceededError' },
      });
      const store = useBackupStore();

      await expect(store.createSnapshot('manual')).rejects.toMatchObject({ reason: 'quota' });
    });

    it('reports any other write error as a failure', async () => {
      vi.mocked(writeSnapshot).mockRejectedValue(new Error('boom'));
      const store = useBackupStore();

      await expect(store.createSnapshot('manual')).rejects.toMatchObject({ reason: 'failed' });
    });

    it('reports a failure to read the main database', async () => {
      vi.mocked(fetchRawExportDataConsistent).mockRejectedValue(new Error('read'));
      const store = useBackupStore();

      await expect(store.createSnapshot('manual')).rejects.toMatchObject({ reason: 'failed' });
    });

    it('marks restore points unavailable when locapilot-backups cannot be opened', async () => {
      vi.mocked(openBackupDatabase).mockRejectedValue(new Error('private mode'));
      const store = useBackupStore();

      await expect(store.createSnapshot('manual')).rejects.toMatchObject({
        reason: 'unavailable',
      });
      expect(store.unavailable).toBe(true);
    });

    it('requests persistent storage once, after the first restore point', async () => {
      const persist = vi.fn(async () => false);
      stubStorage({ persist, persisted: vi.fn(async () => false) });
      const store = useBackupStore();

      await store.createSnapshot('manual');
      await store.createSnapshot('manual');

      expect(persist).toHaveBeenCalledTimes(1);
      expect(store.persisted).toBe(false);
    });
  });

  describe('loadSnapshots', () => {
    it('loads the list and the persistence state', async () => {
      vi.mocked(listSnapshots).mockResolvedValue([stored(2), stored(1)]);
      stubStorage({ persisted: vi.fn(async () => true) });
      const store = useBackupStore();

      await store.loadSnapshots();

      expect(store.snapshots.map(s => s.id)).toEqual([2, 1]);
      expect(store.persisted).toBe(true);
      expect(store.unavailable).toBe(false);
    });

    it('shows an empty, unavailable list when the database cannot be opened', async () => {
      vi.mocked(openBackupDatabase).mockRejectedValue(new Error('private mode'));
      const store = useBackupStore();

      await store.loadSnapshots();

      expect(store.unavailable).toBe(true);
      expect(store.snapshots).toEqual([]);
    });
  });

  describe('autoBackupEnabled setting', () => {
    it('is on by default when never saved', async () => {
      const store = useBackupStore();
      await expect(store.loadAutoBackupSetting()).resolves.toBe(true);
    });

    it('is off only when saved as false', async () => {
      vi.mocked(fetchSettingValue).mockResolvedValue(false);
      const store = useBackupStore();
      await expect(store.loadAutoBackupSetting()).resolves.toBe(false);
      expect(store.autoBackupEnabled).toBe(false);
    });

    it('falls back to on when the setting cannot be read', async () => {
      vi.mocked(fetchSettingValue).mockRejectedValue(new Error('db'));
      const store = useBackupStore();
      await expect(store.loadAutoBackupSetting()).resolves.toBe(true);
    });

    it('saves false without running a check', async () => {
      const store = useBackupStore();
      await store.setAutoBackupEnabled(false);

      expect(saveSettingValue).toHaveBeenCalledWith('autoBackupEnabled', false);
      expect(store.autoBackupEnabled).toBe(false);
      expect(fetchRawExportDataConsistent).not.toHaveBeenCalled();
    });

    it('checks right away when turned back on', async () => {
      vi.mocked(getLatestSnapshotDate).mockResolvedValue(new Date(Date.now() - 240 * HOUR));
      const store = useBackupStore();

      await store.setAutoBackupEnabled(true);
      await vi.waitFor(() => expect(writeSnapshot).toHaveBeenCalled());

      expect(saveSettingValue).toHaveBeenCalledWith('autoBackupEnabled', true);
      expect(vi.mocked(writeSnapshot).mock.calls[0]?.[0].trigger).toBe('auto');
    });
  });

  describe('runAutoBackupIfDue', () => {
    it('creates an auto restore point when none exists', async () => {
      const store = useBackupStore();
      await expect(store.runAutoBackupIfDue()).resolves.toBe('created');
      expect(vi.mocked(writeSnapshot).mock.calls[0]?.[0].trigger).toBe('auto');
    });

    it('creates one when the last auto restore point is 25 hours old', async () => {
      vi.mocked(getLatestSnapshotDate).mockResolvedValue(new Date(Date.now() - 25 * HOUR));
      const store = useBackupStore();
      await expect(store.runAutoBackupIfDue()).resolves.toBe('created');
    });

    it('skips when disabled', async () => {
      vi.mocked(fetchSettingValue).mockResolvedValue(false);
      const store = useBackupStore();

      await expect(store.runAutoBackupIfDue()).resolves.toBe('disabled');
      expect(writeSnapshot).not.toHaveBeenCalled();
    });

    it('skips when the last auto restore point is 3 hours old', async () => {
      vi.mocked(getLatestSnapshotDate).mockResolvedValue(new Date(Date.now() - 3 * HOUR));
      const store = useBackupStore();

      await expect(store.runAutoBackupIfDue()).resolves.toBe('not-due');
      expect(fetchRawExportDataConsistent).not.toHaveBeenCalled();
    });

    it('skips an empty database and keeps the existing restore points', async () => {
      vi.mocked(fetchRawExportDataConsistent).mockResolvedValue(raw());
      const store = useBackupStore();

      await expect(store.runAutoBackupIfDue()).resolves.toBe('skipped-empty');
      expect(writeSnapshot).not.toHaveBeenCalled();
      expect(deleteSnapshot).not.toHaveBeenCalled();
    });

    it('never throws: a quota failure is logged and shown as a warning', async () => {
      stubStorage({ estimate: vi.fn(async () => ({ quota: 10, usage: 10 })) });
      const store = useBackupStore();

      await expect(store.runAutoBackupIfDue()).resolves.toBe('failed');

      expect(store.lastAutoError).toBe(AUTO_BACKUP_QUOTA_WARNING);
      expect(logger.error).toHaveBeenCalledWith(
        'Automatic restore point failed',
        { source: 'backup', reason: 'quota' },
        expect.any(BackupFailedError)
      );
      expect(writeSnapshot).not.toHaveBeenCalled();
    });

    it('shows a generic warning for other failures, cleared by the next success', async () => {
      vi.mocked(writeSnapshot).mockRejectedValueOnce(new Error('boom'));
      const store = useBackupStore();

      await store.runAutoBackupIfDue();
      expect(store.lastAutoError).toBe(AUTO_BACKUP_FAILED_WARNING);

      await store.runAutoBackupIfDue();
      expect(store.lastAutoError).toBeNull();
    });

    it('does not run twice at the same time in one tab', async () => {
      const store = useBackupStore();
      const first = store.runAutoBackupIfDue();
      await expect(store.runAutoBackupIfDue()).resolves.toBe('busy');
      await expect(first).resolves.toBe('created');
    });

    it('runs under the Web Lock and re-reads the latest date inside it (two tabs, one snapshot)', async () => {
      const locks = serialLocks();
      stubLocks(locks);
      let latestAuto: Date | null = null;
      vi.mocked(getLatestSnapshotDate).mockImplementation(async () => latestAuto);
      vi.mocked(writeSnapshot).mockImplementation(async meta => {
        latestAuto = meta.createdAt;
        return { id: 1, deletedIds: [] };
      });

      // Two tabs = two independent store instances sharing the same lock.
      const tabA = useBackupStore(createPinia());
      const tabB = useBackupStore(createPinia());
      const results = await Promise.all([tabA.runAutoBackupIfDue(), tabB.runAutoBackupIfDue()]);

      expect(locks.request).toHaveBeenCalledTimes(2);
      expect(locks.request).toHaveBeenCalledWith('locapilot-auto-backup', expect.any(Function));
      expect(results.sort()).toEqual(['created', 'not-due']);
      expect(writeSnapshot).toHaveBeenCalledTimes(1);
    });
  });

  describe('startAutoBackupScheduler', () => {
    it('checks at once, then every hour, until stopped', async () => {
      vi.useFakeTimers();
      vi.mocked(getLatestSnapshotDate).mockResolvedValue(new Date());
      const store = useBackupStore();

      const stop = store.startAutoBackupScheduler();
      store.startAutoBackupScheduler(); // a second start does not add a timer
      await vi.advanceTimersByTimeAsync(0);
      expect(getLatestSnapshotDate).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(AUTO_BACKUP_CHECK_INTERVAL_MS);
      expect(getLatestSnapshotDate).toHaveBeenCalledTimes(2);

      stop();
      await vi.advanceTimersByTimeAsync(3 * AUTO_BACKUP_CHECK_INTERVAL_MS);
      expect(getLatestSnapshotDate).toHaveBeenCalledTimes(2);
    });
  });

  describe('restoreSnapshot', () => {
    beforeEach(() => {
      vi.mocked(getSnapshot).mockResolvedValue(stored(5, { counts: counts({ properties: 1 }) }));
      vi.mocked(getSnapshotTables).mockResolvedValue(
        rowsFor(5, { properties: [property('Restaurée')] })
      );
    });

    it('goes through importFromObject, the single validated import path', async () => {
      const dataTransfer = useDataTransferStore();
      const importSpy = vi.spyOn(dataTransfer, 'importFromObject');
      const store = useBackupStore();

      await store.restoreSnapshot(5);

      expect(importSpy).toHaveBeenCalledWith(
        expect.objectContaining({ properties: [property('Restaurée')], expenses: [] }),
        { snapshotTrigger: 'pre-restore', skipSnapshot: undefined, keepSnapshotIds: [5] }
      );
      expect(importBusinessData).toHaveBeenCalledWith(
        expect.objectContaining({ properties: [property('Restaurée')] })
      );
      expect(store.isRestoring).toBe(false);
    });

    it('creates a pre-restore restore point first when the database is not empty', async () => {
      const order: string[] = [];
      vi.mocked(writeSnapshot).mockImplementation(async meta => {
        order.push(`snapshot:${meta.trigger}`);
        return { id: 9, deletedIds: [] };
      });
      vi.mocked(importBusinessData).mockImplementation(async () => {
        order.push('import');
      });
      const store = useBackupStore();

      await store.restoreSnapshot(5);

      expect(order).toEqual(['snapshot:pre-restore', 'import']);
    });

    it('protects the restore point being restored from the pre-restore rotation', async () => {
      const store = useBackupStore();

      await store.restoreSnapshot(5);

      expect(writeSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: 'pre-restore' }),
        expect.anything(),
        [5]
      );
    });

    it('keeps the oldest of 5 non-automatic restore points when restoring it, even if the import fails', async () => {
      const at = (hoursAgo: number) => new Date(Date.UTC(2026, 10, 14) - hoursAgo * HOUR);
      let pool: StoredBackupSnapshot[] = [
        stored(2, { trigger: 'manual', createdAt: at(50) }),
        stored(3, { trigger: 'pre-clear', createdAt: at(40) }),
        stored(4, { trigger: 'pre-restore', createdAt: at(30) }),
        stored(5, { trigger: 'manual', createdAt: at(20) }),
        stored(6, { trigger: 'manual', createdAt: at(10) }),
      ];
      vi.mocked(getSnapshot).mockResolvedValue(pool[0]);
      vi.mocked(getSnapshotTables).mockResolvedValue(
        rowsFor(2, { properties: [property('Restaurée')] })
      );
      // Same rotation as the real repository, on an in-memory pool.
      vi.mocked(writeSnapshot).mockImplementation(async (meta, _tables, keepIds) => {
        pool = [...pool, { ...meta, id: 7 }];
        const deletedIds = selectSnapshotsToDelete(pool, 7, keepIds);
        pool = pool.filter(s => !deletedIds.includes(s.id));
        return { id: 7, deletedIds };
      });
      vi.mocked(importBusinessData).mockRejectedValue(new Error('write failed'));
      const store = useBackupStore();

      await expect(store.restoreSnapshot(2)).rejects.toThrow();

      expect(pool.map(s => s.id).sort((a, b) => a - b)).toEqual([2, 4, 5, 6, 7]);
    });

    it('creates no pre-restore restore point on an empty database', async () => {
      vi.mocked(fetchRawExportDataConsistent).mockResolvedValue(raw());
      const store = useBackupStore();

      await store.restoreSnapshot(5);

      expect(writeSnapshot).not.toHaveBeenCalled();
      expect(importBusinessData).toHaveBeenCalled();
    });

    it('skips the pre-restore restore point when asked to', async () => {
      const store = useBackupStore();
      await store.restoreSnapshot(5, { skipSnapshot: true });
      expect(writeSnapshot).not.toHaveBeenCalled();
      expect(importBusinessData).toHaveBeenCalled();
    });

    it('rejects a restore point whose stored records do not match its counts', async () => {
      vi.mocked(getSnapshot).mockResolvedValue(stored(5, { counts: counts({ properties: 2 }) }));
      const store = useBackupStore();

      await expect(store.restoreSnapshot(5)).rejects.toBeInstanceOf(InvalidSnapshotError);
      expect(importBusinessData).not.toHaveBeenCalled();
      expect(writeSnapshot).not.toHaveBeenCalled();
    });

    it('rejects a restore point with a record that fails the strict validation', async () => {
      vi.mocked(getSnapshotTables).mockResolvedValue(
        rowsFor(5, { properties: [{ ...property(), surface: 'grande' }] })
      );
      const store = useBackupStore();

      await expect(store.restoreSnapshot(5)).rejects.toThrow(
        'Ce point de restauration est invalide — restauration annulée'
      );
      expect(importBusinessData).not.toHaveBeenCalled();
    });

    it('rejects a restore point that no longer exists', async () => {
      vi.mocked(getSnapshot).mockResolvedValue(undefined);
      const store = useBackupStore();

      await expect(store.restoreSnapshot(5)).rejects.toBeInstanceOf(InvalidSnapshotError);
      expect(store.isRestoring).toBe(false);
    });

    it('lets a failed pre-restore restore point abort before anything is cleared', async () => {
      vi.mocked(writeSnapshot).mockRejectedValue(new Error('boom'));
      const store = useBackupStore();

      await expect(store.restoreSnapshot(5)).rejects.toBeInstanceOf(BackupFailedError);
      expect(importBusinessData).not.toHaveBeenCalled();
    });
  });

  it('deleteSnapshot deletes it and reloads the list', async () => {
    const store = useBackupStore();
    await store.deleteSnapshot(3);
    expect(deleteSnapshot).toHaveBeenCalledWith(3);
    expect(listSnapshots).toHaveBeenCalled();
  });

  it('downloadSnapshot saves the export format under locapilot-restore-point-<date>.json', async () => {
    vi.mocked(getSnapshot).mockResolvedValue(
      stored(5, { createdAt: new Date(2026, 10, 10, 9, 0) })
    );
    vi.mocked(getSnapshotTables).mockResolvedValue(rowsFor(5, { properties: [property()] }));
    let saved: Blob | null = null;
    let fileName = '';
    const createObjectURL = vi.fn((blob: Blob) => {
      saved = blob;
      return 'blob:restore-point';
    });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      fileName = this.download;
    });
    const store = useBackupStore();

    await store.downloadSnapshot(5);

    expect(click).toHaveBeenCalled();
    expect(fileName).toBe('locapilot-restore-point-2026-11-10.json');
    expect(saved).not.toBeNull();
    const json = JSON.parse(await (saved as unknown as Blob).text());
    expect(json.version).toBe('1.2.0');
    expect(json.properties).toHaveLength(1);
    expect(json.expenses).toEqual([]);
    vi.unstubAllGlobals();
    click.mockRestore();
  });
});
