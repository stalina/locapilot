import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '@/db/database';
import type { Property } from '@/db/types';

export const usePropertiesStore = defineStore('properties', () => {
  // State
  const properties = ref<Property[]>([]);
  const currentProperty = ref<Property | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const occupiedProperties = computed(() =>
    properties.value.filter(p => p.status === 'occupied')
  );

  const vacantProperties = computed(() =>
    properties.value.filter(p => p.status === 'vacant')
  );

  const maintenanceProperties = computed(() =>
    properties.value.filter(p => p.status === 'maintenance')
  );

  const totalRevenue = computed(() =>
    occupiedProperties.value.reduce((sum, p) => sum + (p.rent || 0), 0)
  );

  const occupancyRate = computed(() => {
    const total = properties.value.length;
    if (total === 0) return 0;
    return Math.round((occupiedProperties.value.length / total) * 100 * 10) / 10;
  });

  const propertiesByType = computed(() => {
    return properties.value.reduce((acc, property) => {
      if (!acc[property.type]) {
        acc[property.type] = [];
      }
      acc[property.type].push(property);
      return acc;
    }, {} as Record<string, Property[]>);
  });

  // Actions
  async function fetchProperties() {
    isLoading.value = true;
    error.value = null;
    try {
      properties.value = await db.properties.toArray();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch properties';
      console.error('Failed to fetch properties:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchPropertyById(id: number) {
    isLoading.value = true;
    error.value = null;
    try {
      currentProperty.value = (await db.properties.get(id)) || null;
      if (!currentProperty.value) {
        error.value = 'Property not found';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch property';
      console.error('Failed to fetch property:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function createProperty(data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) {
    isLoading.value = true;
    error.value = null;
    try {
      const id = await db.properties.add({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await fetchProperties();
      return id;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create property';
      console.error('Failed to create property:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateProperty(id: number, data: Partial<Omit<Property, 'id' | 'createdAt'>>) {
    isLoading.value = true;
    error.value = null;
    try {
      await db.properties.update(id, {
        ...data,
        updatedAt: new Date(),
      });
      await fetchProperties();
      
      // Update current property if it's the one being updated
      if (currentProperty.value?.id === id) {
        await fetchPropertyById(id);
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update property';
      console.error('Failed to update property:', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteProperty(id: number) {
    isLoading.value = true;
    error.value = null;
    try {
      await db.properties.delete(id);
      await fetchProperties();
      
      // Clear current property if it's the one being deleted
      if (currentProperty.value?.id === id) {
        currentProperty.value = null;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete property';
      console.error('Failed to delete property:', err);
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
    properties,
    currentProperty,
    isLoading,
    error,
    // Getters
    occupiedProperties,
    vacantProperties,
    maintenanceProperties,
    totalRevenue,
    occupancyRate,
    propertiesByType,
    // Actions
    fetchProperties,
    fetchPropertyById,
    createProperty,
    updateProperty,
    deleteProperty,
    clearError,
  };
});
