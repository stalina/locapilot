import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRentsStore } from './rentsStore';
import type { Rent } from '@/db/types';

vi.mock('@/db/database', () => ({
  db: {
    rents: {
      toArray: vi.fn(),
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from '@/db/database';

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
      store.rents = [
        { id: 1, status: 'paid' } as Rent,
        { id: 2, status: 'pending' } as Rent,
      ];
      expect(store.pendingRents.length).toBe(1);
      expect(store.pendingRents[0]!.status).toBe('pending');
    });

    it('should filter overdue (late) rents', () => {
      const store = useRentsStore();
      store.rents = [
        { id: 1, status: 'late' } as Rent,
        { id: 2, status: 'paid' } as Rent,
      ];
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

      vi.mocked(db.rents.toArray).mockResolvedValue(mockRents);

      const store = useRentsStore();
      await store.fetchRents();

      expect(db.rents.toArray).toHaveBeenCalled();
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

      vi.mocked(db.rents.add).mockResolvedValue(1);

      const store = useRentsStore();
      const result = await store.createRent(newRent);

      expect(db.rents.add).toHaveBeenCalled();
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

      vi.mocked(db.rents.update).mockResolvedValue(1);

      await store.updateRent(1, { status: 'paid' });

      expect(db.rents.update).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'paid',
      }));
      expect(store.rents[0]!.status).toBe('paid');
    });

    it('should delete rent successfully', async () => {
      const rent1 = { id: 1, amount: 1000 } as Rent;
      const rent2 = { id: 2, amount: 1200 } as Rent;

      const store = useRentsStore();
      store.rents = [rent1, rent2];

      vi.mocked(db.rents.delete).mockResolvedValue(undefined);

      await store.deleteRent(1);

      expect(db.rents.delete).toHaveBeenCalledWith(1);
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

      vi.mocked(db.rents.update).mockResolvedValue(1);

      const paymentDate = new Date('2024-01-15');
      await store.payRent(1, paymentDate);

      expect(db.rents.update).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'paid',
        paidDate: paymentDate,
      }));
    });
  });
});
