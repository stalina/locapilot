import { describe, expect, it } from 'vitest';
import type { ChargesAdjustmentRow, Inventory, Lease, Property, RentRevision } from '@/db/types';
import { computeActionSchedule } from './dashboardScheduleService';

const NOW = new Date('2026-06-01T12:00:00');

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 1,
    name: 'Studio Belleville',
    address: '1 rue de Belleville',
    type: 'studio',
    surface: 25,
    rooms: 1,
    rent: 900,
    status: 'occupied',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    id: 10,
    propertyId: 1,
    tenantIds: [1],
    startDate: new Date('2024-06-15'),
    rent: 900,
    charges: 50,
    deposit: 900,
    paymentDay: 5,
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRevision(overrides: Partial<RentRevision> = {}): RentRevision {
  return {
    id: 200,
    leaseId: 10,
    year: 2026,
    anniversaryDate: new Date('2026-06-15'),
    effectiveDate: new Date('2026-06-15'),
    referenceQuarter: 2,
    oldRent: 900,
    newRent: 918,
    currentIrl: 148,
    previousIrl: 145,
    charges: 50,
    status: 'applied',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeAdjustment(overrides: Partial<ChargesAdjustmentRow> = {}): ChargesAdjustmentRow {
  return {
    id: 300,
    leaseId: 10,
    year: 2025,
    monthlyRent: 900,
    chargesProvisionPaid: 600,
    rentsPaidCount: 12,
    rentsPaidTotal: 10800,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeInventory(overrides: Partial<Inventory> = {}): Inventory {
  return {
    id: 400,
    leaseId: 10,
    type: 'checkout',
    date: new Date('2026-06-25'),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function compute(
  overrides: Partial<{
    leases: Lease[];
    properties: Property[];
    revisions: RentRevision[];
    adjustments: ChargesAdjustmentRow[];
    inventories: Inventory[];
    now: Date;
  }> = {}
) {
  return computeActionSchedule({
    leases: [],
    properties: [],
    revisions: [],
    adjustments: [],
    inventories: [],
    now: NOW,
    ...overrides,
  });
}

// Adjustment already recorded for N-1 so charges items do not pollute revision tests.
const ADJUSTED_2025 = [makeAdjustment({ year: 2025 })];

describe('computeActionSchedule', () => {
  describe('upcoming IRL revisions', () => {
    it('schedules a revision when the lease anniversary falls within 30 days and none is applied', () => {
      const items = compute({
        leases: [makeLease()], // anniversary 2026-06-15, 14 days away
        properties: [makeProperty()],
        adjustments: ADJUSTED_2025,
      });

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        id: 'revision-10-2026',
        title: 'Réviser le loyer',
        link: { path: '/indexation' },
      });
      expect(items[0]!.date).toEqual(new Date(2026, 5, 15));
      expect(items[0]!.description).toContain('Studio Belleville');
    });

    it('does not schedule a revision already applied for that year', () => {
      const items = compute({
        leases: [makeLease()],
        revisions: [makeRevision({ status: 'applied', year: 2026 })],
        adjustments: ADJUSTED_2025,
      });

      expect(items).toHaveLength(0);
    });

    it('still schedules the revision when the existing revision is only pending', () => {
      const items = compute({
        leases: [makeLease()],
        revisions: [makeRevision({ status: 'pending', year: 2026 })],
        adjustments: ADJUSTED_2025,
      });

      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe('revision-10-2026');
    });

    it('ignores anniversaries outside the 30-day window', () => {
      const items = compute({
        leases: [makeLease({ startDate: new Date('2024-08-15') })], // 75 days away
        adjustments: ADJUSTED_2025,
      });

      expect(items).toHaveLength(0);
    });

    it('does not schedule a revision for the first year of the lease', () => {
      // Lease starts 14 days from now: same date as its "anniversary" for 2026.
      const items = compute({
        leases: [makeLease({ startDate: new Date('2026-06-15') })],
        adjustments: ADJUSTED_2025,
      });

      expect(items).toHaveLength(0);
    });

    it('ignores non-active leases', () => {
      const items = compute({
        leases: [makeLease({ status: 'ended' }), makeLease({ id: 11, status: 'pending' })],
        adjustments: [
          makeAdjustment({ id: 300, leaseId: 10, year: 2025 }),
          makeAdjustment({ id: 301, leaseId: 11, year: 2025 }),
        ],
      });

      expect(items).toHaveLength(0);
    });

    it('handles a window straddling the new year', () => {
      const december = new Date('2026-12-20T12:00:00');
      const items = compute({
        leases: [makeLease({ startDate: new Date('2024-01-10') })], // anniversary 2027-01-10
        adjustments: ADJUSTED_2025,
        now: december,
      });

      expect(items).toHaveLength(1);
      expect(items[0]!.id).toBe('revision-10-2027');
      expect(items[0]!.date).toEqual(new Date(2027, 0, 10));
    });
  });

  describe('pending charges regularizations', () => {
    it('schedules a regularization for an active lease with no adjustment row for N-1', () => {
      const items = compute({
        leases: [makeLease({ startDate: new Date('2023-03-01') })],
        properties: [makeProperty()],
      });

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        id: 'charges-10-2025',
        title: 'Régulariser les charges 2025',
        description: 'Studio Belleville',
        link: { path: '/leases/10' },
      });
    });

    it('does not schedule a regularization already recorded for N-1', () => {
      const items = compute({
        leases: [makeLease({ startDate: new Date('2023-03-01') })],
        adjustments: [makeAdjustment({ year: 2025 })],
      });

      expect(items).toHaveLength(0);
    });

    it('does not schedule a regularization for a lease that started this year', () => {
      const items = compute({
        leases: [makeLease({ startDate: new Date('2026-02-01') })],
      });

      expect(items).toHaveLength(0);
    });
  });

  describe('scheduled inventories', () => {
    it('schedules future inventories with the right title and link', () => {
      const items = compute({
        leases: [makeLease()],
        properties: [makeProperty()],
        adjustments: ADJUSTED_2025,
        revisions: [makeRevision()],
        inventories: [
          makeInventory({ id: 400, type: 'checkout', date: new Date('2026-06-25') }),
          makeInventory({ id: 401, type: 'checkin', date: new Date('2026-07-02') }),
        ],
      });

      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        id: 'inventory-400',
        title: 'État des lieux de sortie',
        description: 'Studio Belleville',
        link: { path: '/inventories' },
      });
      expect(items[1]).toMatchObject({ id: 'inventory-401', title: "État des lieux d'entrée" });
    });

    it('ignores past inventories', () => {
      const items = compute({
        inventories: [makeInventory({ date: new Date('2026-05-01') })],
      });

      expect(items).toHaveLength(0);
    });
  });

  describe('sorting and empty state', () => {
    it('sorts items ascending by date across categories', () => {
      const items = compute({
        leases: [makeLease()], // revision on 2026-06-15
        properties: [makeProperty()],
        adjustments: ADJUSTED_2025,
        inventories: [makeInventory({ date: new Date('2026-06-10') })],
      });

      expect(items.map(i => i.id)).toEqual(['inventory-400', 'revision-10-2026']);
    });

    it('returns an empty array when no action is due', () => {
      expect(compute()).toEqual([]);
    });
  });
});
