import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import type { ChargesAdjustmentRow } from '@/db/types';

// Mock database
vi.mock('@/db/database', () => ({
  db: {
    chargesAdjustments: {
      where: vi.fn(() => ({
        sortBy: vi.fn(),
        first: vi.fn(),
      })),
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
    },
    leases: {
      toArray: vi.fn(),
      get: vi.fn(),
    },
  },
}));

import { db } from '@/db/database';

describe('leasesStore - Charges Adjustments', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('fetchChargesAdjustments', () => {
    it('should fetch charges adjustments for a lease', async () => {
      const mockRows: ChargesAdjustmentRow[] = [
        {
          id: 1,
          leaseId: 1,
          year: 2023,
          monthlyRent: 500,
          chargesProvisionPaid: 50,
          rentsPaidCount: 12,
          rentsPaidTotal: 6000,
          customCharges: { Eau: 100 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const sortByMock = vi.fn().mockResolvedValue(mockRows);
      vi.mocked(db.chargesAdjustments.where).mockReturnValue({
        sortBy: sortByMock,
      } as any);

      const store = useLeasesStore();
      const result = await store.fetchChargesAdjustments(1);

      expect(db.chargesAdjustments.where).toHaveBeenCalledWith({ leaseId: 1 });
      expect(sortByMock).toHaveBeenCalledWith('year');
      expect(result).toEqual(mockRows);
      expect(store.chargesAdjustments[1]).toEqual(mockRows);
    });
  });

  describe('upsertChargesAdjustment', () => {
    it('should add a new row if it does not exist', async () => {
      const newRow = {
        leaseId: 1,
        year: 2024,
        monthlyRent: 550,
        customCharges: { Eau: 120 },
      };

      // Mock existing check returning null
      const firstMock = vi.fn().mockResolvedValue(null);
      vi.mocked(db.chargesAdjustments.where).mockReturnValue({
        first: firstMock,
      } as any);

      // Mock add returning id
      vi.mocked(db.chargesAdjustments.add).mockResolvedValue(2);

      // Mock get returning the created row
      const createdRow = { ...newRow, id: 2, createdAt: new Date(), updatedAt: new Date() };
      vi.mocked(db.chargesAdjustments.get).mockResolvedValue(createdRow as any);

      // Mock fetchChargesAdjustments to update store state
      const sortByMock = vi.fn().mockResolvedValue([createdRow]);
      vi.mocked(db.chargesAdjustments.where).mockReturnValue({
        first: firstMock,
        sortBy: sortByMock,
      } as any);

      const store = useLeasesStore();
      const result = await store.upsertChargesAdjustment(newRow);

      expect(db.chargesAdjustments.add).toHaveBeenCalled();
      expect(result).toEqual(createdRow);
    });

    it('should update an existing row if it exists', async () => {
      const updateRow = {
        leaseId: 1,
        year: 2023,
        customCharges: { Eau: 150 },
      };

      const existingRow = {
        id: 1,
        leaseId: 1,
        year: 2023,
        customCharges: { Eau: 100 },
      };

      // Mock existing check returning row
      const firstMock = vi.fn().mockResolvedValue(existingRow);
      vi.mocked(db.chargesAdjustments.where).mockReturnValue({
        first: firstMock,
      } as any);

      // Mock update
      vi.mocked(db.chargesAdjustments.update).mockResolvedValue(1);

      // Mock get returning the updated row
      const updatedRow = { ...existingRow, ...updateRow, updatedAt: new Date() };
      vi.mocked(db.chargesAdjustments.get).mockResolvedValue(updatedRow as any);

      // Mock fetchChargesAdjustments
      const sortByMock = vi.fn().mockResolvedValue([updatedRow]);
      vi.mocked(db.chargesAdjustments.where).mockReturnValue({
        first: firstMock,
        sortBy: sortByMock,
      } as any);

      const store = useLeasesStore();
      const result = await store.upsertChargesAdjustment(updateRow);

      expect(db.chargesAdjustments.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          customCharges: { Eau: 150 },
        })
      );
      expect(result).toEqual(updatedRow);
    });
  });
});
