import type { Document, Expense, ExpenseCategory, Lease, Rent } from '@/db/types';
import { fetchPropertyById } from '@/features/properties/repositories/propertiesRepository';
import type { ExpenseInput } from '../repositories/expensesRepository';

// ========== Categories ==========

export interface ExpenseCategoryOption {
  value: ExpenseCategory;
  label: string;
  /** Default type of a supporting document attached to an expense of this category. */
  documentType: Document['type'];
}

export const EXPENSE_CATEGORIES: readonly ExpenseCategoryOption[] = [
  { value: 'works', label: 'Travaux', documentType: 'invoice' },
  { value: 'property-tax', label: 'Taxe foncière', documentType: 'invoice' },
  { value: 'insurance', label: 'Assurance (PNO)', documentType: 'insurance' },
  { value: 'maintenance', label: 'Entretien', documentType: 'invoice' },
  { value: 'condo-fees', label: 'Charges de copropriété', documentType: 'invoice' },
  { value: 'other', label: 'Autre', documentType: 'other' },
];

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return EXPENSE_CATEGORIES.some(c => c.value === value);
}

export function getExpenseCategoryLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORIES.find(c => c.value === category)?.label ?? category;
}

export function documentTypeForCategory(category: ExpenseCategory): Document['type'] {
  return EXPENSE_CATEGORIES.find(c => c.value === category)?.documentType ?? 'other';
}

// ========== Validation ==========

/** Raw expense data as entered in the form (fields may be missing or invalid). */
export interface ExpenseDraft {
  propertyId: number;
  category: ExpenseCategory | '' | null | undefined;
  label: string | null | undefined;
  amount: number | null | undefined;
  date: Date | string | null | undefined;
  notes?: string | null;
}

export type ExpenseField = 'category' | 'label' | 'amount' | 'date';

export const EXPENSE_ERRORS = {
  propertyNotFound: 'Bien introuvable',
  category: 'La catégorie est requise',
  label: 'Le libellé est requis',
  amount: 'Le montant doit être supérieur à 0',
  date: 'La date est requise',
} as const;

function toValidDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Field-level validation of an expense draft (pure, no database access).
 * Returns an error message per invalid field; an empty object means valid.
 * A date in the future is accepted.
 */
export function getExpenseFieldErrors(draft: ExpenseDraft): Partial<Record<ExpenseField, string>> {
  const errors: Partial<Record<ExpenseField, string>> = {};
  if (!isExpenseCategory(draft.category)) errors.category = EXPENSE_ERRORS.category;
  if (!draft.label || !draft.label.trim()) errors.label = EXPENSE_ERRORS.label;
  if (typeof draft.amount !== 'number' || !Number.isFinite(draft.amount) || draft.amount <= 0) {
    errors.amount = EXPENSE_ERRORS.amount;
  }
  if (!toValidDate(draft.date)) errors.date = EXPENSE_ERRORS.date;
  return errors;
}

/**
 * Validate an expense draft and normalise it into a storable record
 * (trimmed label/notes, amount rounded to the cent).
 * Throws an Error with a French message on the first violation, including
 * "Bien introuvable" when `propertyId` does not reference an existing property.
 */
export async function validateExpense(draft: ExpenseDraft): Promise<ExpenseInput> {
  const errors = getExpenseFieldErrors(draft);
  const first = Object.values(errors)[0];
  if (first) throw new Error(first);

  const property = Number.isFinite(draft.propertyId)
    ? await fetchPropertyById(draft.propertyId)
    : undefined;
  if (!property) throw new Error(EXPENSE_ERRORS.propertyNotFound);

  const notes = draft.notes?.trim();
  return {
    propertyId: draft.propertyId,
    category: draft.category as ExpenseCategory,
    label: (draft.label ?? '').trim(),
    amount: roundCents(draft.amount as number),
    date: toValidDate(draft.date) as Date,
    ...(notes ? { notes } : {}),
  };
}

// ========== Profitability (pure functions) ==========

/** Calendar year (local time) of a date, or null when it is missing/invalid. */
export function yearOf(value: Date | string | null | undefined): number | null {
  const date = toValidDate(value);
  return date ? date.getFullYear() : null;
}

/** Year a collected rent is attributed to: its paidDate, falling back to its dueDate. */
function incomeYearOf(rent: Rent): number | null {
  return yearOf(rent.paidDate) ?? yearOf(rent.dueDate);
}

/**
 * Rent share (excl. charges) collected for one rent:
 * - `paid` → `amount`
 * - `partial` → `paidAmount × amount / (amount + charges)`, rounded to the cent
 *   (0 when `amount + charges` is 0)
 * - `pending` / `late` → 0
 */
