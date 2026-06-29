import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useIndexationStore } from './indexationStore';
import { db } from '@/db/database';
import type { RentRevisionProposal } from '../services/indexationService';

describe('indexationStore - integration', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.open();
    await db.irlIndices.clear();
    await db.rentRevisions.clear();
    await db.leases.clear();
  });

  afterEach(async () => {
    await db.close();
  });

  it('upserts IRL indices without creating duplicates for the same year+quarter', async () => {
    const store = useIndexationStore();

    await store.upsertIrlIndex({ year: 2025, quarter: 1, value: 143.46 });
    await store.upsertIrlIndex({ year: 2025, quarter: 1, value: 144.0 }); // update

    const all = await db.irlIndices.toArray();
    expect(all).toHaveLength(1);
    expect(all[0]!.value).toBe(144.0);
  });

  it('sorts indices by year then quarter descending', async () => {
    const store = useIndexationStore();
    await store.upsertIrlIndex({ year: 2024, quarter: 2, value: 140 });
    await store.upsertIrlIndex({ year: 2025, quarter: 1, value: 143 });
    await store.upsertIrlIndex({ year: 2024, quarter: 4, value: 142 });

    await store.fetchIrlIndices();
    expect(store.irlIndices.map(i => `${i.year}-${i.quarter}`)).toEqual([
      '2025-1',
      '2024-4',
      '2024-2',
    ]);
  });

  it('applies a revision: persists it and updates the lease rent', async () => {
    const store = useIndexationStore();
    const leaseId = (await db.leases.add({
      propertyId: 1,
      tenantIds: [1],
      startDate: new Date('2023-03-15'),
      rent: 750,
      charges: 80,
      deposit: 750,
      paymentDay: 5,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    const proposal: RentRevisionProposal = {
      leaseId,
      year: 2026,
      anniversaryDate: new Date('2026-03-15'),
      effectiveDate: new Date('2026-03-15'),
      referenceQuarter: 1,
      oldRent: 750,
      newRent: 768.77,
      currentIrl: 147.05,
      previousIrl: 143.46,
      charges: 80,
    };

    await store.applyRevision(proposal);

    const updatedLease = await db.leases.get(leaseId);
    expect(updatedLease?.rent).toBe(768.77);

    const revisions = await db.rentRevisions.where('leaseId').equals(leaseId).toArray();
    expect(revisions).toHaveLength(1);
    expect(revisions[0]!.status).toBe('applied');
    expect(revisions[0]!.newRent).toBe(768.77);
  });

  it('rejects a revision without modifying the lease rent', async () => {
    const store = useIndexationStore();
    const leaseId = (await db.leases.add({
      propertyId: 1,
      tenantIds: [1],
      startDate: new Date('2023-03-15'),
      rent: 750,
      charges: 80,
      deposit: 750,
      paymentDay: 5,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as number;

    const proposal: RentRevisionProposal = {
      leaseId,
      year: 2026,
      anniversaryDate: new Date('2026-03-15'),
      effectiveDate: new Date('2026-03-15'),
      referenceQuarter: 1,
      oldRent: 750,
      newRent: 768.77,
      currentIrl: 147.05,
      previousIrl: 143.46,
      charges: 80,
    };

    await store.rejectRevision(proposal);

    const lease = await db.leases.get(leaseId);
    expect(lease?.rent).toBe(750);
    const revisions = await db.rentRevisions.where('leaseId').equals(leaseId).toArray();
    expect(revisions[0]!.status).toBe('rejected');
  });
});
