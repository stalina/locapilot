import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  fetchRawExportData,
  importBusinessData,
  clearBusinessData,
} from '../repositories/dataTransferRepository';
import {
  deserializeDocuments,
  deserializeTenantDocuments,
  serializeDocuments,
  serializeTenantDocuments,
  createSyncSource,
  type ExportDataPayload,
  type SyncSource,
} from '../services/dataTransferService';
import { validateImportPayload } from '../services/importValidationService';
import type { BackupTrigger } from '../services/backupService';
import { useBackupStore } from './backupStore';

/**
 * Restore point taken before a destructive operation (issue #59): after the
 * user confirmed and the data passed validation, before the first clear().
 * `skipSnapshot` is set when the user chose to continue without one.
 * `keepSnapshotIds` are never rotated out by that restore point (the restore
 * point being restored must survive until the import succeeded).
 */
export interface RestorePointOptions {
  snapshotTrigger?: BackupTrigger;
  skipSnapshot?: boolean;
  keepSnapshotIds?: ReadonlyArray<number>;
}

export type ClearResult = 'restore-point-created' | 'no-restore-point';

export const useDataTransferStore = defineStore('dataTransfer', () => {
  const isExporting = ref(false);
  const isImporting = ref(false);
  const error = ref<string | null>(null);

  async function buildExportPayload(
    version: string
  ): Promise<{ json: string; data: ExportDataPayload }> {
    const raw = await fetchRawExportData();
    const documents = await serializeDocuments(raw.documents);
    const tenantDocuments = await serializeTenantDocuments(raw.tenantDocuments);

    const data: ExportDataPayload = {
      properties: raw.properties,
      tenants: raw.tenants,
      leases: raw.leases,
      rents: raw.rents,
      documents,
      tenantDocuments,
      tenantAudits: raw.tenantAudits,
      inventories: raw.inventories,
      communications: raw.communications,
      chargesAdjustments: raw.chargesAdjustments,
      irlIndices: raw.irlIndices,
      rentRevisions: raw.rentRevisions,
      reminders: raw.reminders,
      expenses: raw.expenses,
      settings: raw.settings,
      exportedAt: new Date().toISOString(),
      version,
    };

    const json = JSON.stringify(data, null, 2);
    return { json, data };
  }

  async function exportData(version: string): Promise<{ json: string }> {
    isExporting.value = true;
    error.value = null;
    try {
      const { json } = await buildExportPayload(version);
      return { json };
    } catch (e) {
      console.error('Export error:', e);
      error.value = "Erreur lors de l'export";
      throw e;
    } finally {
      isExporting.value = false;
    }
  }

  /**
   * P2P sync source (issue #122): the raw tables WITHOUT serializeDocuments —
   * document Blobs are kept as they are and streamed in chunks by
   * PeerSyncService. Never builds the whole database as one JSON string.
   */
  async function buildSyncSource(version: string): Promise<SyncSource> {
    const raw = await fetchRawExportData();
    return createSyncSource(
      {
        properties: raw.properties,
        tenants: raw.tenants,
        leases: raw.leases,
        rents: raw.rents,
        documents: raw.documents,
        tenantDocuments: raw.tenantDocuments,
        tenantAudits: raw.tenantAudits,
        inventories: raw.inventories,
        communications: raw.communications,
        chargesAdjustments: raw.chargesAdjustments,
        irlIndices: raw.irlIndices,
        rentRevisions: raw.rentRevisions,
        reminders: raw.reminders,
        expenses: raw.expenses,
        settings: raw.settings,
      },
      version
    );
  }

  async function importFromObject(data: unknown, options: RestorePointOptions = {}): Promise<void> {
    isImporting.value = true;
    error.value = null;
    try {
      // Strict per-record validation of every table (issue #80, C2). This MUST
      // happen — and throw — BEFORE any clear()/bulkAdd() reaches the database.
      // Every import channel (JSON file, P2P sync, restore point) goes through
      // this method, so they share this single validated path.
      const validated = validateImportPayload(data);

      // Restore point of the current data (issue #59), only once the incoming
      // data is known to be valid. Throws BackupFailedError when it fails, so
      // nothing is cleared unless the caller retries with skipSnapshot.
      if (options.snapshotTrigger && !options.skipSnapshot) {
        await useBackupStore().createSnapshot(options.snapshotTrigger, {
          keepIds: options.keepSnapshotIds,
        });
      }

      const docsToAdd = deserializeDocuments(validated.documents);
      const tenantDocsToAdd = deserializeTenantDocuments(validated.tenantDocuments);

      await importBusinessData({
        properties: validated.properties,
        tenants: validated.tenants,
        leases: validated.leases,
        rents: validated.rents,
        documents: docsToAdd,
        tenantDocuments: tenantDocsToAdd,
        tenantAudits: validated.tenantAudits,
        inventories: validated.inventories,
        communications: validated.communications,
        chargesAdjustments: validated.chargesAdjustments,
        irlIndices: validated.irlIndices,
        rentRevisions: validated.rentRevisions,
        reminders: validated.reminders,
        expenses: validated.expenses,
        settings: validated.settings,
      });
    } catch (e) {
      console.error('Import error:', e);
      error.value = e instanceof Error ? e.message : "Erreur lors de l'import";
      throw e;
    } finally {
      isImporting.value = false;
    }
  }

  /**
   * "Tout effacer": take a `pre-clear` restore point first (issue #59), unless
   * the user chose to continue without one. Throws BackupFailedError — before
   * anything is cleared — when that restore point cannot be created.
   */
  async function clearAllBusinessData(
    options: Pick<RestorePointOptions, 'skipSnapshot'> = {}
  ): Promise<ClearResult> {
    let result: ClearResult = 'no-restore-point';
    if (!options.skipSnapshot) {
      const snapshot = await useBackupStore().createSnapshot('pre-clear');
      if (snapshot === 'created') result = 'restore-point-created';
    }
    await clearBusinessData();
    return result;
  }

  return {
    isExporting,
    isImporting,
    error,
    exportData,
    buildSyncSource,
    importFromObject,
    clearAllBusinessData,
  };
});
