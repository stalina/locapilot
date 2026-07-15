import { describe, expect, it } from 'vitest';
import {
  buildOccupancySeries,
  buildRevenuePerProperty,
  buildRevenueSeries,
} from '@/features/dashboard/services/dashboardChartsService';
import type { Lease, Property, Rent } from '@/db/types';

// Fixed "now" so month bucketing is deterministic: window is Aug 2025 → Jul 2026.
const NOW = new Date('2026-07-14T10:00:00.000Z');

function rent(overrides: Partial<Rent>): Rent {
  return {
    id: 1,
    leaseId: 1,
    dueDate: new Date('2026-07-05'),
    amount: 1000,
    charges: 0,
    status: 'paid',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Rent;
}

function lease(overrides: Partial<Lease>): Lease {
  return {
    id: 1,
    propertyId: 1,
    tenantIds: [1],
    startDate: new Date('2025-01-01'),
    rent: 1000,
    charges: 0,
    deposit: 1000,
    paymentDay: 5,
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Lease;
}

function property(overrides: Partial<Property>): Property {
  return {
    id: 1,
    name: 'Bien A',
    address: '1 rue A',
    type: 'apartment',
    surface: 40,
    rooms: 2,
    rent: 1000,
    status: 'occupied',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as Property;
}

describe('buildRevenueSeries', () => {
  it('returns one point per month for the last 12 months, oldest to newest', () => {
    const series = buildRevenueSeries({
      rents: [rent({ id: 1, status: 'paid', paidDate: new Date('2026-07-05'), paidAmount: 1200 })],
      now: NOW,
    });
    expect(series).toHaveLength(12);
    expect(series[0].label).toBe('août 2025');
    expect(series[11].label).toBe('juil. 2026');
  });

  it('sums paidAmount, falling back to amount, into the correct month', () => {
    const series = buildRevenueSeries({
      rents: [
        rent({ id: 1, status: 'paid', paidDate: new Date('2026-07-05'), paidAmount: 1200 }),
        // No paidAmount → falls back to amount (900)
        rent({ id: 2, status: 'partial', paidDate: new Date('2026-07-20'), amount: 900 }),
        // Different month (June)
        rent({ id: 3, status: 'paid', paidDate: new Date('2026-06-05'), paidAmount: 500 }),
      ],
      now: NOW,
    });
    const july = series.find(p => p.label === 'juil. 2026');
    const june = series.find(p => p.label === 'juin 2026');
    expect(july?.value).toBe(2100);
    expect(june?.value).toBe(500);
  });

  it('falls back to dueDate when paidDate is absent', () => {
    const series = buildRevenueSeries({
      rents: [
        rent({
          id: 1,
          status: 'paid',
          paidDate: undefined,
          dueDate: new Date('2026-05-05'),
          paidAmount: 700,
        }),
      ],
      now: NOW,
    });
    expect(series.find(p => p.label === 'mai 2026')?.value).toBe(700);
  });

  it('ignores pending and late rents', () => {
    const series = buildRevenueSeries({
      rents: [
        rent({ id: 1, status: 'pending', dueDate: new Date('2026-07-05'), amount: 1000 }),
        rent({ id: 2, status: 'late', dueDate: new Date('2026-07-05'), amount: 1000 }),
      ],
      now: NOW,
    });
    expect(series).toEqual([]);
  });

  it('shows months without revenue as 0 when at least one cashed rent exists', () => {
    const series = buildRevenueSeries({
      rents: [rent({ id: 1, status: 'paid', paidDate: new Date('2026-07-05'), paidAmount: 1000 })],
      now: NOW,
    });
    expect(series.find(p => p.label === 'janv. 2026')?.value).toBe(0);
  });

  it('returns an empty array when there is no cashed rent', () => {
    expect(buildRevenueSeries({ rents: [], now: NOW })).toEqual([]);
  });
});

describe('buildOccupancySeries', () => {
  it('returns an empty array when there is no property', () => {
    expect(buildOccupancySeries({ properties: [], leases: [], now: NOW })).toEqual([]);
  });

  it('computes the percentage of properties with an active lease per month', () => {
    const series = buildOccupancySeries({
      properties: [property({ id: 1 }), property({ id: 2, name: 'Bien B' })],
      leases: [lease({ id: 1, propertyId: 1, startDate: new Date('2025-01-01') })],
      now: NOW,
    });
    // Only 1 of 2 properties ever occupied → 50% every month it is active.
    expect(series.find(p => p.label === 'juil. 2026')?.value).toBe(50);
  });

  it('rounds the occupancy rate to one decimal place', () => {
    const series = buildOccupancySeries({
      properties: [
        property({ id: 1 }),
        property({ id: 2, name: 'B' }),
        property({ id: 3, name: 'C' }),
      ],
      leases: [lease({ id: 1, propertyId: 1, startDate: new Date('2025-01-01') })],
      now: NOW,
    });
    // 1/3 → 33.3
    expect(series.find(p => p.label === 'juil. 2026')?.value).toBe(33.3);
  });

  it('respects the active window boundaries (startDate <= end-of-month, endDate >= start-of-month)', () => {
    const series = buildOccupancySeries({
      properties: [property({ id: 1 })],
      leases: [
        lease({
          id: 1,
          propertyId: 1,
          // Active only during June 2026.
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-30'),
        }),
      ],
      now: NOW,
    });
    expect(series.find(p => p.label === 'mai 2026')?.value).toBe(0);
    expect(series.find(p => p.label === 'juin 2026')?.value).toBe(100);
    expect(series.find(p => p.label === 'juil. 2026')?.value).toBe(0);
  });

  it('treats a lease with no endDate as still active', () => {
    const series = buildOccupancySeries({
      properties: [property({ id: 1 })],
      leases: [
        lease({ id: 1, propertyId: 1, startDate: new Date('2025-01-01'), endDate: undefined }),
      ],
      now: NOW,
    });
    expect(series.every(p => p.value === 100)).toBe(true);
  });
});

describe('buildRevenuePerProperty', () => {
  it('groups paid amounts by property via the lease join, sorted descending', () => {
    const result = buildRevenuePerProperty({
      rents: [
        rent({
          id: 1,
          leaseId: 10,
          status: 'paid',
          paidDate: new Date('2026-07-05'),
          paidAmount: 500,
        }),
        rent({
          id: 2,
          leaseId: 20,
          status: 'paid',
          paidDate: new Date('2026-06-05'),
          paidAmount: 900,
        }),
        rent({
          id: 3,
          leaseId: 10,
          status: 'partial',
          paidDate: new Date('2026-05-05'),
          paidAmount: 300,
        }),
      ],
      leases: [lease({ id: 10, propertyId: 1 }), lease({ id: 20, propertyId: 2 })],
      properties: [property({ id: 1, name: 'Bien A' }), property({ id: 2, name: 'Bien B' })],
      now: NOW,
    });
    expect(result).toEqual([
      { label: 'Bien B', value: 900 },
      { label: 'Bien A', value: 800 },
    ]);
  });

  it('excludes a rent whose lease cannot be resolved, without throwing', () => {
    const result = buildRevenuePerProperty({
      rents: [
        rent({
          id: 1,
          leaseId: 10,
          status: 'paid',
          paidDate: new Date('2026-07-05'),
          paidAmount: 500,
        }),
        // leaseId 99 has no matching lease
        rent({
          id: 2,
          leaseId: 99,
          status: 'paid',
          paidDate: new Date('2026-07-05'),
          paidAmount: 999,
        }),
      ],
      leases: [lease({ id: 10, propertyId: 1 })],
      properties: [property({ id: 1, name: 'Bien A' })],
      now: NOW,
    });
    expect(result).toEqual([{ label: 'Bien A', value: 500 }]);
  });

  it('excludes a rent whose property cannot be resolved', () => {
    const result = buildRevenuePerProperty({
      rents: [
        rent({
          id: 1,
          leaseId: 10,
          status: 'paid',
          paidDate: new Date('2026-07-05'),
          paidAmount: 500,
        }),
      ],
      // Lease points to a property (id 42) absent from the properties list.
      leases: [lease({ id: 10, propertyId: 42 })],
      properties: [property({ id: 1, name: 'Bien A' })],
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it('ignores rents older than the 12-month window', () => {
    const result = buildRevenuePerProperty({
      rents: [
        rent({
          id: 1,
          leaseId: 10,
          status: 'paid',
          paidDate: new Date('2024-01-05'),
          paidAmount: 500,
        }),
      ],
      leases: [lease({ id: 10, propertyId: 1 })],
      properties: [property({ id: 1, name: 'Bien A' })],
      now: NOW,
    });
    expect(result).toEqual([]);
  });

  it('returns an empty array when no rents resolve to a property', () => {
    expect(buildRevenuePerProperty({ rents: [], leases: [], properties: [], now: NOW })).toEqual(
      []
    );
  });
});
