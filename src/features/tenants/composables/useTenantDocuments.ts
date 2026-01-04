import { ref } from 'vue';
import type { TenantDocument } from '@/db/types';
import {
  addTenantDocument as addTenantDocumentRepo,
  listTenantDocuments,
  removeTenantDocument as removeTenantDocumentRepo,
} from '../repositories/tenantDocumentsRepository';

export function useTenantDocuments() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function getTenantDocuments(tenantId: number): Promise<TenantDocument[]> {
    try {
      return await listTenantDocuments(tenantId);
    } catch (e) {
      console.error('Failed to fetch tenant documents:', e);
      return [];
    }
  }

  async function addTenantDocument(
    tenantId: number,
    file: File,
    notes?: string
  ): Promise<TenantDocument | null> {
    isLoading.value = true;
    error.value = null;
    try {
      return await addTenantDocumentRepo({ tenantId, file, notes });
    } catch (e) {
      console.error('Failed to add tenant document:', e);
      error.value = e instanceof Error ? e.message : 'Failed to add document';
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  async function removeTenantDocument(documentId: number): Promise<void> {
    isLoading.value = true;
    error.value = null;
    try {
      await removeTenantDocumentRepo(documentId);
    } catch (e) {
      console.error('Failed to remove tenant document:', e);
      error.value = e instanceof Error ? e.message : 'Failed to remove document';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  function createDocUrl(data: unknown): string {
    if (!data) return '';
    if (data instanceof Blob) return URL.createObjectURL(data);
    if (data instanceof ArrayBuffer) return URL.createObjectURL(new Blob([data]));
    if (typeof data === 'string') {
      if (data.startsWith('data:')) return data;
      try {
        const binary = atob(data);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes]));
      } catch {
        return '';
      }
    }
    return '';
  }

  function revokeDocUrl(url: string) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  return {
    isLoading,
    error,
    getTenantDocuments,
    addTenantDocument,
    removeTenantDocument,
    createDocUrl,
    revokeDocUrl,
  };
}
