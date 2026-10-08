import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { requireId } from '@/test/requireId';
import type { Document, ExpenseCategory } from '@/db/types';
import {
  createExpense,
  deleteByPropertyWithDocuments,
  deleteWithDocuments,
  fetchExpenseById,
  fetchPropertyIncomeSources,
  findByProperty,
  updateExpense,
} from './expensesRepository';

const NOW = new Date('2026-03-10T10:00:00.000Z');

function newExpense(propertyId: number, date: string, category: ExpenseCategory = 'works') {
  return createExpense({
    propertyId,
    category,
    label: `Dépense ${date}`,
    amount: 100,
    date: new Date(date),
  });
}

async function addExpenseDocument(expenseId: number, name = 'facture.pdf'): Promise<number> {
  const doc: Omit<Document, 'id'> = {
    name,
    type: 'invoice',
    relatedEntityType: 'expense',
    relatedEntityId: expenseId,
    mimeType: 'application/pdf',
    size: 3,
    data: new Blob(['pdf'], { type: 'application/pdf' }),
    createdAt: NOW,
    updatedAt: NOW,
  };
  return requireId(await db.documents.add(doc));
}

describe('expensesRepository', () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all([
      db.expenses.clear(),
      db.documents.clear(),
      db.leases.clear(),
      db.rents.clear(),
    ]);
  });

  it('creates an expense with createdAt/updatedAt timestamps', async () => {
    const created = await createExpense(
      {
        propertyId: 1,
        category: 'insurance',
        label: 'PNO',
        amount: 145.6,
        date: new Date('2026-01-10'),
      },
      NOW
    );
    expect(created.id).toBeTypeOf('number');
    expect(created.createdAt).toEqual(NOW);
    expect(created.updatedAt).toEqual(NOW);
    expect(await fetchExpenseById(created.id!)).toMatchObject({ label: 'PNO', amount: 145.6 });
  });

  it('finds the expenses of one property, most recent first', async () => {
    await newExpense(1, '2025-06-10');
    await newExpense(1, '2026-04-02');
    await newExpense(1, '2026-01-15');
    await newExpense(2, '2026-05-01');

    const rows = await findByProperty(1);
    expect(rows.map(r => r.label)).toEqual([
      'Dépense 2026-04-02',
      'Dépense 2026-01-15',
      'Dépense 2025-06-10',
    ]);
  });

  it('updates an expense and refreshes updatedAt', async () => {
    const created = await newExpense(1, '2026-02-01');
    const later = new Date('2026-03-01T00:00:00.000Z');
    const updated = await updateExpense(created.id!, { amount: 135 }, later);
    expect(updated.amount).toBe(135);
    expect(updated.updatedAt).toEqual(later);
    expect(updated.createdAt).toEqual(created.createdAt);
  });

  it('removes notes when updated with undefined', async () => {
    const created = await createExpense({
      propertyId: 1,
      category: 'other',
      label: 'Divers',
      amount: 10,
      date: new Date('2026-01-01'),
      notes: 'à supprimer',
    });
    const updated = await updateExpense(created.id!, { notes: undefined });
    expect(updated).not.toHaveProperty('notes');
  });

  it('throws when updating a missing expense', async () => {
    await expect(updateExpense(999, { amount: 1 })).rejects.toThrow(
      'Expense not found after update'
    );
  });

  it('deletes an expense together with its supporting documents only', async () => {
    const target = await newExpense(1, '2026-01-01');
    const other = await newExpense(1, '2026-02-01');
    await addExpenseDocument(target.id!, 'devis.pdf');
    await addExpenseDocument(target.id!, 'facture.pdf');
    const otherDocId = await addExpenseDocument(other.id!);
    // A document of another entity type with the same id must be kept.
    const propertyDocId = requireId(
      await db.documents.add({
        name: 'dpe.pdf',
        type: 'diagnostic',
        relatedEntityType: 'property',
        relatedEntityId: target.id!,
        mimeType: 'application/pdf',
        size: 1,
        data: new Blob(['x']),
        createdAt: NOW,
        updatedAt: NOW,
      })
    );

    await deleteWithDocuments(target.id!);

    expect(await fetchExpenseById(target.id!)).toBeUndefined();
    expect(await fetchExpenseById(other.id!)).toBeDefined();
    const remainingDocIds = (await db.documents.toArray()).map(d => d.id).sort();
    expect(remainingDocIds).toEqual([otherDocId, propertyDocId].sort());
  });

  it('deletes all the expenses of a property and their documents', async () => {
    const a1 = await newExpense(1, '2026-01-01');
    await newExpense(1, '2026-02-01');
    await newExpense(1, '2026-03-01');
    const b1 = await newExpense(2, '2026-01-01');
    await addExpenseDocument(a1.id!);
    const keptDocId = await addExpenseDocument(b1.id!);

    await deleteByPropertyWithDocuments(1);

    expect(await findByProperty(1)).toEqual([]);
    expect((await findByProperty(2)).map(e => e.id)).toEqual([b1.id]);
    expect((await db.documents.toArray()).map(d => d.id)).toEqual([keptDocId]);
  });

  it('does nothing when the property has no expense', async () => {
    const kept = await newExpense(2, '2026-01-01');
    await deleteByPropertyWithDocuments(1);
    expect(await fetchExpenseById(kept.id!)).toBeDefined();
  });

  it('loads the leases (any status) of a property and their rents', async () => {
    const base = {
      tenantIds: [1],
      startDate: NOW,
      rent: 800,
      charges: 50,
      deposit: 800,
      paymentDay: 5,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const ended = requireId(await db.leases.add({ ...base, propertyId: 1, status: 'ended' }));
    const active = requireId(await db.leases.add({ ...base, propertyId: 1, status: 'active' }));
    const other = requireId(await db.leases.add({ ...base, propertyId: 2, status: 'active' }));
    const rent = {
      dueDate: NOW,
      amount: 800,
      charges: 50,
      status: 'paid' as const,
      createdAt: NOW,
      updatedAt: NOW,
    };
    await db.rents.bulkAdd([
      { ...rent, leaseId: ended },
      { ...rent, leaseId: active },
      { ...rent, leaseId: other },
    ]);

    const { leases, rents } = await fetchPropertyIncomeSources(1);
    expect(leases.map(l => l.id).sort()).toEqual([ended, active].sort());
    expect(rents.map(r => r.leaseId).sort()).toEqual([ended, active].sort());
  });

  it('returns no rents for a property without lease', async () => {
    expect(await fetchPropertyIncomeSources(42)).toEqual({ leases: [], rents: [] });
  });
});
