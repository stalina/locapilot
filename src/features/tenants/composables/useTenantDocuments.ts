import { ref } from 'vue';
import { db } from '@/db/database';
import type { TenantDocument } from '@/db/types';

export function useTenantDocuments() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function getTenantDocuments(tenantId: number): Promise<TenantDocument[]> {
    try {
      const docs = await db.tenantDocuments.where({ tenantId }).sortBy('uploadedAt');
      return docs;
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
      const now = new Date();
      // First create a global document entry so it appears in DocumentsView
      const globalDoc: Omit<import('@/db/types').Document, 'id'> = {
        name: file.name,
        type: 'other',
        relatedEntityType: 'tenant',
        relatedEntityId: tenantId,
        mimeType: file.type,
        size: file.size,
        data: file.slice(),
        description: notes,
        createdAt: now,
        updatedAt: now,
      };

      const globalId = await db.documents.add(globalDoc as any);

      const tenantDoc: Omit<TenantDocument, 'id'> = {
        tenantId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
        data: file.slice(),
        notes,
        uploadedAt: now,
        documentId: globalId as number,
      };

      const id = await db.tenantDocuments.add(tenantDoc as TenantDocument);
      const created = await db.tenantDocuments.get(id as number);
      return created || null;
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
      const td = await db.tenantDocuments.get(documentId);
      if (td?.documentId) {
        await db.documents.delete(td.documentId);
      }
      await db.tenantDocuments.delete(documentId);
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
