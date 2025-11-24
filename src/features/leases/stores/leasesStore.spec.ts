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
  });
});
