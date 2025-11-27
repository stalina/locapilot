import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '@/db/database';
import type { Inventory } from '@/db/types';

export const useInventoriesStore = defineStore('inventories', () => {
  // State
  const inventories = ref<Inventory[]>([]);
  const currentInventory = ref<Inventory | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const checkInInventories = computed(() =>
    inventories.value.filter(i => i.type === 'checkin')
  );

  const checkOutInventories = computed(() =>
    inventories.value.filter(i => i.type === 'checkout')
  );

  const getInventoriesByLease = computed(() => (leaseId: number) =>
    inventories.value.filter(i => i.leaseId === leaseId)
  );

  // Actions
  async function fetchInventories() {
    isLoading.value = true;
    error.value = null;
    try {
      inventories.value = await db.inventories.toArray();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch inventories';
      console.error('Failed to fetch inventories:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchInventoryById(id: number) {
    isLoading.value = true;
    error.value = null;
    try {
      currentInventory.value = (await db.inventories.get(id)) || null;
      if (!currentInventory.value) {
        error.value = 'Inventory not found';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch inventory';
      console.error('Failed to fetch inventory:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function createInventory(data: Omit<Inventory, 'id' | 'createdAt' | 'updatedAt'>) {
    isLoading.value = true;
    error.value = null;
    try {
      const id = await db.inventories.add({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await fetchInventories();
      return id;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create inventory';
      console.error('Failed to create inventory:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateInventory(id: number, data: Partial<Omit<Inventory, 'id' | 'createdAt'>>) {
    isLoading.value = true;
    error.value = null;
    try {
      await db.inventories.update(id, {
        ...data,
        updatedAt: new Date(),
      });
      await fetchInventories();
      
      if (currentInventory.value?.id === id) {
        await fetchInventoryById(id);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update inventory';
      console.error('Failed to update inventory:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteInventory(id: number) {
    isLoading.value = true;
    error.value = null;
    try {
      await db.inventories.delete(id);
      await fetchInventories();
      
      if (currentInventory.value?.id === id) {
        currentInventory.value = null;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete inventory';
      console.error('Failed to delete inventory:', err);
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
    inventories,
    currentInventory,
    isLoading,
    error,
    // Getters
    checkInInventories,
    checkOutInventories,
    getInventoriesByLease,
    // Actions
    fetchInventories,
    fetchInventoryById,
    createInventory,
    updateInventory,
    deleteInventory,
    clearError,
  };
});
