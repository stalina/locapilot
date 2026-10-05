import { describe, expect, it } from 'vitest';
import type { Communication, Inventory, Lease, Property, Rent } from '@/db/types';
import {
  buildRecentActivities,
  buildUpcomingEvents,
  computeDashboardStats,
} from '@/features/dashboard/services/dashboardService';

const CREATED = new Date('2025-12-01T00:00:00.000Z');

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    name: 'Bien',
    address: '1 rue A',
    type: 'apartment',
    surface: 40,
    rooms: 2,
    rent: 700,
    status: 'vacant',
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

function makeRent(overrides: Partial<Rent> = {}): Rent {
  return {
    leaseId: 10,
    dueDate: new Date('2026-01-05T00:00:00.000Z'),
    amount: 500,
    charges: 0,
    status: 'pending',
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    propertyId: 1,
    tenantIds: [1],
    startDate: new Date('2026-01-01'),
    rent: 500,
    charges: 0,
    deposit: 500,
    paymentDay: 5,
    status: 'active',
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

function makeInventory(overrides: Partial<Inventory> = {}): Inventory {
  return {
    leaseId: 10,
    type: 'checkin',
    date: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeCommunication(overrides: Partial<Communication> = {}): Communication {
  return {
    relatedEntityType: 'tenant',
    relatedEntityId: 1,
    type: 'meeting',
    direction: 'outbound',
    content: 'Test',
    date: new Date('2026-01-03T10:00:00Z'),
    createdAt: CREATED,
    ...overrides,
  };
}

describe('dashboardService', () => {
  it('computeDashboardStats computes occupancy and monthly metrics', () => {
    const properties = [
      makeProperty({ status: 'occupied' }),
      makeProperty({ status: 'vacant' }),
      makeProperty({ status: 'occupied' }),
    ];
    const rentsThisMonth = [
      makeRent({ status: 'paid', amount: 500 }),
      makeRent({ status: 'paid', amount: 700 }),
      makeRent({ status: 'pending', amount: 700 }),
      makeRent({ status: 'late', amount: 700 }),
    ];

    const stats = computeDashboardStats(properties, rentsThisMonth);

    expect(stats.totalProperties).toBe(3);
    expect(stats.occupancyRate).toBe(66.7);
    expect(stats.monthlyRevenue).toBe(1200);
    expect(stats.pendingRents).toBe(2);
    expect(stats.rentsNeedingReminder).toBe(0);
  });

  it('computeDashboardStats counts rents needing a reminder when a reminder context is given', () => {
    const now = new Date('2026-06-15');
    const allRents = [
      makeRent({ id: 1, status: 'late', dueDate: new Date('2026-05-01'), amount: 800 }),
      makeRent({ id: 2, status: 'paid', dueDate: new Date('2026-05-01'), amount: 800 }),
    ];

    const stats = computeDashboardStats([], [], {
      allRents,
      reminders: [],
      thresholds: [{ level: 'amiable', days: 30, enabled: true }],
      now,
    });

    expect(stats.rentsNeedingReminder).toBe(1);
  });

  it('buildRecentActivities builds at most 6 items sorted desc by date', () => {
    const now = new Date('2026-01-04T12:00:00.000Z');

    const rents = [
      makeRent({
        id: 1,
        status: 'paid',
        amount: 500,
        leaseId: 10,
        paidDate: new Date('2026-01-04T11:59:00.000Z'),
        paidAmount: 500,
      }),
      makeRent({
        id: 2,
        status: 'pending',
        amount: 700,
        leaseId: 11,
        dueDate: new Date('2026-01-03T00:00:00.000Z'),
      }),
    ];
    const leases = [
      makeLease({ id: 99, propertyId: 123, tenantIds: [1, 2], createdAt: new Date('2026-01-02') }),
    ];
    const inventories = [
      makeInventory({ id: 5, leaseId: 10, type: 'checkin', date: new Date('2026-01-01') }),
    ];
    const communications = [
      makeCommunication({
        id: 7,
        type: 'meeting',
        subject: 'Visite',
        content: 'Test',
        date: new Date('2026-01-03T10:00:00Z'),
      }),
    ];

    const items = buildRecentActivities({ rents, leases, inventories, communications, now });

    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(6);

    // first item should be the most recent (paid rent)
    expect(items[0]?.type).toBe('payment');
    expect(items[0]?.title).toBe('Paiement reçu');
    expect(items[0]?.badge?.label).toContain('€');
  });

  it('buildUpcomingEvents includes rents due in next 30 days and meetings/inventories', () => {
    const now = new Date('2026-01-04T12:00:00.000Z');

    const rents = [
      makeRent({ id: 1, amount: 500, leaseId: 10, dueDate: new Date('2026-01-10T00:00:00.000Z') }),
      makeRent({ id: 2, amount: 500, leaseId: 10, dueDate: new Date('2026-03-10T00:00:00.000Z') }),
    ];
    const inventories = [
      makeInventory({ id: 3, leaseId: 10, type: 'checkout', date: new Date('2026-01-05') }),
    ];
    const communications = [
      makeCommunication({
        id: 4,
        type: 'meeting',
        subject: 'Visite appartement',
        content: 'Ok',
        date: new Date('2026-01-06'),
      }),
    ];

    const events = buildUpcomingEvents({ rents, inventories, communications, now });

    expect(events.some(e => e.title.includes('Échéance'))).toBe(true);
    expect(events.some(e => e.title.includes('État des lieux'))).toBe(true);
    expect(events.some(e => e.title.toLowerCase().includes('visite'))).toBe(true);
  });
});
