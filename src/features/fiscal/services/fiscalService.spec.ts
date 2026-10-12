import { describe, it, expect } from 'vitest';
import type { Expense, ExpenseCategory, Lease, Property, Rent } from '@/db/types';
import {
  EXPENSE_CATEGORY_TO_2044_LINE,
  FISCAL_DISCLAIMER,
  LINES_2044,
  MANUAL_LINE_REMARK,
  availableFiscalYears,
  build2044Csv,
  build2044Table,
  compute2044Values,
  computeFiscalYear,
  defaultFiscalYear,
  escapeCsvCell,
  fiscalCsvFilename,
  isMicroFoncierEligible,
  roundEuro,
  type PropertyFiscalSummary,
} from './fiscalService';

const NOW = new Date('2026-04-15T10:00:00');

function property(id: number, name: string): Property {
  return {
    id,
    name,
    address: '1 rue X',
    postalCode: '75011',
    town: 'Paris',
    type: 'apartment',
    surface: 40,
    rooms: 2,
    rent: 800,
    charges: 50,
    status: 'occupied',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function lease(id: number, propertyId: number, status: Lease['status'] = 'active'): Lease {
  return {
    id,
    propertyId,
    tenantIds: [1],
    startDate: new Date(2024, 0, 1),
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
    dueDate: new Date(2025, 2, 5, 12),
    amount: 800,
    charges: 50,
    status: 'paid',
    paidDate: new Date(2025, 2, 5, 12),
    paidAmount: 850,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** 12 monthly rents paid in `year`. */
function yearOfRents(leaseId: number, amount: number, charges: number, year = 2025): Rent[] {
  return Array.from({ length: 12 }, (_, m) =>
    rent({
      leaseId,
      amount,
      charges,
      paidAmount: amount + charges,
      dueDate: new Date(year, m, 5, 12),
      paidDate: new Date(year, m, 5, 12),
    })
  );
}

let expenseId = 0;
function expense(
  propertyId: number,
  category: ExpenseCategory,
  amount: number,
  date = new Date(2025, 5, 1, 12),
  label = 'Dépense'
): Expense {
  expenseId += 1;
  return {
    id: expenseId,
    propertyId,
    category,
    label,
    amount,
    date,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const GAMBETTA = property(1, 'Appart Gambetta T2');
const LILAS = property(2, 'Maison Lilas');

/** Spec scenario "Full 2044 computation for two properties". */
function twoPropertiesInput() {
  return {
    properties: [LILAS, GAMBETTA],
    leases: [lease(10, 1), lease(20, 2)],
    rents: [...yearOfRents(10, 800, 50), ...yearOfRents(20, 500, 0)],
    expenses: [
      expense(1, 'management-fees', 480),
      expense(1, 'insurance', 180),
      expense(1, 'works', 2000),
      expense(1, 'maintenance', 150),
      expense(1, 'property-tax', 1250),
      expense(1, 'condo-fees', 600),
      expense(1, 'loan-interest', 2100),
      expense(2, 'property-tax', 900),
      expense(2, 'works', 8000),
      expense(2, 'loan-interest', 3000),
    ],
    year: 2025,
  };
}

function summaryOf(list: PropertyFiscalSummary[], name: string): PropertyFiscalSummary {
  const found = list.find(s => s.name === name);
  if (!found) throw new Error(`${name} not listed`);
  return found;
}

describe('fiscalService', () => {
  describe('EXPENSE_CATEGORY_TO_2044_LINE', () => {
    it('maps every category to its 2044 line, "other" being unmapped', () => {
      expect(EXPENSE_CATEGORY_TO_2044_LINE).toEqual({
        'management-fees': 221,
        insurance: 223,
        works: 224,
        maintenance: 224,
        'property-tax': 227,
        'condo-fees': 229,
        'loan-interest': 250,
        other: null,
      });
    });

    it('lists the 2044 lines from 211 to 261 in form order', () => {
      expect(LINES_2044.map(l => l.line)).toEqual([
        211, 212, 213, 214, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 240, 250, 261,
      ]);
      expect(LINES_2044.filter(l => l.manual).map(l => l.line)).toEqual([
        212, 213, 225, 226, 228, 230,
      ]);
    });
  });

  describe('computeFiscalYear — income', () => {
    it('computes rent income, charges collected and rents count per property', () => {
      const result = computeFiscalYear(twoPropertiesInput());
      expect(summaryOf(result, 'Appart Gambetta T2')).toMatchObject({
        rentIncome: 9600,
        chargesCollected: 600,
        rentsCollected: 12,
      });
      expect(summaryOf(result, 'Maison Lilas')).toMatchObject({
        rentIncome: 6000,
        chargesCollected: 0,
        rentsCollected: 12,
      });
    });

    it('lists properties sorted by name', () => {
      expect(computeFiscalYear(twoPropertiesInput()).map(s => s.name)).toEqual([
        'Appart Gambetta T2',
        'Maison Lilas',
      ]);
    });

    it('splits a partial payment between rent and charges', () => {
      const [summary] = computeFiscalYear({
        properties: [GAMBETTA],
        leases: [lease(10, 1)],
        rents: [
          rent({
            leaseId: 10,
            amount: 800,
            charges: 200,
            status: 'partial',
            paidAmount: 500,
            paidDate: new Date(2025, 2, 8, 12),
          }),
        ],
        expenses: [],
        year: 2025,
      });
      expect(summary).toMatchObject({ rentIncome: 400, chargesCollected: 100, rentsCollected: 1 });
    });

    it('attributes income to the year of payment', () => {
      const input = {
        properties: [GAMBETTA],
        leases: [lease(10, 1)],
        rents: [
          rent({
            leaseId: 10,
            dueDate: new Date(2024, 11, 5, 12),
            paidDate: new Date(2025, 0, 8, 12),
          }),
        ],
        expenses: [],
      };
      expect(computeFiscalYear({ ...input, year: 2024 })).toEqual([]);
      expect(computeFiscalYear({ ...input, year: 2025 })[0]?.rentIncome).toBe(800);
    });

    it('falls back to the due date when the paid date is missing', () => {
      const [summary] = computeFiscalYear({
        properties: [GAMBETTA],
        leases: [lease(10, 1)],
        rents: [rent({ leaseId: 10, paidDate: undefined, dueDate: new Date(2025, 2, 5, 12) })],
        expenses: [],
        year: 2025,
      });
      expect(summary?.rentIncome).toBe(800);
    });

    it('does not declare late or pending rents', () => {
      const result = computeFiscalYear({
        properties: [GAMBETTA],
        leases: [lease(10, 1)],
        rents: [
          rent({ leaseId: 10, status: 'late', paidDate: undefined }),
          rent({ leaseId: 10, status: 'pending', paidDate: undefined }),
        ],
        expenses: [expense(1, 'insurance', 100)],
        year: 2025,
      });
      expect(result[0]).toMatchObject({ rentIncome: 0, chargesCollected: 0, rentsCollected: 0 });
    });

    it('includes rents of ended leases', () => {
      const [summary] = computeFiscalYear({
        properties: [GAMBETTA],
        leases: [lease(10, 1, 'ended'), lease(11, 1)],
        rents: [
          rent({ leaseId: 10, paidDate: new Date(2025, 5, 5, 12) }),
          rent({ leaseId: 11, paidDate: new Date(2025, 8, 5, 12) }),
        ],
        expenses: [],
        year: 2025,
      });
      expect(summary).toMatchObject({ rentIncome: 1600, rentsCollected: 2 });
    });

    it('ignores orphan rents without throwing', () => {
      const run = () =>
        computeFiscalYear({
          properties: [GAMBETTA],
          leases: [lease(10, 1), lease(99, 404)],
          rents: [rent({ leaseId: 12345 }), rent({ leaseId: 99 })],
          expenses: [],
          year: 2025,
        });
      expect(run).not.toThrow();
      expect(run()).toEqual([]);
    });

    it('does not list properties without activity in the year', () => {
      const input = twoPropertiesInput();
      const result = computeFiscalYear({
        ...input,
        properties: [...input.properties, property(3, 'Studio Nation')],
        expenses: [...input.expenses, expense(3, 'works', 300, new Date(2024, 5, 1, 12))],
      });
      expect(result.map(s => s.name)).not.toContain('Studio Nation');
    });

    it('ignores properties without id', () => {
      const noId = { ...GAMBETTA, id: undefined };
      expect(
        computeFiscalYear({ ...twoPropertiesInput(), properties: [noId] as Property[] })
      ).toEqual([]);
    });
  });

  describe('computeFiscalYear — expenses', () => {
    it('attributes expenses to their 2044 line', () => {
      const gambetta = summaryOf(computeFiscalYear(twoPropertiesInput()), 'Appart Gambetta T2');
      expect(gambetta.expensesByLine).toEqual({
        221: 480,
        223: 180,
        224: 2150,
        227: 1250,
        229: 600,
        250: 2100,
      });
    });

    it('lists "other" expenses as unallocated and never deducts them', () => {
      const [summary] = computeFiscalYear({
        properties: [GAMBETTA],
        leases: [],
        rents: [],
        expenses: [expense(1, 'other', 75, new Date(2025, 4, 2, 12), 'Frais divers')],
        year: 2025,
      });
      expect(summary?.unallocatedTotal).toBe(75);
      expect(summary?.unallocatedExpenses.map(e => e.label)).toEqual(['Frais divers']);
      expect(Object.values(summary?.expensesByLine ?? {})).toEqual([0, 0, 0, 0, 0, 0]);
      expect(compute2044Values(summary as PropertyFiscalSummary)[240]).toBe(0);
    });

    it('details the expenses of the year sorted by date ascending', () => {
      const [summary] = computeFiscalYear({
        properties: [GAMBETTA],
        leases: [],
        rents: [],
        expenses: [
          expense(1, 'works', 100, new Date(2025, 8, 15, 12), 'Septembre'),
          expense(1, 'insurance', 50, '2025-02-01T12:00:00' as unknown as Date, 'Février'),
          expense(1, 'works', 70, new Date(2024, 11, 20, 12), 'Décembre 2024'),
        ],
        year: 2025,
      });
      expect(summary?.expenses.map(e => e.label)).toEqual(['Février', 'Septembre']);
      expect(summary?.expenses[0]).toMatchObject({
        category: 'insurance',
        categoryLabel: 'Assurance (PNO)',
        amount: 50,
        line: 223,
      });
      expect(summary?.expenses[0]?.date).toBeInstanceOf(Date);
    });

    it('ignores expenses of other years', () => {
      const [summary] = computeFiscalYear({
        properties: [GAMBETTA],
        leases: [lease(10, 1)],
        rents: [rent({ leaseId: 10 })],
        expenses: [
          expense(1, 'works', 500, new Date(2024, 11, 28, 12)),
          expense(1, 'works', 300, new Date(2026, 0, 3, 12)),
        ],
        year: 2025,
      });
      expect(summary?.expenses).toEqual([]);
      expect(summary?.expensesByLine[224]).toBe(0);
    });
  });

  describe('build2044Table', () => {
    it('computes the full 2044 table for two properties', () => {
      const perProperty = computeFiscalYear(twoPropertiesInput());
      const table = build2044Table(perProperty, [1, 2]);
      expect(table.columns.map(c => c.name)).toEqual(['Appart Gambetta T2', 'Maison Lilas']);

      expect(table.columns[0]?.values).toMatchObject({
        211: 9600,
        214: 9600,
        221: 480,
        222: 20,
        223: 180,
        224: 2150,
        227: 1250,
        229: 600,
        240: 4680,
        250: 2100,
        261: 2820,
      });
      expect(table.columns[1]?.values).toMatchObject({
        211: 6000,
        214: 6000,
        222: 20,
        224: 8000,
        227: 900,
        240: 8920,
        250: 3000,
        261: -5920,
      });
      expect(table.totals).toMatchObject({ 211: 15600, 240: 13600, 250: 5100, 261: -3100 });

      const row261 = table.rows.find(r => r.line === 261);
      expect(row261).toMatchObject({ amounts: [2820, -5920], total: -3100 });
    });

    it('applies the 20 € flat fee only to properties with income', () => {
      const [summary] = computeFiscalYear({
        properties: [property(3, 'Parking Voltaire')],
        leases: [],
        rents: [],
        expenses: [expense(3, 'property-tax', 120)],
        year: 2025,
      });
      const table = build2044Table([summary as PropertyFiscalSummary], new Set([3]));
      expect(table.totals[222]).toBe(0);
      expect(table.totals[261]).toBe(-120);
    });

    it('sets untracked lines to 0 and flags them', () => {
      const table = build2044Table(computeFiscalYear(twoPropertiesInput()), [1, 2]);
      for (const line of [212, 213, 225, 226, 228, 230]) {
        const row = table.rows.find(r => r.line === line);
        expect(row).toMatchObject({ amounts: [0, 0], total: 0, remark: MANUAL_LINE_REMARK });
      }
    });

    it('carries the hints of lines 224 and 227 as remarks', () => {
      const table = build2044Table(computeFiscalYear(twoPropertiesInput()), [1, 2]);
      expect(table.rows.find(r => r.line === 224)?.remark).toBe(
        "Les travaux de construction ou d'agrandissement ne sont pas déductibles"
      );
      expect(table.rows.find(r => r.line === 227)?.remark).toBe(
        "Hors taxe d'enlèvement des ordures ménagères (TEOM), récupérable auprès du locataire"
      );
      expect(table.rows.find(r => r.line === 211)?.remark).toBeNull();
    });

    it('rounds each line to the euro and computes the totals from the rounded lines', () => {
      const [summary] = computeFiscalYear({
        properties: [GAMBETTA],
        leases: [lease(10, 1)],
        rents: [rent({ leaseId: 10, amount: 7200.5, charges: 0, paidAmount: 7200.5 })],
        expenses: [expense(1, 'insurance', 89.49), expense(1, 'property-tax', 1250.5)],
        year: 2025,
      });
      const values = compute2044Values(summary as PropertyFiscalSummary);
      expect(values).toMatchObject({ 211: 7201, 223: 89, 227: 1251, 240: 1360, 261: 5841 });
    });

    it('excludes unchecked properties from the columns and totals', () => {
      const table = build2044Table(computeFiscalYear(twoPropertiesInput()), new Set([1]));
      expect(table.columns.map(c => c.name)).toEqual(['Appart Gambetta T2']);
      expect(table.totals).toMatchObject({ 211: 9600, 261: 2820 });
    });

    it('returns an empty table when no property is included', () => {
      const table = build2044Table(computeFiscalYear(twoPropertiesInput()), []);
      expect(table.columns).toEqual([]);
      expect(table.totals[211]).toBe(0);
      expect(table.rows).toHaveLength(LINES_2044.length);
    });
  });

  describe('roundEuro', () => {
    it('rounds half up and absorbs float noise', () => {
      expect(roundEuro(7200.5)).toBe(7201);
      expect(roundEuro(89.49)).toBe(89);
      expect(roundEuro(0.1 + 0.2 + 100.2)).toBe(101);
      expect(roundEuro(100.49999999)).toBe(101);
    });
  });

  describe('isMicroFoncierEligible', () => {
    it('is true up to 15 000 € included', () => {
      expect(isMicroFoncierEligible(12000)).toBe(true);
      expect(isMicroFoncierEligible(15000)).toBe(true);
      expect(isMicroFoncierEligible(15001)).toBe(false);
      expect(isMicroFoncierEligible(15600)).toBe(false);
    });
  });

  describe('years', () => {
    it('defaults to the previous calendar year', () => {
      expect(defaultFiscalYear(NOW)).toBe(2025);
      expect(defaultFiscalYear(new Date(2026, 0, 1))).toBe(2025);
    });

    it('defaults to the previous year of the current date when no date is given', () => {
      expect(defaultFiscalYear()).toBe(new Date().getFullYear() - 1);
    });

    it('lists the years with collected rents or expenses plus the current and previous years', () => {
      const years = availableFiscalYears({
        properties: [GAMBETTA],
        leases: [lease(10, 1)],
        rents: [
          rent({ leaseId: 10, paidDate: new Date(2023, 5, 5, 12) }),
          rent({ leaseId: 10, paidDate: new Date(2025, 5, 5, 12) }),
          rent({
            leaseId: 10,
            status: 'pending',
            paidDate: undefined,
            dueDate: new Date(2021, 0, 5),
          }),
        ],
        expenses: [expense(1, 'works', 10, new Date(2024, 5, 1, 12))],
        now: NOW,
      });
      expect(years).toEqual([2026, 2025, 2024, 2023]);
    });

    it('ignores rents and expenses of properties that no longer exist', () => {
      const years = availableFiscalYears({
        properties: [GAMBETTA],
        leases: [lease(20, 404)],
        rents: [rent({ leaseId: 20, paidDate: new Date(2019, 5, 5, 12) })],
        expenses: [expense(404, 'works', 10, new Date(2018, 5, 1, 12))],
        now: NOW,
      });
      expect(years).toEqual([2026, 2025]);
    });
  });

  describe('CSV export', () => {
    it('names the file after the year', () => {
      expect(fiscalCsvFilename(2025)).toBe('recapitulatif-fiscal-2025.csv');
    });

    it('builds a ";"-separated CSV of the 2044 table with the disclaimer', () => {
      const table = build2044Table(computeFiscalYear(twoPropertiesInput()), [1, 2]);
      const lines = build2044Csv(table).split('\r\n');

      expect(lines[0]).toBe('Ligne;Libellé;Appart Gambetta T2;Maison Lilas;Total;Remarque');
      expect(lines[1]).toBe('211;Loyers bruts encaissés;9600;6000;15600;');
      expect(lines[2]).toBe(
        '212;Dépenses mises par convention à la charge des locataires;0;0;0;À compléter manuellement'
      );
      expect(lines).toContain('261;Revenu foncier taxable (bénéfice ou déficit);2820;-5920;-3100;');
      // header + 17 lines + empty row + disclaimer
      expect(lines).toHaveLength(1 + LINES_2044.length + 2);
      expect(lines[lines.length - 2]).toBe('');
      expect(lines[lines.length - 1]).toBe(FISCAL_DISCLAIMER);
    });

    it('no longer contains an excluded property', () => {
      const table = build2044Table(computeFiscalYear(twoPropertiesInput()), [1]);
      const csv = build2044Csv(table);
      expect(csv).not.toContain('Maison Lilas');
      expect(csv.split('\r\n')[0]).toBe('Ligne;Libellé;Appart Gambetta T2;Total;Remarque');
    });

    it('quotes cells containing the separator so columns are not shifted', () => {
      const input = twoPropertiesInput();
      const table = build2044Table(
        computeFiscalYear({
          ...input,
          properties: [{ ...GAMBETTA, name: 'Appart; Gambetta' }, LILAS],
        }),
        [1, 2]
      );
      const [header, line211] = build2044Csv(table).split('\r\n');
      expect(header).toBe('Ligne;Libellé;"Appart; Gambetta";Maison Lilas;Total;Remarque');
      expect(line211?.split(';')).toHaveLength(6);
    });

    it('escapes quotes and line breaks', () => {
      expect(escapeCsvCell('Le "Lilas"')).toBe('"Le ""Lilas"""');
      expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
      expect(escapeCsvCell('plain')).toBe('plain');
    });
  });
});
