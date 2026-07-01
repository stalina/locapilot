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
      validateExportDataShape(data);

      const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

      const docs = asArray((data as any).documents);
      const docsToAdd = deserializeDocuments(docs);
      const tenantDocs = asArray((data as any).tenantDocuments);
      const tenantDocsToAdd = deserializeTenantDocuments(tenantDocs);

      await importBusinessData({
        properties: (data as any).properties,
        tenants: (data as any).tenants,
        leases: (data as any).leases,
        rents: (data as any).rents,
        documents: docsToAdd,
        tenantDocuments: tenantDocsToAdd,
        tenantAudits: asArray((data as any).tenantAudits),
        inventories: (data as any).inventories,
        communications: asArray((data as any).communications),
        chargesAdjustments: asArray((data as any).chargesAdjustments),
        irlIndices: asArray((data as any).irlIndices),
        rentRevisions: asArray((data as any).rentRevisions),
        reminders: asArray((data as any).reminders),
        settings: asArray((data as any).settings),
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
