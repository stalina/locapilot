import { describe, it, expect } from 'vitest';
import type { Lease, Rent } from '@/db/types';
import { computeOverdueRentIds, generateVirtualRents } from './rentsService';

describe('rentsService', () => {
  describe('computeOverdueRentIds', () => {
    it('returns ids for non-paid rents with past dueDate', () => {
      const now = new Date('2026-01-10T10:00:00.000Z');
      const rents: Rent[] = [
        {
          id: 1,
          leaseId: 1,
          dueDate: new Date('2026-01-01'),
          amount: 100,
          charges: 0,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 2,
          leaseId: 1,
          dueDate: new Date('2026-01-10'),
          amount: 100,
          charges: 0,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 3,
          leaseId: 1,
          dueDate: new Date('2026-01-01'),
          amount: 100,
          charges: 0,
          status: 'paid',
          paidDate: new Date('2026-01-02'),
          createdAt: now,
          updatedAt: now,
        },
        {
          leaseId: 1,
          dueDate: new Date('2026-01-01'),
          amount: 100,
          charges: 0,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        } as Rent,
      ];

      expect(computeOverdueRentIds(rents, now)).toEqual([1]);
    });
  });

  describe('generateVirtualRents', () => {
    it('generates a virtual rent when no rent exists for the target month', () => {
      const referenceDate = new Date('2026-01-04T10:00:00.000Z');
      const leases: Lease[] = [
        {
          id: 10,
          propertyId: 1,
          tenantIds: [1],
          startDate: new Date('2025-01-01'),
          rent: 1200,
          charges: 50,
          deposit: 0,
          paymentDay: 1,
          status: 'active',
          createdAt: referenceDate,
          updatedAt: referenceDate,
        },
      ];

      const existingRents: Rent[] = [];
      const virtual = generateVirtualRents({ leases, existingRents, referenceDate });

      expect(virtual).toHaveLength(1);
      expect(virtual[0]!.leaseId).toBe(10);
      expect(virtual[0]!.status).toBe('pending');
      expect(virtual[0]!.isVirtual).toBe(true);
    });

    it('does not generate if a rent already exists for that month', () => {
      const referenceDate = new Date('2026-01-04T10:00:00.000Z');
      const leases: Lease[] = [
        {
          id: 10,
          propertyId: 1,
          tenantIds: [1],
          startDate: new Date('2025-01-01'),
          rent: 1200,
          charges: 50,
          deposit: 0,
          paymentDay: 10,
          status: 'active',
          createdAt: referenceDate,
          updatedAt: referenceDate,
        },
      ];

      const existingRents: Rent[] = [
        {
          id: 99,
          leaseId: 10,
          dueDate: new Date('2026-01-10T00:00:00.000Z'),
          amount: 1200,
          charges: 50,
          status: 'pending',
          createdAt: referenceDate,
          updatedAt: referenceDate,
        },
      ];

      const virtual = generateVirtualRents({ leases, existingRents, referenceDate });
      expect(virtual).toHaveLength(0);
    });
  });
});
