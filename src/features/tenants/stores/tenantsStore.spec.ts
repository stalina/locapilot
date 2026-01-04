import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import type { Tenant } from '@/db/types';

vi.mock('@/features/tenants/repositories/tenantsRepository', () => ({
  fetchAllTenants: vi.fn(),
  fetchTenantById: vi.fn(),
  createTenant: vi.fn(),
  updateTenant: vi.fn(),
  deleteTenant: vi.fn(),
  updateTenantStatus: vi.fn(),
}));

vi.mock('@/features/tenants/repositories/tenantAuditsRepository', () => ({
  addTenantAudit: vi.fn(),
}));

import {
  createTenant as createTenantRepo,
  deleteTenant as deleteTenantRepo,
  fetchAllTenants,
  fetchTenantById as fetchTenantByIdRepo,
  updateTenant as updateTenantRepo,
} from '@/features/tenants/repositories/tenantsRepository';

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
      store.tenants = [{ id: 1 } as Tenant, { id: 2 } as Tenant, { id: 3 } as Tenant];
      expect(store.tenantsCount).toBe(3);
    });
  });

  describe('Actions', () => {
    it('should fetch tenants successfully', async () => {
      const mockTenants: Tenant[] = [
        {
          id: 1,
          civility: 'mr',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '0123456789',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(fetchAllTenants).mockResolvedValue(mockTenants);

      const store = useTenantsStore();
      await store.fetchTenants();

      expect(store.tenants).toEqual(mockTenants);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should create tenant successfully', async () => {
      const newTenant = {
        civility: 'mme',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '0987654321',
        status: 'active' as const,
      };

      const createdTenant = {
        id: 1,
        civility: 'mme',
        ...newTenant,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(createTenantRepo).mockResolvedValue(1);
      vi.mocked(fetchAllTenants).mockResolvedValue([createdTenant]);

      const store = useTenantsStore();
      await store.createTenant(newTenant);

      expect(createTenantRepo).toHaveBeenCalled();
      expect(store.tenants).toHaveLength(1);
      expect(store.tenants[0]!.firstName).toBe('Jane');
    });

    it('should update tenant successfully', async () => {
      const existingTenant = {
        id: 1,
        civility: 'mr',
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

      vi.mocked(updateTenantRepo).mockResolvedValue();
      vi.mocked(fetchAllTenants).mockResolvedValue([updatedTenant]);

      await store.updateTenant(1, { firstName: 'New Name' });

      expect(updateTenantRepo).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          firstName: 'New Name',
        })
      );
      expect(store.tenants[0]!.firstName).toBe('New Name');
    });

    it('should delete tenant successfully', async () => {
      const tenant1 = { id: 1, firstName: 'Tenant 1', civility: 'mr' } as Tenant;
      const tenant2 = { id: 2, firstName: 'Tenant 2', civility: 'mme' } as Tenant;

      const store = useTenantsStore();
      store.tenants = [tenant1, tenant2];

      vi.mocked(deleteTenantRepo).mockResolvedValue();
      vi.mocked(fetchAllTenants).mockResolvedValue([tenant2]);

      await store.deleteTenant(1);

      expect(deleteTenantRepo).toHaveBeenCalledWith(1);
      expect(store.tenants).toHaveLength(1);
      expect(store.tenants[0]!.id).toBe(2);
    });

    it('should handle fetch error', async () => {
      vi.mocked(fetchAllTenants).mockRejectedValue(new Error('Fetch failed'));

      const store = useTenantsStore();
      await store.fetchTenants();

      expect(store.error).toBe('Fetch failed');
      expect(store.tenants).toEqual([]);
    });

    it('should handle create error', async () => {
      const newTenant = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '0987654321',
        status: 'active' as const,
      };

      vi.mocked(createTenantRepo).mockRejectedValue(new Error('Create failed'));

      const store = useTenantsStore();

      await expect(store.createTenant(newTenant)).rejects.toThrow('Create failed');
      expect(store.error).toBe('Create failed');
    });

    it('should handle update error', async () => {
      vi.mocked(updateTenantRepo).mockRejectedValue(new Error('Update failed'));

      const store = useTenantsStore();

      await expect(store.updateTenant(1, { firstName: 'New' })).rejects.toThrow('Update failed');
      expect(store.error).toBe('Update failed');
    });

    it('should handle delete error', async () => {
      vi.mocked(deleteTenantRepo).mockRejectedValue(new Error('Delete failed'));

      const store = useTenantsStore();

      await expect(store.deleteTenant(1)).rejects.toThrow('Delete failed');
      expect(store.error).toBe('Delete failed');
    });

    it('should fetch tenant by id successfully', async () => {
      const mockTenant: Tenant = {
        id: 1,
        civility: 'mr',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '0123456789',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(fetchTenantByIdRepo).mockResolvedValue(mockTenant);

      const store = useTenantsStore();
      await store.fetchTenantById(1);

      expect(store.currentTenant).toEqual(mockTenant);
      expect(store.error).toBeNull();
    });

    it('should handle tenant not found', async () => {
      vi.mocked(fetchTenantByIdRepo).mockResolvedValue(undefined);

      const store = useTenantsStore();
      await store.fetchTenantById(999);

      expect(store.currentTenant).toBeNull();
      expect(store.error).toBe('Tenant not found');
    });

    it('should handle fetch by id error', async () => {
      vi.mocked(fetchTenantByIdRepo).mockRejectedValue(new Error('Fetch failed'));

      const store = useTenantsStore();
      await store.fetchTenantById(1);

      expect(store.error).toBe('Fetch failed');
    });

    it('should update currentTenant when updating the current tenant', async () => {
      const mockTenant: Tenant = {
        id: 1,
        civility: 'mr',
        firstName: 'Original',
        lastName: 'Name',
        email: 'original@example.com',
        phone: '0123456789',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedTenant = { ...mockTenant, firstName: 'Updated' };

      const store = useTenantsStore();
      store.currentTenant = mockTenant;

      vi.mocked(updateTenantRepo).mockResolvedValue();
      vi.mocked(fetchAllTenants).mockResolvedValue([updatedTenant]);
      vi.mocked(fetchTenantByIdRepo).mockResolvedValue(updatedTenant);

      await store.updateTenant(1, { firstName: 'Updated' });

      expect(store.currentTenant?.firstName).toBe('Updated');
    });

    it('should clear currentTenant when deleting it', async () => {
      const mockTenant: Tenant = {
        id: 1,
        civility: 'mr',
        firstName: 'To Delete',
        lastName: 'Name',
        email: 'delete@example.com',
        phone: '0123456789',
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const store = useTenantsStore();
      store.currentTenant = mockTenant;

      vi.mocked(deleteTenantRepo).mockResolvedValue();
      vi.mocked(fetchAllTenants).mockResolvedValue([]);

      await store.deleteTenant(1);

      expect(store.currentTenant).toBeNull();
    });

    it('should clear error', () => {
      const store = useTenantsStore();
      store.error = 'Test error';

      store.clearError();

      expect(store.error).toBeNull();
    });
  });
});
