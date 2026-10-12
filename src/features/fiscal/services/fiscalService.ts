import type { Expense, ExpenseCategory, Lease, Property, Rent } from '@/db/types';
import {
  availableYears,
  collectedRentShare,
  computeIncome,
  getExpenseCategoryLabel,
  yearOf,
} from '@/features/expenses/services/expensesService';

/**
 * Yearly fiscal summary and CERFA 2044 table (issue #48) — pure functions,
 * no DOM and no database access. See docs/specs/fiscal.md.
 */

// ========== 2044 lines ==========

/** 2044 lines fed by expenses (Σ of the mapped categories). */
export type ExpenseLine2044 = 221 | 223 | 224 | 227 | 229 | 250;

/** Lines Locapilot does not track: always 0, flagged "À compléter manuellement". */
export type ManualLine2044 = 212 | 213 | 225 | 226 | 228 | 230;

export type Line2044 = 211 | 214 | 222 | 240 | 261 | ExpenseLine2044 | ManualLine2044;

export const MANUAL_LINE_REMARK = 'À compléter manuellement';
export const DEFICIT_LABEL = 'Déficit foncier';
export const FISCAL_DISCLAIMER =
  "Document d'aide à la déclaration — vérifiez les montants avant de les reporter. Locapilot ne fournit pas de conseil fiscal.";
export const MICRO_FONCIER_THRESHOLD = 15000;
/** Line 222: flat "autres frais de gestion" per property with income. */
export const FLAT_MANAGEMENT_FEE = 20;

export interface Line2044Definition {
  line: Line2044;
  label: string;
  /** Not tracked by Locapilot: always 0. */
  manual: boolean;
  hint?: string;
}

/** Rows of the 2044 table, in form order. */
export const LINES_2044: readonly Line2044Definition[] = [
  { line: 211, label: 'Loyers bruts encaissés', manual: false },
  { line: 212, label: 'Dépenses mises par convention à la charge des locataires', manual: true },
  { line: 213, label: "Subventions et indemnités d'assurance", manual: true },
  { line: 214, label: 'Total des recettes', manual: false },
  { line: 221, label: "Frais d'administration et de gestion", manual: false },
  { line: 222, label: 'Autres frais de gestion (forfait)', manual: false },
  { line: 223, label: "Primes d'assurance", manual: false },
  {
    line: 224,
    label: "Dépenses de réparation, d'entretien et d'amélioration",
    manual: false,
    hint: "Les travaux de construction ou d'agrandissement ne sont pas déductibles",
  },
  {
    line: 225,
    label: 'Charges récupérables non récupérées au départ du locataire',
    manual: true,
  },
  { line: 226, label: "Indemnités d'éviction, frais de relogement", manual: true },
  {
    line: 227,
    label: 'Taxes foncières',
    manual: false,
    hint: "Hors taxe d'enlèvement des ordures ménagères (TEOM), récupérable auprès du locataire",
  },
  { line: 228, label: 'Déductions spécifiques', manual: true },
  { line: 229, label: 'Provisions pour charges de copropriété payées', manual: false },
  {
    line: 230,
    label: 'Régularisation des provisions pour charges de copropriété de N-1',
    manual: true,
  },
  { line: 240, label: 'Total des frais et charges', manual: false },
  { line: 250, label: "Intérêts d'emprunt", manual: false },
  { line: 261, label: 'Revenu foncier taxable (bénéfice ou déficit)', manual: false },
];

/** Expense category → 2044 line; `other` is not mapped and never deducted. */
export const EXPENSE_CATEGORY_TO_2044_LINE: Readonly<
  Record<ExpenseCategory, ExpenseLine2044 | null>
> = {
  'management-fees': 221,
  insurance: 223,
  works: 224,
  maintenance: 224,
  'property-tax': 227,
  'condo-fees': 229,
  'loan-interest': 250,
  other: null,
};

const EXPENSE_LINES: readonly ExpenseLine2044[] = [221, 223, 224, 227, 229, 250];

// ========== Per-property figures ==========

export interface FiscalExpenseRow {
  id?: number;
  date: Date;
  category: ExpenseCategory;
  categoryLabel: string;
  label: string;
  amount: number;
  /** 2044 line, or null for unmapped (`other`) expenses. */
  line: ExpenseLine2044 | null;
}

