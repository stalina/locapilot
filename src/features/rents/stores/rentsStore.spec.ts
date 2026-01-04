import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRentsStore } from './rentsStore';
import type { Rent } from '@/db/types';

vi.mock('../repositories/rentsRepository', () => ({
  fetchAllRents: vi.fn(),
  fetchRentById: vi.fn(),
  createRent: vi.fn(),
  updateRent: vi.fn(),
  deleteRent: vi.fn(),
}));

import {
  fetchAllRents,
  fetchRentById,
  createRent,
  updateRent,
  deleteRent,
} from '../repositories/rentsRepository';

describe('rentsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('State', () => {
    it('should initialize with empty rents', () => {
      const store = useRentsStore();
      expect(store.rents).toEqual([]);
      expect(store.currentRent).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('Getters', () => {
    it('should filter paid rents', () => {
      const store = useRentsStore();
      store.rents = [
        { id: 1, status: 'paid' } as Rent,
        { id: 2, status: 'pending' } as Rent,
        { id: 3, status: 'paid' } as Rent,
      ];
      expect(store.paidRents.length).toBe(2);
      expect(store.paidRents[0]!.status).toBe('paid');
    });

    it('should filter pending rents', () => {
      const store = useRentsStore();
      store.rents = [{ id: 1, status: 'paid' } as Rent, { id: 2, status: 'pending' } as Rent];
      expect(store.pendingRents.length).toBe(1);
      expect(store.pendingRents[0]!.status).toBe('pending');
    });

    it('should filter overdue (late) rents', () => {
      const store = useRentsStore();
      store.rents = [{ id: 1, status: 'late' } as Rent, { id: 2, status: 'paid' } as Rent];
      expect(store.overdueRents.length).toBe(1);
      expect(store.overdueRents[0]!.status).toBe('late');
    });

    it('should calculate total paid amount', () => {
      const store = useRentsStore();
      store.rents = [
        { id: 1, status: 'paid', amount: 1000 } as Rent,
        { id: 2, status: 'paid', amount: 1200 } as Rent,
        { id: 3, status: 'pending', amount: 800 } as Rent,
      ];
      expect(store.totalPaidAmount).toBe(2200);
    });

    it('should calculate payment rate', () => {
      const store = useRentsStore();
      store.rents = [
        { id: 1, status: 'paid' } as Rent,
        { id: 2, status: 'paid' } as Rent,
        { id: 3, status: 'pending' } as Rent,
        { id: 4, status: 'late' } as Rent,
      ];
      expect(store.paymentRate).toBe(50); // 2 out of 4 = 50%
    });
  });

  describe('Actions', () => {
    it('should fetch rents successfully', async () => {
      const mockRents = [
        { id: 1, status: 'paid', dueDate: new Date() } as Rent,
        { id: 2, status: 'pending', dueDate: new Date() } as Rent,
      ];

      vi.mocked(fetchAllRents).mockResolvedValue(mockRents);

      const store = useRentsStore();
      await store.fetchRents();

      expect(fetchAllRents).toHaveBeenCalled();
      expect(store.rents.length).toBe(2);
    });

    it('should create rent successfully', async () => {
      const newRent = {
        leaseId: 1,
        dueDate: new Date('2024-01-01'),
        amount: 1000,
        charges: 100,
        status: 'pending' as const,
      };

      const created: Rent = {
        id: 1,
        ...newRent,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(createRent).mockResolvedValue(created);

      const store = useRentsStore();
      const result = await store.createRent(newRent);

      expect(createRent).toHaveBeenCalled();
      expect(result.id).toBeDefined();
      expect(result.amount).toBe(1000);
      expect(store.rents.length).toBe(1);
    });

    it('should update rent successfully', async () => {
      const existingRent: Rent = {
        id: 1,
        leaseId: 1,
        dueDate: new Date(),
        amount: 1000,
        charges: 100,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const store = useRentsStore();
      store.rents = [existingRent];

      vi.mocked(updateRent).mockResolvedValue({ ...existingRent, status: 'paid' } as Rent);

      await store.updateRent(1, { status: 'paid' });

      expect(updateRent).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'paid',
        })
      );
      expect(store.rents[0]!.status).toBe('paid');
    });

    it('should delete rent successfully', async () => {
      const rent1 = { id: 1, amount: 1000 } as Rent;
      const rent2 = { id: 2, amount: 1200 } as Rent;

      const store = useRentsStore();
      store.rents = [rent1, rent2];

      vi.mocked(deleteRent).mockResolvedValue(undefined);

      await store.deleteRent(1);

      expect(deleteRent).toHaveBeenCalledWith(1);
      expect(store.rents.length).toBe(1);
      expect(store.rents[0]!.id).toBe(2);
    });

    it('should mark rent as paid', async () => {
      const existingRent: Rent = {
        id: 1,
        leaseId: 1,
        dueDate: new Date(),
        amount: 1000,
        charges: 100,
        status: 'pending' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const store = useRentsStore();
      store.rents = [existingRent];

      vi.mocked(updateRent).mockResolvedValue({ ...existingRent, status: 'paid' } as Rent);

      const paymentDate = new Date('2024-01-15');
      await store.payRent(1, paymentDate);

      expect(updateRent).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: 'paid',
          paidDate: paymentDate,
        })
      );
    });

    it('should handle fetch error', async () => {
      vi.mocked(fetchAllRents).mockRejectedValue(new Error('Fetch failed'));

      const store = useRentsStore();
      await store.fetchRents();

      expect(store.error).toBe('Échec du chargement des loyers');
    });

    it('should handle create error', async () => {
      const newRent = {
        leaseId: 1,
        dueDate: new Date('2024-01-01'),
        amount: 1000,
        charges: 100,
        status: 'pending' as const,
      };

      vi.mocked(createRent).mockRejectedValue(new Error('Create failed'));

      const store = useRentsStore();

      await expect(store.createRent(newRent)).rejects.toThrow('Create failed');
      expect(store.error).toBe('Échec de la création du loyer');
    });

    it('should handle update error', async () => {
      vi.mocked(updateRent).mockRejectedValue(new Error('Update failed'));

      const store = useRentsStore();

      await expect(store.updateRent(1, { status: 'paid' })).rejects.toThrow('Update failed');
      expect(store.error).toBe('Échec de la mise à jour du loyer');
    });

    it('should handle delete error', async () => {
      vi.mocked(deleteRent).mockRejectedValue(new Error('Delete failed'));

      const store = useRentsStore();

      await expect(store.deleteRent(1)).rejects.toThrow('Delete failed');
      expect(store.error).toBe('Échec de la suppression du loyer');
    });

    it('should fetch rent by id successfully', async () => {
      const mockRent: Rent = {
        id: 1,
        leaseId: 1,
        dueDate: new Date(),
        amount: 1000,
        charges: 100,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(fetchRentById).mockResolvedValue(mockRent);

      const store = useRentsStore();
      await store.fetchRentById(1);

      expect(store.currentRent).toEqual(mockRent);
      expect(store.error).toBeNull();
    });

    it('should handle rent not found', async () => {
      vi.mocked(fetchRentById).mockResolvedValue(undefined);

      const store = useRentsStore();
      await store.fetchRentById(999);

      expect(store.currentRent).toBeNull();
      expect(store.error).toBe('Loyer non trouvé');
    });

    it('should handle fetch by id error', async () => {
      vi.mocked(fetchRentById).mockRejectedValue(new Error('Fetch failed'));

      const store = useRentsStore();
      await store.fetchRentById(1);

      expect(store.error).toBe('Échec du chargement du loyer');
    });

    it('should clear error', () => {
      const store = useRentsStore();
      store.error = 'Test error';

      store.clearError();

      expect(store.error).toBeNull();
    });

    it('should calculate payment rate as 0 when no rents', () => {
      const store = useRentsStore();
      expect(store.paymentRate).toBe(0);
    });
  });
});
