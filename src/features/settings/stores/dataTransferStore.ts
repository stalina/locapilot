import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  fetchRawExportData,
  importBusinessData,
  clearBusinessData,
} from '../repositories/dataTransferRepository';
import {
  deserializeDocuments,
  serializeDocuments,
  validateExportDataShape,
  type ExportDataPayload,
} from '../services/dataTransferService';

export const useDataTransferStore = defineStore('dataTransfer', () => {
  const isExporting = ref(false);
  const isImporting = ref(false);
  const error = ref<string | null>(null);

  async function buildExportPayload(
    version: string
  ): Promise<{ json: string; data: ExportDataPayload }> {
    const raw = await fetchRawExportData();
    const documents = await serializeDocuments(raw.documents as any);

    const data: ExportDataPayload = {
      properties: raw.properties,
      tenants: raw.tenants,
      leases: raw.leases,
      rents: raw.rents,
      documents,
      inventories: raw.inventories,
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
      validateExportDataShape(data);

      const docs = Array.isArray((data as any).documents) ? (data as any).documents : [];
      const docsToAdd = deserializeDocuments(docs);

      await importBusinessData({
        properties: (data as any).properties,
        tenants: (data as any).tenants,
        leases: (data as any).leases,
        rents: (data as any).rents,
        documents: docsToAdd,
        inventories: (data as any).inventories,
      });
    } catch (e) {
      console.error('Import error:', e);
      error.value = "Erreur lors de l'import";
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
