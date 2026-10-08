import { db } from '@/db/database';
import type { Expense, Lease, Rent } from '@/db/types';

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;

function byDateDesc(a: Expense, b: Expense): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

/** Expenses of one property, most recent first. */
export async function findByProperty(propertyId: number): Promise<Expense[]> {
  const rows = await db.expenses.where('propertyId').equals(propertyId).toArray();
  return rows.sort(byDateDesc);
}

/**
 * Leases (any status) of a property and all their rents — the income side of
 * the profitability computation (manual join, no foreign keys).
 */
export async function fetchPropertyIncomeSources(
  propertyId: number
): Promise<{ leases: Lease[]; rents: Rent[] }> {
  const leases = await db.leases.where('propertyId').equals(propertyId).toArray();
  const leaseIds = leases.map(l => l.id).filter((id): id is number => typeof id === 'number');
  const rents = leaseIds.length ? await db.rents.where('leaseId').anyOf(leaseIds).toArray() : [];
  return { leases, rents };
}

export async function fetchExpenseById(id: number): Promise<Expense | undefined> {
  return db.expenses.get(id);
}

export async function createExpense(data: ExpenseInput, now = new Date()): Promise<Expense> {
  const id = await db.expenses.add({ ...data, createdAt: now, updatedAt: now });
  const created = await db.expenses.get(id);
  if (!created) throw new Error('Failed to create expense');
  return created;
}

export async function updateExpense(
  id: number,
  changes: Partial<ExpenseInput>,
  now = new Date()
): Promise<Expense> {
  await db.expenses.update(id, { ...changes, updatedAt: now });
  const updated = await db.expenses.get(id);
  if (!updated) throw new Error('Expense not found after update');
  return updated;
}

/**
 * Delete an expense together with its supporting documents
 * (`relatedEntityType: 'expense'`), in a single transaction.
 */
export async function deleteWithDocuments(id: number): Promise<void> {
  await db.transaction('rw', [db.expenses, db.documents], async () => {
    await db.documents
      .where('relatedEntityType')
      .equals('expense')
      .and(d => d.relatedEntityId === id)
      .delete();
    await db.expenses.delete(id);
  });
}

/**
 * Delete every expense of a property and their supporting documents. Must be
 * called inside a transaction that includes `db.expenses` and `db.documents`
 * (it joins the caller's transaction), or on its own.
 */
export async function deleteByPropertyWithDocuments(propertyId: number): Promise<void> {
  await db.transaction('rw', [db.expenses, db.documents], async () => {
    const expenseIds = (
      await db.expenses.where('propertyId').equals(propertyId).primaryKeys()
    ).filter((id): id is number => typeof id === 'number');
    if (expenseIds.length === 0) return;
    const ids = new Set(expenseIds);
    await db.documents
      .where('relatedEntityType')
      .equals('expense')
      .and(d => typeof d.relatedEntityId === 'number' && ids.has(d.relatedEntityId))
      .delete();
    await db.expenses.bulkDelete(expenseIds);
  });
}
