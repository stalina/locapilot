import { describe, it, expect, vi } from 'vitest';
import {
  AUTO_BACKUP_INTERVAL_MS,
  BackupFailedError,
  CONTINUE_WITHOUT_RESTORE_POINT_PROMPT,
  INVALID_SNAPSHOT_MESSAGE,
  InvalidSnapshotError,
  estimateSnapshotBytes,
  formatMegabytes,
  hasStorageFor,
  isAutoBackupDue,
  isDatabaseEmpty,
  isQuotaError,
  isStoragePersisted,
  requestPersistentStorage,
  runWithRestorePointFallback,
  selectSnapshotsToDelete,
  snapshotFileName,
  snapshotTablesToRecords,
  snapshotToExportPayload,
  snapshotToImportPayload,
  triggerLabel,
  type BackupSnapshot,
  type BackupTrigger,
} from './backupService';
import { SYNC_TABLES, type SyncTableName } from './dataTransferService';
import { validateImportPayload } from './importValidationService';

const HOUR = 60 * 60 * 1000;

function zeroCounts(overrides: Partial<Record<SyncTableName, number>> = {}) {
  const counts = Object.fromEntries(SYNC_TABLES.map(t => [t, 0])) as Record<SyncTableName, number>;
  return { ...counts, ...overrides };
}

/** Counts of a restore point taken before the expenses module (issue #47). */
function withoutExpenses(counts: Record<SyncTableName, number>): Record<SyncTableName, number> {
  return Object.fromEntries(
    Object.entries(counts).filter(([table]) => table !== 'expenses')
  ) as Record<SyncTableName, number>;
}

function snap(id: number, trigger: BackupTrigger, hoursAgo: number) {
  return { id, trigger, createdAt: new Date(Date.UTC(2026, 10, 14) - hoursAgo * HOUR) };
}

const iso = '2026-01-01T00:00:00.000Z';
const property = {
  id: 1,
  name: 'Appartement',
  address: '1 rue',
  type: 'apartment',
  surface: 40,
  rooms: 2,
  rent: 700,
  status: 'vacant',
  createdAt: new Date(iso),
  updatedAt: new Date(iso),
};

