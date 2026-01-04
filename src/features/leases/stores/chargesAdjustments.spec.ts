import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import type { ChargesAdjustmentRow } from '@/db/types';

vi.mock('../repositories/chargesAdjustmentsRepository', () => ({
  fetchChargesAdjustmentsByLeaseId: vi.fn(),
  upsertChargesAdjustment: vi.fn(),
}));

import {
  fetchChargesAdjustmentsByLeaseId,
  upsertChargesAdjustment,
} from '../repositories/chargesAdjustmentsRepository';

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

      vi.mocked(fetchChargesAdjustmentsByLeaseId).mockResolvedValue(mockRows);

      const store = useLeasesStore();
      const result = await store.fetchChargesAdjustments(1);

      expect(fetchChargesAdjustmentsByLeaseId).toHaveBeenCalledWith(1);
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

      const createdRow = { ...newRow, id: 2, createdAt: new Date(), updatedAt: new Date() };
      vi.mocked(upsertChargesAdjustment).mockResolvedValue(createdRow as any);
      vi.mocked(fetchChargesAdjustmentsByLeaseId).mockResolvedValue([createdRow] as any);

      const store = useLeasesStore();
      const result = await store.upsertChargesAdjustment(newRow);

      expect(upsertChargesAdjustment).toHaveBeenCalled();
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
      const updatedRow = { ...existingRow, ...updateRow, updatedAt: new Date() };
      vi.mocked(upsertChargesAdjustment).mockResolvedValue(updatedRow as any);
      vi.mocked(fetchChargesAdjustmentsByLeaseId).mockResolvedValue([updatedRow] as any);

      const store = useLeasesStore();
      const result = await store.upsertChargesAdjustment(updateRow);

      expect(upsertChargesAdjustment).toHaveBeenCalled();
      expect(result).toEqual(updatedRow);
    });
  });
});
