import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useTenantDocuments } from '../composables/useTenantDocuments';
import type { Tenant } from '@/db/types';
import {
  createTenant as createTenantRepo,
  deleteTenant as deleteTenantRepo,
  fetchAllTenants,
  fetchTenantById as fetchTenantByIdRepo,
  updateTenant as updateTenantRepo,
  updateTenantStatus as updateTenantStatusRepo,
} from '../repositories/tenantsRepository';
import { addTenantAudit as addTenantAuditRepo } from '../repositories/tenantAuditsRepository';
import { resolveTenantStatusTransition } from '../services/tenantsService';

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
      tenants.value = await fetchAllTenants();
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
      currentTenant.value = (await fetchTenantByIdRepo(id)) || null;
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
      const id = await createTenantRepo(data);
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
      await updateTenantRepo(id, data);
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
      await deleteTenantRepo(id);
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
      return await useTenantDocuments().getTenantDocuments(tenantId);
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
      const id = await addTenantAuditRepo(audit);
      return id;
    } catch (err) {
      console.error('Failed to add tenant audit:', err);
      throw err;
    }
  }

  // Default rejection message template
  const DEFAULT_REJECTION_MESSAGE = `Bonjour Monsieur,

J'ai recu énormément de réponse à mon annonce et l'appartement a déjà été loué.  Je suis désolé de ne pas pouvoir satisfaire votre demande.
j'espère que vous trouverez rapidement une location qui vous convient.

Cordialement, `;

  function getDefaultRejectionMessage() {
    return DEFAULT_REJECTION_MESSAGE;
  }

  async function setTenantStatusWithAudit(
    tenantId: number,
    status: Tenant['status'] | 'validated' | 'refused',
    auditData?: { actorId?: number | null; reason?: string; documentIds?: number[] }
  ) {
    isLoading.value = true;
    try {
      const { newStatus, auditAction } = resolveTenantStatusTransition(status);
      // update tenant status
      await updateTenantStatusRepo(tenantId, newStatus);
      // add audit entry
      await addTenantAudit({
        tenantId,
        action: auditAction,
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
    getDefaultRejectionMessage,
    clearError,
  };
});
