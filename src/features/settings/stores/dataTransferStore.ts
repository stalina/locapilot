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
  type ExportDataPayload,
} from '../services/dataTransferService';
import { validateImportPayload } from '../services/importValidationService';

export const useDataTransferStore = defineStore('dataTransfer', () => {
  const isExporting = ref(false);
  const isImporting = ref(false);
  const error = ref<string | null>(null);

  async function buildExportPayload(
    version: string
  ): Promise<{ json: string; data: ExportDataPayload }> {
    const raw = await fetchRawExportData();
    const documents = await serializeDocuments(raw.documents as any);
    const tenantDocuments = await serializeTenantDocuments(raw.tenantDocuments as any);

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

  async function importFromObject(data: unknown): Promise<void> {
    isImporting.value = true;
    error.value = null;
    try {
      // Strict per-record validation of every table (issue #80, C2). This MUST
      // happen — and throw — BEFORE any clear()/bulkAdd() reaches the database.
      // Both import channels (JSON file and P2P sync) go through this method,
      // so they share this single validated path.
      const validated = validateImportPayload(data);

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

  async function clearAllBusinessData(): Promise<void> {
    await clearBusinessData();
  }

  return { isExporting, isImporting, error, exportData, importFromObject, clearAllBusinessData };
});