export interface PropertyFiscalSummary {
  propertyId: number;
  name: string;
  /** Line 211 before rounding: collected rent income excl. charges, to the cent. */
  rentIncome: number;
  /** Charges provisions collected (information only), to the cent. */
  chargesCollected: number;
  /** Number of `paid` / `partial` rents attributed to the year. */
  rentsCollected: number;
  /** Σ of the expenses of each mapped 2044 line, to the cent. */
  expensesByLine: Record<ExpenseLine2044, number>;
  /** Expenses of category `other` (never deducted). */
  unallocatedExpenses: FiscalExpenseRow[];
  unallocatedTotal: number;
  /** Every expense of the year, date ascending. */
  expenses: FiscalExpenseRow[];
}

export interface FiscalYearInput {
  properties: Property[];
  leases: Lease[];
  rents: Rent[];
  expenses: Expense[];
  year: number;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Nearest euro, x,50 rounding up (cents normalised first to absorb float noise). */
export function roundEuro(value: number): number {
  return Math.round(roundCents(value));
}

function isCollected(rent: Rent): boolean {
  return rent.status === 'paid' || rent.status === 'partial';
}

function emptyExpenseLines(): Record<ExpenseLine2044, number> {
  return { 221: 0, 223: 0, 224: 0, 227: 0, 229: 0, 250: 0 };
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function summarizeProperty(
  property: Property & { id: number },
  input: FiscalYearInput
): PropertyFiscalSummary {
  const { leases, rents, expenses, year } = input;

  const leaseIds = new Set(
    leases
      .filter(l => l.propertyId === property.id)
      .map(l => l.id)
      .filter((id): id is number => typeof id === 'number')
  );
  let chargesCollected = 0;
  let rentsCollected = 0;
  for (const rent of rents) {
    if (!leaseIds.has(rent.leaseId) || !isCollected(rent)) continue;
    if ((yearOf(rent.paidDate) ?? yearOf(rent.dueDate)) !== year) continue;
    rentsCollected += 1;
    chargesCollected +=
      rent.status === 'paid'
        ? Number(rent.charges) || 0
        : (Number(rent.paidAmount) || 0) - collectedRentShare(rent);
  }

  const rows: FiscalExpenseRow[] = expenses
    .filter(e => e.propertyId === property.id && yearOf(e.date) === year)
    .map(e => ({
      id: e.id,
      date: toDate(e.date),
      category: e.category,
      categoryLabel: getExpenseCategoryLabel(e.category),
      label: e.label,
      amount: Number(e.amount) || 0,
      line: EXPENSE_CATEGORY_TO_2044_LINE[e.category] ?? null,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const expensesByLine = emptyExpenseLines();
  let unallocatedTotal = 0;
  for (const row of rows) {
    if (row.line === null) unallocatedTotal += row.amount;
    else expensesByLine[row.line] += row.amount;
  }
  for (const line of EXPENSE_LINES) expensesByLine[line] = roundCents(expensesByLine[line]);

  return {
    propertyId: property.id,
    name: property.name,
    // Same rules as the profitability income (issue #47).
    rentIncome: computeIncome(rents, leases, property.id, year),
    chargesCollected: roundCents(chargesCollected),
    rentsCollected,
    expensesByLine,
    unallocatedExpenses: rows.filter(r => r.line === null),
    unallocatedTotal: roundCents(unallocatedTotal),
    expenses: rows,
  };
}

/**
 * Per-property fiscal figures of a calendar year. Only existing properties with
 * at least one collected rent or one expense in the year are listed (sorted by
 * name). Orphan rents (missing lease or property) are ignored.
 */
export function computeFiscalYear(input: FiscalYearInput): PropertyFiscalSummary[] {
  return input.properties
    .filter((p): p is Property & { id: number } => typeof p.id === 'number')
    .map(p => summarizeProperty(p, input))
    .filter(s => s.rentsCollected > 0 || s.expenses.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

// ========== 2044 table ==========

export type Line2044Values = Record<Line2044, number>;

export interface Table2044Column {
  propertyId: number;
  name: string;
  values: Line2044Values;
}

export interface Table2044Row extends Line2044Definition {
  /** Rounded amount of each column, in column order. */
  amounts: number[];
  total: number;
  /** Remark of the row: "À compléter manuellement" for manual lines, else the hint. */
  remark: string | null;
}

export interface Table2044 {
  columns: Table2044Column[];
  rows: Table2044Row[];
  totals: Line2044Values;
}

/** Whole-euro 2044 values of one property; totals are computed from the rounded lines. */
export function compute2044Values(summary: PropertyFiscalSummary): Line2044Values {
  const l211 = roundEuro(summary.rentIncome);
  const l212 = 0;
  const l213 = 0;
  const l221 = roundEuro(summary.expensesByLine[221]);
  const l222 = l211 > 0 ? FLAT_MANAGEMENT_FEE : 0;
  const l223 = roundEuro(summary.expensesByLine[223]);
  const l224 = roundEuro(summary.expensesByLine[224]);
  const l225 = 0;
  const l226 = 0;
  const l227 = roundEuro(summary.expensesByLine[227]);
  const l228 = 0;
  const l229 = roundEuro(summary.expensesByLine[229]);
  const l230 = 0;
  const l250 = roundEuro(summary.expensesByLine[250]);
  const l214 = l211 + l212 + l213;
  const l240 = l221 + l222 + l223 + l224 + l225 + l226 + l227 + l228 + l229 - l230;
  const l261 = l214 - l240 - l250;
  return {
    211: l211,
    212: l212,
    213: l213,
    214: l214,
    221: l221,
    222: l222,
    223: l223,
    224: l224,
    225: l225,
    226: l226,
    227: l227,
    228: l228,
    229: l229,
    230: l230,
    240: l240,
    250: l250,
    261: l261,
  };
}

/**
 * 2044 table of the included properties: one column per property (in the order
 * of `perProperty`), one row per 2044 line, the Total column being the sum of
 * the property columns.
 */
export function build2044Table(
  perProperty: PropertyFiscalSummary[],
  includedIds: ReadonlySet<number> | readonly number[]
): Table2044 {
  const included = new Set(includedIds);
  const columns: Table2044Column[] = perProperty
    .filter(s => included.has(s.propertyId))
    .map(s => ({ propertyId: s.propertyId, name: s.name, values: compute2044Values(s) }));

  const totals = {} as Line2044Values;
  const rows: Table2044Row[] = LINES_2044.map(def => {
    const amounts = columns.map(c => c.values[def.line]);
    const total = amounts.reduce((sum, v) => sum + v, 0);
    totals[def.line] = total;
    return {
      ...def,
      amounts,
      total,
      remark: def.manual ? MANUAL_LINE_REMARK : (def.hint ?? null),
    };
  });

  return { columns, rows, totals };
}

/** Micro-foncier may apply when the gross income (line 211) is at most 15 000 €. */
export function isMicroFoncierEligible(total211: number): boolean {
  return total211 <= MICRO_FONCIER_THRESHOLD;
}

// ========== Years ==========

/** Default year of the report: the previous calendar year (return filed in spring). */
export function defaultFiscalYear(now: Date = new Date()): number {
  return now.getFullYear() - 1;
}

/**
 * Years offered by the selector: every year with a collected rent or an
 * expense on an existing property, plus the current and previous years,
 * sorted descending.
 */
export function availableFiscalYears(params: {
  properties: Property[];
  leases: Lease[];
  rents: Rent[];
  expenses: Expense[];
  now?: Date;
}): number[] {
  const currentYear = (params.now ?? new Date()).getFullYear();
  const years = new Set<number>([currentYear, currentYear - 1]);
  for (const property of params.properties) {
    if (typeof property.id !== 'number') continue;
    for (const year of availableYears({
      expenses: params.expenses,
      rents: params.rents,
      leases: params.leases,
      propertyId: property.id,
      currentYear,
    })) {
      years.add(year);
    }
  }
  return [...years].sort((a, b) => b - a);
}

// ========== CSV ==========

export const CSV_SEPARATOR = ';';

/** Wraps a CSV cell in double quotes when it contains `;`, `"` or a line break. */
export function escapeCsvCell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(c => escapeCsvCell(String(c))).join(CSV_SEPARATOR);
}

/** File name of the CSV export of a year. */
export function fiscalCsvFilename(year: number): string {
  return `recapitulatif-fiscal-${year}.csv`;
}

/**
 * Content of the CSV export (without BOM): `;` separator, whole-euro amounts,
 * one row per 2044 line, then an empty row and the disclaimer row.
 */
export function build2044Csv(table: Table2044): string {
  const lines = [
    csvRow(['Ligne', 'Libellé', ...table.columns.map(c => c.name), 'Total', 'Remarque']),
    ...table.rows.map(row =>
      csvRow([row.line, row.label, ...row.amounts, row.total, row.remark ?? ''])
    ),
    '',
    csvRow([FISCAL_DISCLAIMER]),
  ];
  return lines.join('\r\n');
}
