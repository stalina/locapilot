import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '@/db/database';
import { useTenantDocuments } from '../composables/useTenantDocuments';
import type { Tenant } from '@/db/types';

export const useTenantsStore = defineStore('tenants', () => {
  // State
  const tenants = ref<Tenant[]>([]);
  const currentTenant = ref<Tenant | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const activeTenants = computed(() => tenants.value.filter(t => t.status === 'active'));

  const candidateTenants = computed(() => tenants.value.filter(t => t.status === 'candidate'));

  const formerTenants = computed(() => tenants.value.filter(t => t.status === 'former'));

  const refusedTenants = computed(() =>
    tenants.value.filter(t => t.status === 'candidature-refusee')
  );

  const tenantsCount = computed(() => tenants.value.length);

  // Actions
  async function fetchTenants() {
    isLoading.value = true;
    error.value = null;
    try {
      tenants.value = await db.tenants.toArray();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch tenants';
      console.error('Failed to fetch tenants:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchTenantById(id: number) {
    isLoading.value = true;
    error.value = null;
    try {
      currentTenant.value = (await db.tenants.get(id)) || null;
      if (!currentTenant.value) {
        error.value = 'Tenant not found';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch tenant';
      console.error('Failed to fetch tenant:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function createTenant(data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) {
    isLoading.value = true;
    error.value = null;
    try {
      const id = await db.tenants.add({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await fetchTenants();
      return id;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create tenant';
      console.error('Failed to create tenant:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateTenant(id: number, data: Partial<Omit<Tenant, 'id' | 'createdAt'>>) {
    isLoading.value = true;
    error.value = null;
    try {
      await db.tenants.update(id, {
        ...data,
        updatedAt: new Date(),
      });
      await fetchTenants();

      if (currentTenant.value?.id === id) {
        await fetchTenantById(id);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update tenant';
      console.error('Failed to update tenant:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteTenant(id: number) {
    isLoading.value = true;
    error.value = null;
    try {
      await db.tenants.delete(id);
      await fetchTenants();

      if (currentTenant.value?.id === id) {
        currentTenant.value = null;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete tenant';
      console.error('Failed to delete tenant:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  // Tenant documents & audits helpers
  async function listTenantDocuments(tenantId: number) {
    try {
      return await db.tenantDocuments.where({ tenantId }).sortBy('uploadedAt');
    } catch (err) {
      console.error('Failed to list tenant documents:', err);
      throw err;
    }
  }

  async function addTenantDocument(
    tenantId: number,
    doc: {
      name: string;
      mimeType: string;
      size: number;
      data?: Blob;
      notes?: string;
    }
  ) {
    // Delegate to composable to ensure global documents list is updated
    try {
      const { addTenantDocument: addDoc } = useTenantDocuments();
      // If raw Blob provided, create a File wrapper if possible
      let file: File | null = null;
      if (doc.data instanceof File) file = doc.data;
      else if (doc.data instanceof Blob)
        file = new File([doc.data], doc.name, { type: doc.mimeType });

      if (!file) {
        // Create an empty File-like object using Blob
        file = new File([new Blob()], doc.name, { type: doc.mimeType });
      }

      const created = await addDoc(tenantId, file, doc.notes);
      return created?.id;
    } catch (err) {
      console.error('Failed to add tenant document (store):', err);
      throw err;
    }
  }

  async function removeTenantDocument(id: number) {
    try {
      const { removeTenantDocument: removeDoc } = useTenantDocuments();
      await removeDoc(id);
    } catch (err) {
      console.error('Failed to remove tenant document (store):', err);
      throw err;
    }
  }

  async function addTenantAudit(audit: {
    tenantId: number;
    action: 'validated' | 'refused' | 'created' | 'updated';
    actorId?: number | null;
    reason?: string;
    documentIds?: number[];
  }) {
    try {
      const id = await db.tenantAudits.add({
        tenantId: audit.tenantId,
        action: audit.action,
        actorId: audit.actorId ?? null,
        reason: audit.reason,
        documentIds: audit.documentIds || [],
        timestamp: new Date(),
      });
      return id;
    } catch (err) {
      console.error('Failed to add tenant audit:', err);
      throw err;
    }
  }

  async function setTenantStatusWithAudit(
    tenantId: number,
    status: Tenant['status'] | 'validated' | 'refused',
    auditData?: { actorId?: number | null; reason?: string; documentIds?: number[] }
  ) {
    isLoading.value = true;
    try {
      const newStatus =
        status === 'validated' ? 'active' : status === 'refused' ? 'candidature-refusee' : status;
      // update tenant status
      await db.tenants.update(tenantId, { status: newStatus, updatedAt: new Date() });
      // add audit entry
      await addTenantAudit({
        tenantId,
        action: status === 'validated' ? 'validated' : status === 'refused' ? 'refused' : 'updated',
        actorId: auditData?.actorId ?? null,
        reason: auditData?.reason,
        documentIds: auditData?.documentIds,
      });
      await fetchTenants();
      if (currentTenant.value?.id === tenantId) {
        await fetchTenantById(tenantId);
      }
    } catch (err) {
      console.error('Failed to set tenant status with audit:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  function clearError() {
    error.value = null;
  }

  return {
    // State
    tenants,
    currentTenant,
    isLoading,
    error,
    // Getters
    activeTenants,
    candidateTenants,
    refusedTenants,
    formerTenants,
    tenantsCount,
    // Actions
    fetchTenants,
    fetchTenantById,
    createTenant,
    updateTenant,
    deleteTenant,
    // Documents & audits
    listTenantDocuments,
    addTenantDocument,
    removeTenantDocument,
    addTenantAudit,
    setTenantStatusWithAudit,
    clearError,
  };
});
