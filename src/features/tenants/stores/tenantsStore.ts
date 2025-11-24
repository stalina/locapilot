import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '@db/schema';
import type { Tenant } from '@db/schema';

export const useTenantsStore = defineStore('tenants', () => {
  // State
  const tenants = ref<Tenant[]>([]);
  const currentTenant = ref<Tenant | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const activeTenants = computed(() =>
    tenants.value.filter(t => t.status === 'active')
  );

  const formerTenants = computed(() =>
    tenants.value.filter(t => t.status === 'former')
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
    formerTenants,
    tenantsCount,
    // Actions
    fetchTenants,
    fetchTenantById,
    createTenant,
    updateTenant,
    deleteTenant,
    clearError,
  };
});
