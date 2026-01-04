import { describe, expect, it } from 'vitest';
import {
  buildRecentActivities,
  buildUpcomingEvents,
  computeDashboardStats,
} from '@/features/dashboard/services/dashboardService';

describe('dashboardService', () => {
  it('computeDashboardStats computes occupancy and monthly metrics', () => {
    const properties: any[] = [
      { status: 'occupied' },
      { status: 'vacant' },
      { status: 'occupied' },
    ];
    const rentsThisMonth: any[] = [
      { status: 'paid', amount: 500 },
      { status: 'paid', amount: 700 },
      { status: 'pending', amount: 700 },
      { status: 'late', amount: 700 },
    ];

    const stats = computeDashboardStats(properties as any, rentsThisMonth as any);

    expect(stats.totalProperties).toBe(3);
    expect(stats.occupancyRate).toBe(66.7);
    expect(stats.monthlyRevenue).toBe(1200);
    expect(stats.pendingRents).toBe(2);
  });

  it('buildRecentActivities builds at most 6 items sorted desc by date', () => {
    const now = new Date('2026-01-04T12:00:00.000Z');

    const rents: any[] = [
      {
        id: 1,
        status: 'paid',
        amount: 500,
        leaseId: 10,
        paidDate: '2026-01-04T11:59:00.000Z',
        paidAmount: 500,
      },
      { id: 2, status: 'pending', amount: 700, leaseId: 11, dueDate: '2026-01-03T00:00:00.000Z' },
    ];
    const leases: any[] = [{ id: 99, propertyId: 123, tenantIds: [1, 2], createdAt: '2026-01-02' }];
    const inventories: any[] = [{ id: 5, leaseId: 10, type: 'checkin', date: '2026-01-01' }];
    const communications: any[] = [
      { id: 7, type: 'meeting', subject: 'Visite', content: 'Test', date: '2026-01-03T10:00:00Z' },
    ];

    const items = buildRecentActivities({ rents, leases, inventories, communications, now });

    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(6);

    // first item should be the most recent (paid rent)
    expect(items[0].type).toBe('payment');
    expect(items[0].title).toBe('Paiement reçu');
    expect(items[0].badge?.label).toContain('€');
  });

  it('buildUpcomingEvents includes rents due in next 30 days and meetings/inventories', () => {
    const now = new Date('2026-01-04T12:00:00.000Z');

    const rents: any[] = [
      { id: 1, amount: 500, leaseId: 10, dueDate: '2026-01-10T00:00:00.000Z' },
      { id: 2, amount: 500, leaseId: 10, dueDate: '2026-03-10T00:00:00.000Z' },
    ];
    const inventories: any[] = [{ id: 3, leaseId: 10, type: 'checkout', date: '2026-01-05' }];
    const communications: any[] = [
      { id: 4, type: 'meeting', subject: 'Visite appartement', content: 'Ok', date: '2026-01-06' },
    ];

    const events = buildUpcomingEvents({ rents, inventories, communications, now });

    expect(events.some(e => e.title.includes('Échéance'))).toBe(true);
    expect(events.some(e => e.title.includes('État des lieux'))).toBe(true);
    expect(events.some(e => e.title.toLowerCase().includes('visite'))).toBe(true);
  });
});
