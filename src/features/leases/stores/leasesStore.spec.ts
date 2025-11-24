import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import type { Lease } from '@/db/types';

// Mock database
vi.mock('@/db/database', () => ({
  db: {
    leases: {
      toArray: vi.fn(),
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from '@/db/database';

describe('leasesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('State', () => {
    it('should initialize with empty leases', () => {
      const store = useLeasesStore();
      expect(store.leases).toEqual([]);
      expect(store.currentLease).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('Getters', () => {
    it('should filter active leases', () => {
      const store = useLeasesStore();
      store.leases = [
        { id: 1, status: 'active' } as Lease,
        { id: 2, status: 'ended' } as Lease,
        { id: 3, status: 'active' } as Lease,
      ];
      expect(store.activeLeases).toHaveLength(2);
    });

    it('should filter ended leases', () => {
      const store = useLeasesStore();
      store.leases = [
        { id: 1, status: 'active' } as Lease,
        { id: 2, status: 'ended' } as Lease,
        { id: 3, status: 'ended' } as Lease,
      ];
      expect(store.endedLeases).toHaveLength(2);
    });

    it('should filter pending leases', () => {
      const store = useLeasesStore();
      store.leases = [
        { id: 1, status: 'pending' } as Lease,
        { id: 2, status: 'active' } as Lease,
      ];
      expect(store.pendingLeases).toHaveLength(1);
    });

    it('should count leases correctly', () => {
      const store = useLeasesStore();
      store.leases = [
        { id: 1 } as Lease,
        { id: 2 } as Lease,
      ];
      expect(store.leases.length).toBe(2);
    });
  });

  describe('Actions', () => {
    it('should fetch leases successfully', async () => {
      const mockLeases: Lease[] = [
        {
          id: 1,
          propertyId: 1,
          tenantIds: [1],
          startDate: new Date(),
          rent: 1000,
          charges: 100,
          deposit: 2000,
          paymentDay: 1,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.leases.toArray).mockResolvedValue(mockLeases);

      const store = useLeasesStore();
      await store.fetchLeases();

      expect(store.leases).toEqual(mockLeases);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('should create lease successfully', async () => {
      const newLease = {
        propertyId: 1,
        tenantIds: [1, 2],
        startDate: new Date(),
        rent: 1200,
        charges: 150,
        deposit: 2400,
        paymentDay: 5,
        status: 'active' as const,
      };

      const createdLease = {
        id: 1,
        ...newLease,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.leases.add).mockResolvedValue(1);
      vi.mocked(db.leases.toArray).mockResolvedValue([createdLease]);

      const store = useLeasesStore();
      await store.createLease(newLease);

      expect(db.leases.add).toHaveBeenCalled();
      expect(store.leases).toHaveLength(1);
      expect(store.leases[0]!.rent).toBe(1200);
    });

    it('should update lease successfully', async () => {
      const existingLease = {
        id: 1,
        propertyId: 1,
        tenantIds: [1],
        startDate: new Date(),
        rent: 1000,
        charges: 100,
        deposit: 2000,
        paymentDay: 1,
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const store = useLeasesStore();
      store.leases = [existingLease];

      const mockUpdatedLease = { ...existingLease, rent: 1100 };
      vi.mocked(db.leases.update).mockResolvedValue(1);
      vi.mocked(db.leases.get).mockResolvedValue(mockUpdatedLease);

      await store.updateLease(1, { rent: 1100 });

      expect(db.leases.update).toHaveBeenCalledWith(1, expect.objectContaining({
        rent: 1100,
      }));
      expect(store.leases[0]!.rent).toBe(1100);
    });

    it('should delete lease successfully', async () => {
      const lease1 = { id: 1, rent: 1000 } as Lease;
      const lease2 = { id: 2, rent: 1200 } as Lease;

      const store = useLeasesStore();
      store.leases = [lease1, lease2];

      vi.mocked(db.leases.delete).mockResolvedValue(undefined);
      vi.mocked(db.leases.toArray).mockResolvedValue([lease2]);

      await store.deleteLease(1);

      expect(db.leases.delete).toHaveBeenCalledWith(1);
      expect(store.leases).toHaveLength(1);
      expect(store.leases[0]!.id).toBe(2);
    });

    it('should handle fetch error', async () => {
      vi.mocked(db.leases.toArray).mockRejectedValue(new Error('Fetch failed'));

      const store = useLeasesStore();
      await store.fetchLeases();
      
      expect(store.error).toBe('Échec du chargement des baux');
      expect(store.leases).toEqual([]);
    });

    it('should handle create error', async () => {
      const newLease = {
        propertyId: 1,
        tenantIds: [1],
        startDate: new Date(),
        rent: 1200,
        charges: 150,
        deposit: 2400,
        paymentDay: 5,
        status: 'active' as const,
      };

      vi.mocked(db.leases.add).mockRejectedValue(new Error('Create failed'));

      const store = useLeasesStore();
      
      await expect(store.createLease(newLease)).rejects.toThrow('Create failed');
      expect(store.error).toBe('Échec de la création du bail');
    });

    it('should handle update error', async () => {
      vi.mocked(db.leases.update).mockRejectedValue(new Error('Update failed'));

      const store = useLeasesStore();
      
      await expect(store.updateLease(1, { rent: 1100 })).rejects.toThrow('Update failed');
      expect(store.error).toBe('Échec de la mise à jour du bail');
    });

    it('should handle delete error', async () => {
      vi.mocked(db.leases.delete).mockRejectedValue(new Error('Delete failed'));

      const store = useLeasesStore();
      
      await expect(store.deleteLease(1)).rejects.toThrow('Delete failed');
      expect(store.error).toBe('Échec de la suppression du bail');
    });

    it('should fetch lease by id successfully', async () => {
      const mockLease: Lease = {
        id: 1,
        propertyId: 1,
        tenantIds: [1],
        startDate: new Date(),
        rent: 1000,
        charges: 100,
        deposit: 2000,
        paymentDay: 1,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.leases.get).mockResolvedValue(mockLease);

      const store = useLeasesStore();
      await store.fetchLeaseById(1);

      expect(store.currentLease).toEqual(mockLease);
      expect(store.error).toBeNull();
    });

    it('should handle lease not found', async () => {
      vi.mocked(db.leases.get).mockResolvedValue(undefined);

      const store = useLeasesStore();
      await store.fetchLeaseById(999);

      expect(store.currentLease).toBeNull();
      expect(store.error).toBe('Bail non trouvé');
    });

    it('should handle fetch by id error', async () => {
      vi.mocked(db.leases.get).mockRejectedValue(new Error('Fetch failed'));

      const store = useLeasesStore();
      await store.fetchLeaseById(1);

      expect(store.error).toBe('Échec du chargement du bail');
    });

    it('should clear error', () => {
      const store = useLeasesStore();
      store.error = 'Test error';

      store.clearError();

      expect(store.error).toBeNull();
    });
  });
});
