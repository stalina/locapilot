import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import type { Lease } from '@/db/types';

vi.mock('../repositories/leasesRepository', () => ({
  fetchAllLeases: vi.fn(),
  fetchLeaseById: vi.fn(),
  createLease: vi.fn(),
  updateLease: vi.fn(),
  deleteLease: vi.fn(),
  recordDepositReception: vi.fn(),
  recordDepositRestitution: vi.fn(),
}));

import {
  fetchAllLeases,
  fetchLeaseById,
  createLease,
  updateLease,
  deleteLease,
  recordDepositReception,
  recordDepositRestitution,
} from '../repositories/leasesRepository';

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
      store.leases = [{ id: 1, status: 'pending' } as Lease, { id: 2, status: 'active' } as Lease];
      expect(store.pendingLeases).toHaveLength(1);
    });

    it('should count leases correctly', () => {
      const store = useLeasesStore();
      store.leases = [{ id: 1 } as Lease, { id: 2 } as Lease];
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

      vi.mocked(fetchAllLeases).mockResolvedValue(mockLeases);

      const store = useLeasesStore();
      await store.fetchLeases();

      expect(fetchAllLeases).toHaveBeenCalled();
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

      vi.mocked(createLease).mockResolvedValue(createdLease as Lease);

      const store = useLeasesStore();
      await store.createLease(newLease);

      expect(createLease).toHaveBeenCalled();
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
      vi.mocked(updateLease).mockResolvedValue(mockUpdatedLease as Lease);

      await store.updateLease(1, { rent: 1100 });

      expect(updateLease).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          rent: 1100,
        })
      );
      expect(store.leases[0]!.rent).toBe(1100);
    });

    it('should delete lease successfully', async () => {
      const lease1 = { id: 1, rent: 1000 } as Lease;
      const lease2 = { id: 2, rent: 1200 } as Lease;

      const store = useLeasesStore();
      store.leases = [lease1, lease2];

      vi.mocked(deleteLease).mockResolvedValue(undefined);

      await store.deleteLease(1);

      expect(deleteLease).toHaveBeenCalledWith(1);
      expect(store.leases).toHaveLength(1);
      expect(store.leases[0]!.id).toBe(2);
    });

    it('should handle fetch error', async () => {
      vi.mocked(fetchAllLeases).mockRejectedValue(new Error('Fetch failed'));

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

      vi.mocked(createLease).mockRejectedValue(new Error('Create failed'));

      const store = useLeasesStore();

      await expect(store.createLease(newLease)).rejects.toThrow('Create failed');
      expect(store.error).toBe('Échec de la création du bail');
    });

    it('should handle update error', async () => {
      vi.mocked(updateLease).mockRejectedValue(new Error('Update failed'));

      const store = useLeasesStore();

      await expect(store.updateLease(1, { rent: 1100 })).rejects.toThrow('Update failed');
      expect(store.error).toBe('Échec de la mise à jour du bail');
    });

    it('should handle delete error', async () => {
      vi.mocked(deleteLease).mockRejectedValue(new Error('Delete failed'));

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

      vi.mocked(fetchLeaseById).mockResolvedValue(mockLease);

      const store = useLeasesStore();
      await store.fetchLeaseById(1);

      expect(fetchLeaseById).toHaveBeenCalledWith(1);
      expect(store.currentLease).toEqual(mockLease);
      expect(store.error).toBeNull();
    });

    it('should handle lease not found', async () => {
      vi.mocked(fetchLeaseById).mockResolvedValue(undefined);

      const store = useLeasesStore();
      await store.fetchLeaseById(999);

      expect(store.currentLease).toBeNull();
      expect(store.error).toBe('Bail non trouvé');
    });

    it('should handle fetch by id error', async () => {
      vi.mocked(fetchLeaseById).mockRejectedValue(new Error('Fetch failed'));

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

  describe('Security deposit reception', () => {
    const baseLease = (): Lease => ({
      id: 1,
      propertyId: 1,
      tenantIds: [1],
      startDate: new Date('2026-01-01'),
      rent: 750,
      charges: 80,
      deposit: 750,
      paymentDay: 5,
      status: 'active',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    it('records the deposit reception and refreshes state', async () => {
      const store = useLeasesStore();
      const lease = baseLease();
      store.leases = [lease];
      store.currentLease = lease;

      const receivedDate = new Date('2026-01-03');
      const updated = { ...lease, depositReceivedDate: receivedDate, updatedAt: new Date() };
      vi.mocked(recordDepositReception).mockResolvedValue(updated as Lease);

      await store.recordDepositReception(1, receivedDate);

      expect(recordDepositReception).toHaveBeenCalledWith(1, receivedDate);
      expect(store.leases[0]!.depositReceivedDate).toEqual(receivedDate);
      expect(store.currentLease!.depositReceivedDate).toEqual(receivedDate);
      expect(store.error).toBeNull();
    });

    it('rejects an invalid reception date without writing', async () => {
      const store = useLeasesStore();
      store.leases = [baseLease()];

      await expect(
        store.recordDepositReception(1, new Date('not-a-date'))
      ).rejects.toThrow(/date de réception/i);
      expect(recordDepositReception).not.toHaveBeenCalled();
    });
  });

  describe('Security deposit restitution', () => {
    const receivedLease = (): Lease => ({
      id: 1,
      propertyId: 1,
      tenantIds: [1],
      startDate: new Date('2026-01-01'),
      rent: 750,
      charges: 80,
      deposit: 750,
      depositReceivedDate: new Date('2026-01-03'),
      paymentDay: 5,
      status: 'ended',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });

    it('records a full restitution', async () => {
      const store = useLeasesStore();
      const lease = receivedLease();
      store.leases = [lease];
      store.currentLease = lease;

      const returnedDate = new Date('2027-01-15');
      const updated = {
        ...lease,
        depositReturnedDate: returnedDate,
        depositReturnedAmount: 750,
      };
      vi.mocked(recordDepositRestitution).mockResolvedValue(updated as Lease);

      await store.recordDepositRestitution(1, returnedDate, 750);

      expect(recordDepositRestitution).toHaveBeenCalledWith(1, returnedDate, 750);
      expect(store.leases[0]!.depositReturnedAmount).toBe(750);
      expect(store.currentLease!.depositReturnedDate).toEqual(returnedDate);
    });

    it('records a partial restitution with deductions', async () => {
      const store = useLeasesStore();
      const lease = receivedLease();
      store.leases = [lease];

      const returnedDate = new Date('2027-01-15');
      vi.mocked(recordDepositRestitution).mockResolvedValue({
        ...lease,
        depositReturnedDate: returnedDate,
        depositReturnedAmount: 600,
      } as Lease);

      await store.recordDepositRestitution(1, returnedDate, 600);

      expect(store.leases[0]!.depositReturnedAmount).toBe(600);
    });

    it('rejects a returned amount greater than the deposit', async () => {
      const store = useLeasesStore();
      store.leases = [receivedLease()];

      await expect(
        store.recordDepositRestitution(1, new Date('2027-01-15'), 800)
      ).rejects.toThrow('Le montant restitué ne peut pas dépasser le dépôt');
      expect(recordDepositRestitution).not.toHaveBeenCalled();
      // Validation failures must not clobber the store-wide fatal error state.
      expect(store.error).toBeNull();
    });

    it('rejects a restitution date before the reception date', async () => {
      const store = useLeasesStore();
      store.leases = [receivedLease()];

      await expect(
        store.recordDepositRestitution(1, new Date('2025-12-01'), 750)
      ).rejects.toThrow('La date de restitution doit être postérieure à la réception');
      expect(recordDepositRestitution).not.toHaveBeenCalled();
    });

    it('rejects restitution before reception is recorded', async () => {
      const store = useLeasesStore();
      const lease = receivedLease();
      delete lease.depositReceivedDate;
      store.leases = [lease];

      await expect(
        store.recordDepositRestitution(1, new Date('2027-01-15'), 750)
      ).rejects.toThrow(/marqué comme reçu/i);
      expect(recordDepositRestitution).not.toHaveBeenCalled();
    });

    it('rejects when the lease is not in the store', async () => {
      const store = useLeasesStore();
      store.leases = [];
      store.currentLease = null;

      await expect(
        store.recordDepositRestitution(1, new Date('2027-01-15'), 750)
      ).rejects.toThrow('Bail introuvable');
    });
  });
});