export function collectedRentShare(rent: Rent): number {
  if (rent.status === 'paid') return Number(rent.amount) || 0;
  if (rent.status === 'partial') {
    const amount = Number(rent.amount) || 0;
    const total = amount + (Number(rent.charges) || 0);
    if (total === 0) return 0;
    return roundCents(((Number(rent.paidAmount) || 0) * amount) / total);
  }
  return 0;
}

function leaseIdsOfProperty(leases: Lease[], propertyId: number): Set<number> {
  return new Set(
    leases
      .filter(l => l.propertyId === propertyId)
      .map(l => l.id)
      .filter((id): id is number => typeof id === 'number')
  );
}

/**
 * Collected rent income (excl. charges) of a property for a calendar year.
 * Counts every `paid`/`partial` rent of every lease (active or ended) of the
 * property. Rents of other properties and orphan rents are ignored.
 */
export function computeIncome(
  rents: Rent[],
  leases: Lease[],
  propertyId: number,
  year: number
): number {
  const leaseIds = leaseIdsOfProperty(leases, propertyId);
  const total = rents
    .filter(r => leaseIds.has(r.leaseId) && incomeYearOf(r) === year)
    .reduce((sum, r) => sum + collectedRentShare(r), 0);
  return roundCents(total);
}

export interface ExpenseCategoryTotal {
  category: ExpenseCategory;
  label: string;
  total: number;
}

export interface ExpensesSummary {
  total: number;
  /** One entry per category that has at least one expense, in category order. */
  byCategory: ExpenseCategoryTotal[];
}

/** Total and per-category breakdown of a property's expenses for a calendar year. */
export function computeExpenses(
  expenses: Expense[],
  propertyId: number,
  year: number
): ExpensesSummary {
  const totals = new Map<ExpenseCategory, number>();
  let total = 0;
  for (const expense of expenses) {
    if (expense.propertyId !== propertyId || yearOf(expense.date) !== year) continue;
    const amount = Number(expense.amount) || 0;
    total += amount;
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + amount);
  }
  const byCategory = EXPENSE_CATEGORIES.flatMap(c => {
    const categoryTotal = totals.get(c.value);
    return categoryTotal === undefined
      ? []
      : [{ category: c.value, label: c.label, total: roundCents(categoryTotal) }];
  });
  return { total: roundCents(total), byCategory };
}

export interface ProfitabilityInput {
  income: number;
  expenses: number;
  purchasePrice?: number | null;
  acquisitionCosts?: number | null;
}

export interface Profitability {
  income: number;
  expenses: number;
  netResult: number;
  /** purchasePrice + acquisitionCosts, or null without purchase price. */
  investment: number | null;
  /** Percentages rounded to 2 decimals, or null without purchase price. */
  grossYield: number | null;
  netYield: number | null;
}

/**
 * Net result and gross/net yields. Yields cannot be computed (null) when the
 * purchase price is missing or 0.
 */
export function computeProfitability(input: ProfitabilityInput): Profitability {
  const netResult = roundCents(input.income - input.expenses);
  const purchasePrice = input.purchasePrice ?? 0;
  if (!(purchasePrice > 0)) {
    return {
      income: input.income,
      expenses: input.expenses,
      netResult,
      investment: null,
      grossYield: null,
      netYield: null,
    };
  }
  const investment = purchasePrice + (input.acquisitionCosts ?? 0);
  return {
    income: input.income,
    expenses: input.expenses,
    netResult,
    investment,
    grossYield: roundCents((input.income / investment) * 100),
    netYield: roundCents((netResult / investment) * 100),
  };
}

/**
 * Years offered by the year selector: every year with an expense or a collected
 * rent for the property, plus the current year, sorted descending.
 */
export function availableYears(params: {
  expenses: Expense[];
  rents: Rent[];
  leases: Lease[];
  propertyId: number;
  currentYear: number;
}): number[] {
  const years = new Set<number>([params.currentYear]);
  for (const expense of params.expenses) {
    if (expense.propertyId !== params.propertyId) continue;
    const year = yearOf(expense.date);
    if (year !== null) years.add(year);
  }
  const leaseIds = leaseIdsOfProperty(params.leases, params.propertyId);
  for (const rent of params.rents) {
    if (!leaseIds.has(rent.leaseId)) continue;
    if (rent.status !== 'paid' && rent.status !== 'partial') continue;
    const year = incomeYearOf(rent);
    if (year !== null) years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

// ========== Date input helpers ==========

/** `YYYY-MM-DD` (local) value for an `<input type="date">`. */
export function toDateInputValue(value: Date | string | null | undefined): string {
  const date = toValidDate(value);
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parse an `<input type="date">` value as a local date at noon (so it never
 * shifts to another calendar day across time zones). Null when empty/invalid.
 */
export function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
