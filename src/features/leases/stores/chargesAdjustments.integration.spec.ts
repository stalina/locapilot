import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import { db } from '@/db/database';

describe('leasesStore - Charges Adjustments Integration', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.open();
    await db.chargesAdjustments.clear();
  });

  afterEach(async () => {
    await db.close();
  });

  it('should persist custom charges correctly', async () => {
    const store = useLeasesStore();
    const leaseId = 999;
    const year = 2024;

    // 1. Create a row with custom charges
    const row = {
      leaseId,
      year,
      monthlyRent: 500,
      customCharges: { Eau: 100, Ordures: 50 },
    };

    await store.upsertChargesAdjustment(row);

    // 2. Verify it's in the DB
    const savedRow = await db.chargesAdjustments.where({ leaseId, year }).first();
    expect(savedRow).toBeDefined();
    expect(savedRow?.customCharges).toEqual({ Eau: 100, Ordures: 50 });

    // 3. Update with new custom charges (add a column)
    const updatedCustomCharges = { ...savedRow!.customCharges, Electricité: 200 };
    await store.upsertChargesAdjustment({
      leaseId,
      year,
      customCharges: updatedCustomCharges,
    });

    // 4. Verify update in DB
    const updatedRow = await db.chargesAdjustments.where({ leaseId, year }).first();
    expect(updatedRow?.customCharges).toEqual({ Eau: 100, Ordures: 50, Electricité: 200 });

    // 5. Fetch via store and verify
    const fetchedRows = await store.fetchChargesAdjustments(leaseId);
    expect(fetchedRows).toHaveLength(1);
    expect(fetchedRows[0].customCharges).toEqual({ Eau: 100, Ordures: 50, Electricité: 200 });
  });

  it('should handle adding a column to multiple rows', async () => {
    const store = useLeasesStore();
    const leaseId = 888;

    // Create rows for 2023 and 2024
    await store.upsertChargesAdjustment({ leaseId, year: 2023, customCharges: {} });
    await store.upsertChargesAdjustment({ leaseId, year: 2024, customCharges: {} });

    // Simulate adding a column "Eau" initialized to 0
    const rows = await store.fetchChargesAdjustments(leaseId);

    for (const r of rows) {
      const custom = { ...(r.customCharges ?? {}) };
      custom['Eau'] = 0;
      await store.upsertChargesAdjustment({
        leaseId: r.leaseId,
        year: r.year,
        customCharges: custom,
      });
    }

    // Verify DB
    const savedRows = await db.chargesAdjustments.where({ leaseId }).sortBy('year');
    expect(savedRows).toHaveLength(2);
    expect(savedRows[0].customCharges).toEqual({ Eau: 0 });
    expect(savedRows[1].customCharges).toEqual({ Eau: 0 });
  });
});
