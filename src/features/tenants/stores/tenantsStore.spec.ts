import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import type { Tenant } from '@/db/types';

// Mock database
vi.mock('@/db/database', () => ({
  db: {
    tenants: {
      toArray: vi.fn(),
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from '@/db/database';

describe('tenantsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('State', () => {
    it('should initialize with empty tenants', () => {
      const store = useTenantsStore();
      expect(store.tenants).toEqual([]);
      expect(store.currentTenant).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('Getters', () => {
    it('should filter active tenants', () => {
      const store = useTenantsStore();
      store.tenants = [
        { id: 1, status: 'active' } as Tenant,
        { id: 2, status: 'former' } as Tenant,
        { id: 3, status: 'active' } as Tenant,
      ];
      expect(store.activeTenants).toHaveLength(2);
    });

    it('should filter former tenants', () => {
      const store = useTenantsStore();
      store.tenants = [
        { id: 1, status: 'active' } as Tenant,
        { id: 2, status: 'former' } as Tenant,
        { id: 3, status: 'former' } as Tenant,
      ];
      expect(store.formerTenants).toHaveLength(2);
    });

    it('should count tenants correctly', () => {
      const store = useTenantsStore();
      store.tenants = [
        { id: 1 } as Tenant,
        { id: 2 } as Tenant,
        { id: 3 } as Tenant,
      ];
      expect(store.tenantsCount).toBe(3);
    });
  });

  describe('Actions', () => {
    it('should fetch tenants successfully', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 1,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '0123456789',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.tenants.toArray).mockResolvedValue(mockTenants);

      const store = useTenantsStore();
      await store.fetchTenants();

      expect(store.tenants).toEqual(mockTenants);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should create tenant successfully', async () => {
      const newTenant = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '0987654321',
        status: 'active' as const,
      };

      const createdTenant = {
        id: 1,
        ...newTenant,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.tenants.add).mockResolvedValue(1);
      vi.mocked(db.tenants.toArray).mockResolvedValue([createdTenant]);

      const store = useTenantsStore();
      await store.createTenant(newTenant);

      expect(db.tenants.add).toHaveBeenCalled();
      expect(store.tenants).toHaveLength(1);
      expect(store.tenants[0]!.firstName).toBe('Jane');
    });

    it('should update tenant successfully', async () => {
      const existingTenant = {
        id: 1,
        firstName: 'Old Name',
        lastName: 'Doe',
        email: 'old@example.com',
        phone: '0123456789',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedTenant = {
        ...existingTenant,
        firstName: 'New Name',
      };

      const store = useTenantsStore();
      store.tenants = [existingTenant];

      vi.mocked(db.tenants.update).mockResolvedValue(1);
      vi.mocked(db.tenants.toArray).mockResolvedValue([updatedTenant]);

      await store.updateTenant(1, { firstName: 'New Name' });

      expect(db.tenants.update).toHaveBeenCalledWith(1, expect.objectContaining({
        firstName: 'New Name',
      }));
      expect(store.tenants[0]!.firstName).toBe('New Name');
    });

    it('should delete tenant successfully', async () => {
      const tenant1 = { id: 1, firstName: 'Tenant 1' } as Tenant;
      const tenant2 = { id: 2, firstName: 'Tenant 2' } as Tenant;

      const store = useTenantsStore();
      store.tenants = [tenant1, tenant2];

      vi.mocked(db.tenants.delete).mockResolvedValue(undefined);
      vi.mocked(db.tenants.toArray).mockResolvedValue([tenant2]);

      await store.deleteTenant(1);

      expect(db.tenants.delete).toHaveBeenCalledWith(1);
      expect(store.tenants).toHaveLength(1);
      expect(store.tenants[0]!.id).toBe(2);
    });
  });
});
