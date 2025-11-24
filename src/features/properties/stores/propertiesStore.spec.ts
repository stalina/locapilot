import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import type { Property } from '@/db/types';

// Mock database
vi.mock('@/db/database', () => ({
  db: {
    properties: {
      toArray: vi.fn(),
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from '@/db/database';

describe('propertiesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('State', () => {
    it('should initialize with empty properties', () => {
      const store = usePropertiesStore();
      expect(store.properties).toEqual([]);
      expect(store.currentProperty).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('Getters', () => {
    it('should count properties correctly', () => {
      const store = usePropertiesStore();
      store.properties = [
        { id: 1, name: 'Prop 1' } as Property,
        { id: 2, name: 'Prop 2' } as Property,
      ];
      expect(store.properties.length).toBe(2);
    });

    it('should filter occupied properties', () => {
      const store = usePropertiesStore();
      store.properties = [
        { id: 1, status: 'rented' } as Property,
        { id: 2, status: 'available' } as Property,
        { id: 3, status: 'rented' } as Property,
      ];
      expect(store.occupiedProperties).toHaveLength(2);
    });

    it('should filter vacant properties', () => {
      const store = usePropertiesStore();
      store.properties = [
        { id: 1, status: 'rented' } as Property,
        { id: 2, status: 'available' } as Property,
        { id: 3, status: 'available' } as Property,
      ];
      expect(store.vacantProperties).toHaveLength(2);
    });

    it('should calculate total revenue', () => {
      const store = usePropertiesStore();
      store.properties = [
        { id: 1, rent: 1000, status: 'rented' } as Property,
        { id: 2, rent: 1500, status: 'rented' } as Property,
        { id: 3, rent: 800, status: 'available' } as Property,
      ];
      expect(store.totalRevenue).toBe(2500);
    });

    it('should group properties by type', () => {
      const store = usePropertiesStore();
      store.properties = [
        { id: 1, type: 'apartment' } as Property,
        { id: 2, type: 'house' } as Property,
        { id: 3, type: 'apartment' } as Property,
      ];
      const byType = store.propertiesByType;
      expect(byType.apartment).toHaveLength(2);
      expect(byType.house).toHaveLength(1);
    });
  });

  describe('Actions', () => {
    it('should fetch properties successfully', async () => {
      const mockProperties: Property[] = [
        {
          id: 1,
          name: 'Test Property',
          address: '123 Test St',
          city: 'Paris',
          postalCode: '75001',
          type: 'apartment',
          surface: 50,
          rooms: 2,
          rent: 1000,
          status: 'available',
          features: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.properties.toArray).mockResolvedValue(mockProperties);

      const store = usePropertiesStore();
      await store.fetchProperties();

      expect(store.properties).toEqual(mockProperties);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      vi.mocked(db.properties.toArray).mockRejectedValue(new Error('DB Error'));

      const store = usePropertiesStore();
      await store.fetchProperties();
      
      expect(store.error).toBe('DB Error');
      expect(store.properties).toEqual([]);
    });

    it('should create property successfully', async () => {
      const newProperty = {
        name: 'New Property',
        address: '456 New St',
        city: 'Lyon',
        postalCode: '69001',
        type: 'apartment' as const,
        surface: 60,
        rooms: 3,
        rent: 1200,
        charges: 100,
        status: 'available' as const,
        features: [],
      };

      const createdProperty = {
        id: 1,
        ...newProperty,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.properties.add).mockResolvedValue(1);
      vi.mocked(db.properties.toArray).mockResolvedValue([createdProperty]);

      const store = usePropertiesStore();
      await store.createProperty(newProperty);

      expect(db.properties.add).toHaveBeenCalled();
      expect(store.properties).toHaveLength(1);
      expect(store.properties[0]!.name).toBe('New Property');
    });

    it('should update property successfully', async () => {
      const existingProperty = {
        id: 1,
        name: 'Old Name',
        status: 'available' as const,
        address: '123 Test St',
        city: 'Paris',
        postalCode: '75001',
        type: 'apartment' as const,
        surface: 50,
        rooms: 2,
        rent: 1000,
        charges: 100,
        features: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedProperty = {
        ...existingProperty,
        name: 'New Name',
      };

      const store = usePropertiesStore();
      store.properties = [existingProperty];

      vi.mocked(db.properties.update).mockResolvedValue(1);
      vi.mocked(db.properties.toArray).mockResolvedValue([updatedProperty]);

      await store.updateProperty(1, { name: 'New Name' });

      expect(db.properties.update).toHaveBeenCalledWith(1, expect.objectContaining({
        name: 'New Name',
      }));
      expect(store.properties[0]!.name).toBe('New Name');
    });

    it('should delete property successfully', async () => {
      const prop1 = { id: 1, name: 'Property 1' } as Property;
      const prop2 = { id: 2, name: 'Property 2' } as Property;

      const store = usePropertiesStore();
      store.properties = [prop1, prop2];

      vi.mocked(db.properties.delete).mockResolvedValue(undefined);
      vi.mocked(db.properties.toArray).mockResolvedValue([prop2]);

      await store.deleteProperty(1);

      expect(db.properties.delete).toHaveBeenCalledWith(1);
      expect(store.properties).toHaveLength(1);
      expect(store.properties[0]!.id).toBe(2);
    });
  });
});
