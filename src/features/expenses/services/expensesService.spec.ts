import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Expense, Lease, Property, Rent } from '@/db/types';

vi.mock('@/features/properties/repositories/propertiesRepository', () => ({
  fetchPropertyById: vi.fn(),
}));

import { fetchPropertyById } from '@/features/properties/repositories/propertiesRepository';
import {
  EXPENSE_CATEGORIES,
  availableYears,
  collectedRentShare,
  computeExpenses,
  computeIncome,
  computeProfitability,
  documentTypeForCategory,
  getExpenseCategoryLabel,
  getExpenseFieldErrors,
  isExpenseCategory,
  parseDateInput,
  toDateInputValue,
  validateExpense,
  yearOf,
  type ExpenseDraft,
} from './expensesService';

const NOW = new Date('2026-03-10T10:00:00');

function lease(id: number, propertyId: number, status: Lease['status'] = 'active'): Lease {
  return {
    id,
    propertyId,
    tenantIds: [1],
    startDate: new Date('2025-01-01'),
    rent: 800,
    charges: 50,
    deposit: 800,
    paymentDay: 5,
    status,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function rent(overrides: Partial<Rent> & Pick<Rent, 'leaseId'>): Rent {
  return {
    dueDate: new Date(2026, 2, 5, 12),
    amount: 800,
    charges: 50,
    status: 'paid',
    paidDate: new Date(2026, 2, 5, 12),
    paidAmount: 850,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 1,
    propertyId: 1,
    category: 'works',
    label: 'Travaux',
    amount: 100,
    date: new Date(2026, 3, 2, 12),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function draft(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return {
    propertyId: 1,
    category: 'property-tax',
    label: 'Taxe foncière 2026',
    amount: 1250,
    date: new Date(2026, 9, 15, 12),
    ...overrides,
  };
}

describe('expensesService', () => {
  describe('categories', () => {
    it('lists the six categories with their FR labels', () => {
      expect(EXPENSE_CATEGORIES.map(c => [c.value, c.label])).toEqual([
        ['works', 'Travaux'],
        ['property-tax', 'Taxe foncière'],
        ['insurance', 'Assurance (PNO)'],
        ['maintenance', 'Entretien'],
        ['condo-fees', 'Charges de copropriété'],
        ['other', 'Autre'],
      ]);
    });

    it('maps each category to the default document type of its receipt', () => {
      expect(documentTypeForCategory('works')).toBe('invoice');
      expect(documentTypeForCategory('property-tax')).toBe('invoice');
      expect(documentTypeForCategory('maintenance')).toBe('invoice');
      expect(documentTypeForCategory('condo-fees')).toBe('invoice');
      expect(documentTypeForCategory('insurance')).toBe('insurance');
      expect(documentTypeForCategory('other')).toBe('other');
    });

    it('resolves labels and recognises valid categories', () => {
      expect(getExpenseCategoryLabel('insurance')).toBe('Assurance (PNO)');
      expect(isExpenseCategory('condo-fees')).toBe(true);
      expect(isExpenseCategory('rent')).toBe(false);
      expect(isExpenseCategory('')).toBe(false);
    });
  });

  describe('getExpenseFieldErrors', () => {
    it('returns no error for a valid draft', () => {
      expect(getExpenseFieldErrors(draft())).toEqual({});
    });

    it.each([0, -50, Number.NaN, null, undefined])('rejects the amount %s', amount => {
      expect(getExpenseFieldErrors(draft({ amount })).amount).toBe(
        'Le montant doit être supérieur à 0'
      );
    });

    it.each(['', '   ', null])('rejects the label %j', label => {
      expect(getExpenseFieldErrors(draft({ label })).label).toBe('Le libellé est requis');
    });

    it('rejects a missing or unknown category', () => {
      expect(getExpenseFieldErrors(draft({ category: '' })).category).toBe(
        'La catégorie est requise'
      );
      expect(
        getExpenseFieldErrors(draft({ category: 'rent' as unknown as ExpenseDraft['category'] }))
          .category
      ).toBe('La catégorie est requise');
    });

    it('rejects a missing or invalid date', () => {
      expect(getExpenseFieldErrors(draft({ date: null })).date).toBe('La date est requise');
      expect(getExpenseFieldErrors(draft({ date: '' })).date).toBe('La date est requise');
      expect(getExpenseFieldErrors(draft({ date: 'not-a-date' })).date).toBe('La date est requise');
    });

    it('accepts a date in the future', () => {
      expect(getExpenseFieldErrors(draft({ date: new Date(2099, 0, 1) }))).toEqual({});
    });
  });

  describe('validateExpense', () => {
    beforeEach(() => {
      vi.mocked(fetchPropertyById).mockReset();
      vi.mocked(fetchPropertyById).mockResolvedValue({ id: 1 } as Property);
    });

    it('normalises a valid draft (trimmed label/notes, amount rounded to the cent)', async () => {
      const result = await validateExpense(
        draft({ label: '  Taxe foncière  ', amount: 89.904, notes: '  avis n°12 ' })
      );
      expect(result).toEqual({
        propertyId: 1,
        category: 'property-tax',
        label: 'Taxe foncière',
        amount: 89.9,
        date: new Date(2026, 9, 15, 12),
        notes: 'avis n°12',
      });
    });

    it('omits empty notes and parses string dates', async () => {
      const result = await validateExpense(draft({ notes: '   ', date: '2026-10-15T12:00:00' }));
      expect(result).not.toHaveProperty('notes');
      expect(result.date).toEqual(new Date(2026, 9, 15, 12));
    });

    it('throws the first field error without querying the property', async () => {
      await expect(validateExpense(draft({ amount: 0 }))).rejects.toThrow(
        'Le montant doit être supérieur à 0'
      );
      expect(fetchPropertyById).not.toHaveBeenCalled();
    });

    it('throws "Bien introuvable" when the property does not exist', async () => {
      vi.mocked(fetchPropertyById).mockResolvedValue(undefined);
      await expect(validateExpense(draft({ propertyId: 999 }))).rejects.toThrow('Bien introuvable');
      expect(fetchPropertyById).toHaveBeenCalledWith(999);
    });

    it('throws "Bien introuvable" for a non-finite property id', async () => {
      await expect(validateExpense(draft({ propertyId: Number.NaN }))).rejects.toThrow(
        'Bien introuvable'
      );
      expect(fetchPropertyById).not.toHaveBeenCalled();
    });
  });

  describe('collectedRentShare', () => {
    it('counts the rent excluding charges for a paid rent', () => {
      expect(collectedRentShare(rent({ leaseId: 1, amount: 800, charges: 50 }))).toBe(800);
    });

    it('allocates a partial payment proportionally between rent and charges', () => {
      expect(
        collectedRentShare(
          rent({ leaseId: 1, status: 'partial', amount: 800, charges: 200, paidAmount: 500 })
        )
      ).toBe(400);
    });

    it('rounds the partial share to the cent', () => {
      expect(
        collectedRentShare(
          rent({ leaseId: 1, status: 'partial', amount: 700, charges: 200, paidAmount: 100 })
        )
      ).toBe(77.78);
    });

    it('counts 0 for a partial rent whose amount + charges is 0 or without paidAmount', () => {
      expect(
        collectedRentShare(
          rent({ leaseId: 1, status: 'partial', amount: 0, charges: 0, paidAmount: 10 })
        )
      ).toBe(0);
      expect(
        collectedRentShare(rent({ leaseId: 1, status: 'partial', paidAmount: undefined }))
      ).toBe(0);
    });

    it.each(['pending', 'late'] as const)('counts 0 for a %s rent', status => {
      expect(collectedRentShare(rent({ leaseId: 1, status }))).toBe(0);
    });
  });

  describe('computeIncome', () => {
    const leases = [lease(1, 1, 'ended'), lease(2, 1, 'active'), lease(3, 2, 'active')];

    it('sums 12 rents paid in full, excluding charges', () => {
      const rents = Array.from({ length: 12 }, (_, m) =>
        rent({ leaseId: 2, paidDate: new Date(2026, m, 5, 12) })
      );
      expect(computeIncome(rents, leases, 1, 2026)).toBe(9600);
    });

    it('ignores pending and late rents', () => {
      const rents = [
        rent({ leaseId: 2, status: 'late', paidDate: undefined }),
        rent({ leaseId: 2, status: 'pending', paidDate: undefined }),
      ];
      expect(computeIncome(rents, leases, 1, 2026)).toBe(0);
    });

    it('attributes a rent to the year of payment', () => {
      const rents = [
        rent({ leaseId: 2, dueDate: new Date(2025, 11, 5, 12), paidDate: new Date(2026, 0, 8) }),
      ];
      expect(computeIncome(rents, leases, 1, 2026)).toBe(800);
      expect(computeIncome(rents, leases, 1, 2025)).toBe(0);
    });

    it('falls back to the due date when the paid date is empty', () => {
      const rents = [rent({ leaseId: 2, paidDate: undefined, dueDate: new Date(2026, 2, 5) })];
      expect(computeIncome(rents, leases, 1, 2026)).toBe(800);
    });

    it('includes rents of ended leases of the property', () => {
      const rents = [
        rent({ leaseId: 1, paidDate: new Date(2026, 5, 5) }),
        rent({ leaseId: 2, paidDate: new Date(2026, 7, 5) }),
      ];
      expect(computeIncome(rents, leases, 1, 2026)).toBe(1600);
    });

    it('ignores rents of other properties and orphan rents without throwing', () => {
      const rents = [rent({ leaseId: 3 }), rent({ leaseId: 999 })];
      expect(() => computeIncome(rents, leases, 1, 2026)).not.toThrow();
      expect(computeIncome(rents, leases, 1, 2026)).toBe(0);
    });

    it('ignores leases without id', () => {
      const leaseWithoutId: Lease = { ...lease(0, 1), id: undefined };
      expect(computeIncome([rent({ leaseId: 0 })], [leaseWithoutId], 1, 2026)).toBe(0);
    });
  });

  describe('computeExpenses', () => {
    it('sums the expenses of the year with a per-category breakdown', () => {
      const expenses = [
        expense({ id: 1, category: 'works', amount: 2000 }),
        expense({ id: 2, category: 'property-tax', amount: 1250 }),
        expense({ id: 3, category: 'maintenance', amount: 150 }),
      ];
      expect(computeExpenses(expenses, 1, 2026)).toEqual({
        total: 3400,
        byCategory: [
          { category: 'works', label: 'Travaux', total: 2000 },
          { category: 'property-tax', label: 'Taxe foncière', total: 1250 },
          { category: 'maintenance', label: 'Entretien', total: 150 },
        ],
      });
    });

    it('groups several expenses of the same category and rounds to the cent', () => {
      const expenses = [
        expense({ id: 1, category: 'other', amount: 0.1 }),
        expense({ id: 2, category: 'other', amount: 0.2 }),
      ];
      expect(computeExpenses(expenses, 1, 2026)).toEqual({
        total: 0.3,
        byCategory: [{ category: 'other', label: 'Autre', total: 0.3 }],
      });
    });

    it('excludes other years and other properties', () => {
      const expenses = [
        expense({ id: 1, amount: 500, date: new Date(2025, 11, 28, 12) }),
        expense({ id: 2, amount: 300, propertyId: 2 }),
        expense({ id: 3, amount: 89.9 }),
      ];
      expect(computeExpenses(expenses, 1, 2026).total).toBe(89.9);
      expect(computeExpenses(expenses, 1, 2025).total).toBe(500);
    });

    it('returns 0 and no breakdown without expenses', () => {
      expect(computeExpenses([], 1, 2026)).toEqual({ total: 0, byCategory: [] });
    });
  });

  describe('computeProfitability', () => {
    it('computes the gross and net yields on purchase price + acquisition costs', () => {
      expect(
        computeProfitability({
          income: 9600,
          expenses: 2400,
          purchasePrice: 180000,
          acquisitionCosts: 15000,
        })
      ).toEqual({
        income: 9600,
        expenses: 2400,
        netResult: 7200,
        investment: 195000,
        grossYield: 4.92,
        netYield: 3.69,
      });
    });

    it('handles a negative net result', () => {
      const result = computeProfitability({
        income: 3000,
        expenses: 12000,
        purchasePrice: 150000,
      });
      expect(result.netResult).toBe(-9000);
      expect(result.investment).toBe(150000);
      expect(result.netYield).toBe(-6);
      expect(result.grossYield).toBe(2);
    });

    it('treats acquisition costs as optional', () => {
      const result = computeProfitability({
        income: 10000,
        expenses: 0,
        purchasePrice: 200000,
        acquisitionCosts: null,
      });
      expect(result.investment).toBe(200000);
      expect(result.grossYield).toBe(5);
    });

    it.each([undefined, null, 0])(
      'cannot compute the yields when the purchase price is %s',
      purchasePrice => {
        expect(computeProfitability({ income: 9600, expenses: 2400, purchasePrice })).toEqual({
          income: 9600,
          expenses: 2400,
          netResult: 7200,
          investment: null,
          grossYield: null,
          netYield: null,
        });
      }
    );

    it('returns 0 % yields for a year without income nor expense', () => {
      const result = computeProfitability({ income: 0, expenses: 0, purchasePrice: 100000 });
      expect(result).toMatchObject({ netResult: 0, grossYield: 0, netYield: 0 });
    });
  });

  describe('availableYears', () => {
    it('lists the years with an expense or a collected rent plus the current year, descending', () => {
      const years = availableYears({
        expenses: [
          expense({ id: 1, date: new Date(2025, 5, 10) }),
          expense({ id: 2, date: new Date(2026, 0, 15) }),
          expense({ id: 3, date: new Date(2021, 0, 15), propertyId: 2 }),
        ],
        rents: [
          rent({ leaseId: 1, paidDate: new Date(2023, 4, 5) }),
          rent({ leaseId: 1, status: 'pending', paidDate: undefined, dueDate: new Date(2022, 0) }),
          rent({ leaseId: 3, paidDate: new Date(2020, 0, 5) }),
        ],
        leases: [lease(1, 1), lease(3, 2)],
        propertyId: 1,
        currentYear: 2027,
      });
      expect(years).toEqual([2027, 2026, 2025, 2023]);
    });

    it('returns only the current year without data', () => {
      expect(
        availableYears({ expenses: [], rents: [], leases: [], propertyId: 1, currentYear: 2026 })
      ).toEqual([2026]);
    });
  });

  describe('date helpers', () => {
    it('yearOf returns the local calendar year or null', () => {
      expect(yearOf(new Date(2026, 0, 1, 0, 30))).toBe(2026);
      expect(yearOf('2025-12-31T12:00:00')).toBe(2025);
      expect(yearOf(undefined)).toBeNull();
      expect(yearOf('invalid')).toBeNull();
    });

    it('parseDateInput parses YYYY-MM-DD as a local date at noon', () => {
      expect(parseDateInput('2026-10-15')).toEqual(new Date(2026, 9, 15, 12));
      expect(parseDateInput('')).toBeNull();
      expect(parseDateInput('15/10/2026')).toBeNull();
      expect(parseDateInput('2026-13-45')).toBeNull();
    });

    it('toDateInputValue formats a local YYYY-MM-DD value', () => {
      expect(toDateInputValue(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
      expect(toDateInputValue(null)).toBe('');
    });
  });
});
