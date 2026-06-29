import { describe, it, expect } from 'vitest';
import type { IrlIndex, Lease } from '@/db/types';
import {
  quarterOf,
  quarterLabel,
  anniversaryDate,
  findIrl,
  computeIndexedRent,
  buildRevisionProposal,
  isRevisionDue,
  currentRevisionYear,
} from './indexationService';

const now = new Date('2026-06-30T10:00:00.000Z');

function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    id: 1,
    propertyId: 1,
    tenantIds: [1],
    startDate: new Date('2023-03-15'),
    rent: 750,
    charges: 80,
    deposit: 750,
    paymentDay: 5,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function irl(year: number, quarter: 1 | 2 | 3 | 4, value: number): IrlIndex {
  return { year, quarter, value, createdAt: now, updatedAt: now };
}

describe('indexationService', () => {
  describe('quarterOf', () => {
    it('maps months to quarters', () => {
      expect(quarterOf(new Date('2024-01-10'))).toBe(1);
      expect(quarterOf(new Date('2024-03-31'))).toBe(1);
      expect(quarterOf(new Date('2024-04-01'))).toBe(2);
      expect(quarterOf(new Date('2024-07-15'))).toBe(3);
      expect(quarterOf(new Date('2024-12-31'))).toBe(4);
    });
  });

  describe('quarterLabel', () => {
    it('formats a quarter label', () => {
      expect(quarterLabel(2, 2024)).toBe('T2 2024');
    });
  });

  describe('anniversaryDate', () => {
    it('keeps the day and month of the start date', () => {
      const d = anniversaryDate(new Date('2023-03-15'), 2026);
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(2); // March
      expect(d.getDate()).toBe(15);
    });
  });

  describe('findIrl', () => {
    it('finds the matching index', () => {
      const indices = [irl(2025, 1, 143.46), irl(2026, 1, 147.05)];
      expect(findIrl(indices, 2026, 1)?.value).toBe(147.05);
      expect(findIrl(indices, 2026, 2)).toBeUndefined();
    });
  });

  describe('computeIndexedRent', () => {
    it('applies the legal IRL formula rounded to cents', () => {
      // 750 * 147.05 / 143.46 = 768.766... -> 768.77
      expect(computeIndexedRent(750, 147.05, 143.46)).toBe(768.77);
    });

    it('returns the old rent when previous IRL is missing/zero', () => {
      expect(computeIndexedRent(750, 147.05, 0)).toBe(750);
    });
  });

  describe('buildRevisionProposal', () => {
    it('builds a full proposal when both indices are present', () => {
      const lease = makeLease(); // starts Q1 2023
      const indices = [irl(2025, 1, 143.46), irl(2026, 1, 147.05)];
      const result = buildRevisionProposal({ lease, indices, year: 2026 });

      expect(result.referenceQuarter).toBe(1);
      expect(result.missingIndices).toEqual([]);
      expect(result.proposal).not.toBeNull();
      expect(result.proposal!.oldRent).toBe(750);
      expect(result.proposal!.newRent).toBe(768.77);
      expect(result.proposal!.currentIrl).toBe(147.05);
      expect(result.proposal!.previousIrl).toBe(143.46);
      expect(result.proposal!.charges).toBe(80);
      expect(result.proposal!.anniversaryDate.getFullYear()).toBe(2026);
    });

    it('reports missing indices when calculation is impossible', () => {
      const lease = makeLease();
      const indices = [irl(2025, 1, 143.46)]; // missing 2026 Q1
      const result = buildRevisionProposal({ lease, indices, year: 2026 });

      expect(result.proposal).toBeNull();
      expect(result.missingIndices).toContain('T1 2026');
    });
  });

  describe('isRevisionDue', () => {
    it('is true for an active lease past its anniversary', () => {
      const lease = makeLease({ startDate: new Date('2023-03-15') });
      expect(isRevisionDue(lease, now)).toBe(true);
    });

    it('is false for an ended lease', () => {
      const lease = makeLease({ status: 'ended' });
      expect(isRevisionDue(lease, now)).toBe(false);
    });

    it('is false before the first anniversary', () => {
      const lease = makeLease({ startDate: new Date('2026-05-01') });
      expect(isRevisionDue(lease, now)).toBe(false);
    });
  });

  describe('currentRevisionYear', () => {
    it('returns the current year once the anniversary has passed', () => {
      const lease = makeLease({ startDate: new Date('2023-03-15') });
      expect(currentRevisionYear(lease, now)).toBe(2026);
    });

    it('returns the previous year when the anniversary has not occurred yet', () => {
      const lease = makeLease({ startDate: new Date('2023-11-20') });
      expect(currentRevisionYear(lease, now)).toBe(2025);
    });
  });
});