describe('backupService', () => {
  describe('triggerLabel', () => {
    it.each([
      ['auto', 'Automatique'],
      ['manual', 'Manuel'],
      ['pre-import', 'Avant import'],
      ['pre-sync', 'Avant synchronisation'],
      ['pre-clear', 'Avant effacement'],
      ['pre-restore', 'Avant restauration'],
    ] as const)('labels %s as "%s"', (trigger, label) => {
      expect(triggerLabel(trigger)).toBe(label);
    });
  });

  describe('isDatabaseEmpty', () => {
    it('is true when every table is empty', () => {
      expect(isDatabaseEmpty(zeroCounts())).toBe(true);
    });

    it('counts a settings-only database as empty', () => {
      expect(isDatabaseEmpty(zeroCounts({ settings: 4 }))).toBe(true);
    });

    it('is false as soon as one business table has records', () => {
      expect(isDatabaseEmpty(zeroCounts({ expenses: 1 }))).toBe(false);
      expect(isDatabaseEmpty(zeroCounts({ properties: 3 }))).toBe(false);
    });

    it('treats missing counts as zero', () => {
      expect(isDatabaseEmpty({})).toBe(true);
    });
  });

  describe('isAutoBackupDue', () => {
    const now = new Date('2026-11-14T12:00:00Z');

    it('is due when no automatic restore point exists', () => {
      expect(isAutoBackupDue(null, now)).toBe(true);
      expect(isAutoBackupDue(undefined, now)).toBe(true);
    });

    it('is not due 3 hours after the last one', () => {
      expect(isAutoBackupDue(new Date(now.getTime() - 3 * HOUR), now)).toBe(false);
    });

    it('is not due just before 24 hours', () => {
      expect(isAutoBackupDue(new Date(now.getTime() - AUTO_BACKUP_INTERVAL_MS + 1), now)).toBe(
        false
      );
    });

    it('is due at 24 hours and after', () => {
      expect(isAutoBackupDue(new Date(now.getTime() - AUTO_BACKUP_INTERVAL_MS), now)).toBe(true);
      expect(isAutoBackupDue(new Date(now.getTime() - 25 * HOUR), now)).toBe(true);
    });
  });

  describe('selectSnapshotsToDelete', () => {
    it('keeps the 7 most recent automatic restore points', () => {
      const existing = Array.from({ length: 7 }, (_, i) => snap(i + 1, 'auto', (i + 1) * 24));
      const manual = [snap(20, 'manual', 5), snap(21, 'manual', 6)];
      const created = snap(99, 'auto', 0);

      const deleted = selectSnapshotsToDelete([...existing, ...manual, created], 99);

      // The oldest automatic one (7 days ago, id 7) goes; the manual ones stay.
      expect(deleted).toEqual([7]);
    });

    it('keeps the 5 most recent of the other triggers, as one shared pool', () => {
      const others = [
        snap(1, 'manual', 50),
        snap(2, 'pre-import', 40),
        snap(3, 'pre-sync', 30),
        snap(4, 'pre-clear', 20),
        snap(5, 'pre-restore', 10),
      ];
      const autos = [snap(10, 'auto', 1), snap(11, 'auto', 25), snap(12, 'auto', 49)];
      const created = snap(99, 'pre-import', 0);

      const deleted = selectSnapshotsToDelete([...others, ...autos, created], 99);

      expect(deleted).toEqual([1]);
    });

    it('never deletes the new restore point, even with an older date', () => {
      const existing = Array.from({ length: 7 }, (_, i) => snap(i + 1, 'auto', i));
      // Clock skew: the new one looks older than all the others.
      const created = snap(99, 'auto', 1000);

      const deleted = selectSnapshotsToDelete([...existing, created], 99);

      expect(deleted).not.toContain(99);
      expect(deleted).toEqual([7]);
    });

    it('deletes nothing below the limits', () => {
      const all = [snap(1, 'auto', 1), snap(2, 'manual', 2), snap(3, 'auto', 0)];
      expect(selectSnapshotsToDelete(all, 3)).toEqual([]);
    });

    it('keeps the pools independent', () => {
      // 7 automatic + 5 other restore points: a new manual one only rotates
      // the other pool, even though the automatic ones are older.
      const autos = Array.from({ length: 7 }, (_, i) => snap(i + 1, 'auto', 100 + i));
      const others = Array.from({ length: 5 }, (_, i) => snap(i + 20, 'pre-sync', i + 1));
      const created = snap(99, 'manual', 0);

      expect(selectSnapshotsToDelete([...autos, ...others, created], 99)).toEqual([24]);
    });

    it('never deletes a protected id and still shrinks the pool to 5', () => {
      // The restore point being restored (id 2) is the oldest non-automatic one.
      const others = [
        snap(2, 'manual', 50),
        snap(3, 'pre-clear', 40),
        snap(4, 'pre-restore', 30),
        snap(5, 'manual', 20),
        snap(6, 'manual', 10),
      ];
      const created = snap(7, 'pre-restore', 0);
      const all = [...others, created];

      const deleted = selectSnapshotsToDelete(all, 7, [2]);

      // The next-oldest one goes instead.
      expect(deleted).toEqual([3]);
      const remaining = all.map(s => s.id).filter(id => !deleted.includes(id));
      expect(remaining.sort((a, b) => a - b)).toEqual([2, 4, 5, 6, 7]);
    });

    it('counts several protected ids as kept ones', () => {
      const others = Array.from({ length: 5 }, (_, i) => snap(i + 1, 'manual', 50 - i));
      const created = snap(99, 'pre-restore', 0);

      // Ids 1 and 2 are the two oldest: 3 goes, the pool ends at 5.
      expect(selectSnapshotsToDelete([...others, created], 99, [1, 2])).toEqual([3]);
    });

    it('protects an automatic restore point without rotating the other pool', () => {
      const autos = Array.from({ length: 7 }, (_, i) => snap(i + 1, 'auto', 100 + i));
      const others = Array.from({ length: 5 }, (_, i) => snap(i + 20, 'manual', i + 1));
      const created = snap(99, 'pre-restore', 0);

      // Restoring the oldest auto point (id 7): only the other pool rotates.
      expect(selectSnapshotsToDelete([...autos, ...others, created], 99, [7])).toEqual([24]);
    });

    it('ignores protected ids that do not exist', () => {
      const all = [snap(1, 'manual', 2), snap(2, 'manual', 1), snap(3, 'manual', 0)];
      expect(selectSnapshotsToDelete(all, 3, [42])).toEqual([]);
    });
  });

  describe('estimateSnapshotBytes', () => {
    it('adds the Blob bytes and an allowance per record', () => {
      expect(estimateSnapshotBytes(zeroCounts({ properties: 2, rents: 3 }), 1000)).toBe(
        1000 + 5 * 2048
      );
    });
  });

  describe('snapshotTablesToRecords', () => {
    it('returns every table, missing ones (older versions) as empty arrays', () => {
      const counts = zeroCounts({ properties: 1 });
      const olderCounts = withoutExpenses(counts);
      const tables = SYNC_TABLES.filter(t => t !== 'expenses').map(table => ({
        table,
        records: table === 'properties' ? [property] : [],
      }));

      const records = snapshotTablesToRecords({ counts: olderCounts }, tables);

      expect(records.properties).toEqual([property]);
      expect(records.expenses).toEqual([]);
      expect(Object.keys(records).sort()).toEqual([...SYNC_TABLES].sort());
    });

    it('rejects a table whose stored records do not match its count', () => {
      expect(() =>
        snapshotTablesToRecords({ counts: zeroCounts({ properties: 2 }) }, [
          { table: 'properties', records: [property] },
        ])
      ).toThrow(InvalidSnapshotError);
    });

    it('rejects a table announced with records but not stored', () => {
      expect(() => snapshotTablesToRecords({ counts: zeroCounts({ tenants: 1 }) }, [])).toThrow(
        INVALID_SNAPSHOT_MESSAGE
      );
    });

    it('rejects a table the current version does not know', () => {
      expect(() =>
        snapshotTablesToRecords({ counts: zeroCounts() }, [{ table: 'unicorns', records: [] }])
      ).toThrow(InvalidSnapshotError);
    });

    it('rejects a table stored twice', () => {
      expect(() =>
        snapshotTablesToRecords({ counts: zeroCounts() }, [
          { table: 'rents', records: [] },
          { table: 'rents', records: [] },
        ])
      ).toThrow(InvalidSnapshotError);
    });
  });

  describe('snapshotToImportPayload', () => {
    it('keeps document Blobs as Blobs and passes the strict validation', () => {
      const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/pdf' });
      const document = {
        id: 1,
        name: 'bail.pdf',
        type: 'lease',
        mimeType: 'application/pdf',
        size: 3,
        data: blob,
        createdAt: new Date(iso),
        updatedAt: new Date(iso),
      };
      const snapshot = {
        counts: zeroCounts({ properties: 1, documents: 1 }),
        appVersion: '1.2.0',
        createdAt: new Date('2026-11-10T08:00:00Z'),
      };

      const payload = snapshotToImportPayload(snapshot, [
        { table: 'properties', records: [property] },
        { table: 'documents', records: [document] },
      ]);

      expect(payload.version).toBe('1.2.0');
      expect(payload.exportedAt).toBe('2026-11-10T08:00:00.000Z');
      expect((payload.documents[0] as { data: unknown }).data).toBe(blob);
      expect(() => validateImportPayload(payload)).not.toThrow();
    });
  });

  describe('snapshotToExportPayload', () => {
    it('builds the manual export format, documents as data URLs, missing tables as []', async () => {
      const blob = new Blob([new Uint8Array([104, 105])], { type: 'text/plain' });
      const counts = zeroCounts({ properties: 1, tenantDocuments: 1 });
      const olderCounts = withoutExpenses(counts);
      const snapshot = {
        counts: olderCounts,
        appVersion: '1.1.0',
        createdAt: new Date('2026-11-10T08:00:00Z'),
      };

      const payload = await snapshotToExportPayload(snapshot, [
        { table: 'properties', records: [property] },
        {
          table: 'tenantDocuments',
          records: [
            {
              id: 1,
              tenantId: 1,
              name: 'cni.txt',
              mimeType: 'text/plain',
              size: 2,
              data: blob,
              createdAt: new Date(iso),
              updatedAt: new Date(iso),
            },
          ],
        },
      ]);

      expect(payload.version).toBe('1.1.0');
      expect(payload.exportedAt).toBe('2026-11-10T08:00:00.000Z');
      expect(payload.properties).toEqual([property]);
      expect(payload.expenses).toEqual([]);
      expect(payload.documents).toEqual([]);
      expect(payload.tenantDocuments[0]?.data).toBe('data:text/plain;base64,aGk=');
    });
  });

  describe('snapshotFileName', () => {
    it('uses the local creation date', () => {
      expect(snapshotFileName(new Date(2026, 10, 10, 23, 30))).toBe(
        'locapilot-restore-point-2026-11-10.json'
      );
    });
  });

  describe('formatMegabytes', () => {
    it('formats bytes in Mo', () => {
      expect(formatMegabytes(48 * 1024 * 1024)).toBe('48');
      expect(formatMegabytes(0)).toBe('0');
      expect(formatMegabytes(1.5 * 1024 * 1024)).toBe('1,5');
    });
  });

  describe('isQuotaError', () => {
    it('detects a QuotaExceededError, also wrapped by Dexie', () => {
      expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
      expect(isQuotaError({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toBe(
        true
      );
      expect(isQuotaError(new Error('boom'))).toBe(false);
      expect(isQuotaError(null)).toBe(false);
    });
  });

  describe('BackupFailedError', () => {
    it('carries the reason and a French message', () => {
      const quota = new BackupFailedError('quota');
      expect(quota.reason).toBe('quota');
      expect(quota.message).toBe(
        'Espace de stockage insuffisant pour créer un point de restauration'
      );
      expect(new BackupFailedError('unavailable').message).toBe(
        'Points de restauration indisponibles sur ce navigateur'
      );
      const cause = new Error('dexie');
      const failed = new BackupFailedError('failed', { cause });
      expect(failed.origin).toBe(cause);
      expect(failed).toBeInstanceOf(Error);
    });
  });

  describe('storage checks', () => {
    it('hasStorageFor compares the free quota with the required size', async () => {
      const storage = { estimate: vi.fn(async () => ({ quota: 1000, usage: 400 })) };
      expect(await hasStorageFor(600, storage)).toBe(true);
      expect(await hasStorageFor(601, storage)).toBe(false);
    });

    it('hasStorageFor allows the write when the estimate is unsupported or fails', async () => {
      expect(await hasStorageFor(10, undefined)).toBe(true);
      expect(await hasStorageFor(10, {})).toBe(true);
      expect(await hasStorageFor(10, { estimate: vi.fn(async () => ({})) })).toBe(true);
      expect(
        await hasStorageFor(10, {
          estimate: vi.fn(async () => {
            throw new Error('nope');
          }),
        })
      ).toBe(true);
    });

    it('requestPersistentStorage returns the browser answer, null when unsupported', async () => {
      expect(await requestPersistentStorage({ persist: vi.fn(async () => true) })).toBe(true);
      expect(await requestPersistentStorage({ persist: vi.fn(async () => false) })).toBe(false);
      expect(await requestPersistentStorage({})).toBeNull();
      expect(
        await requestPersistentStorage({
          persist: vi.fn(async () => {
            throw new Error('nope');
          }),
        })
      ).toBeNull();
    });

    it('isStoragePersisted returns the browser answer, null when unsupported', async () => {
      expect(await isStoragePersisted({ persisted: vi.fn(async () => true) })).toBe(true);
      expect(await isStoragePersisted(undefined)).toBeNull();
      expect(
        await isStoragePersisted({
          persisted: vi.fn(async () => {
            throw new Error('nope');
          }),
        })
      ).toBeNull();
    });
  });

  describe('runWithRestorePointFallback', () => {
    it('runs the operation once with the restore point when it succeeds', async () => {
      const operation = vi.fn(async (skip: boolean) => (skip ? 'skipped' : 'with'));
      const ask = vi.fn(() => true);

      expect(await runWithRestorePointFallback(operation, ask)).toEqual({
        status: 'done',
        result: 'with',
      });
      expect(operation).toHaveBeenCalledTimes(1);
      expect(ask).not.toHaveBeenCalled();
    });

    it('asks, then stops without retrying when the user declines', async () => {
      const operation = vi.fn(async () => {
        throw new BackupFailedError('quota');
      });
      const ask = vi.fn(() => false);

      expect(await runWithRestorePointFallback(operation, ask)).toEqual({ status: 'declined' });
      expect(ask).toHaveBeenCalledWith(CONTINUE_WITHOUT_RESTORE_POINT_PROMPT);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('retries without a restore point when the user continues', async () => {
      const operation = vi.fn(async (skip: boolean) => {
        if (!skip) throw new BackupFailedError('unavailable');
        return 'done-without';
      });

      expect(await runWithRestorePointFallback(operation, () => true)).toEqual({
        status: 'done',
        result: 'done-without',
      });
      expect(operation).toHaveBeenNthCalledWith(2, true);
    });

    it('rethrows any other error without asking', async () => {
      const ask = vi.fn(() => true);
      await expect(
        runWithRestorePointFallback(async () => {
          throw new Error('invalid');
        }, ask)
      ).rejects.toThrow('invalid');
      expect(ask).not.toHaveBeenCalled();
    });
  });

  it('BackupSnapshot type accepts the stored metadata shape', () => {
    const meta: BackupSnapshot = {
      createdAt: new Date(),
      trigger: 'manual',
      appVersion: '1.2.0',
      schemaVersion: 12,
      counts: zeroCounts(),
      totalBytes: 0,
    };
    expect(meta.trigger).toBe('manual');
  });
});
