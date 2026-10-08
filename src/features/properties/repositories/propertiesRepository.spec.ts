import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import { requireId } from '@/test/requireId';
import type { Document, Lease } from '@/db/types';
import { ACTIVE_LEASE_DELETE_ERROR, createProperty, deleteProperty } from './propertiesRepository';

const NOW = new Date('2026-03-10T10:00:00.000Z');

function newProperty(name: string) {
  return createProperty(
    {
      name,
      address: '1 rue de la Paix',
      type: 'apartment',
      surface: 40,
      rooms: 2,
      rent: 800,
      purchasePrice: 180000,
      acquisitionCosts: 15000,
      status: 'vacant',
    },
    NOW
  );
}

async function addExpense(propertyId: number) {
  return requireId(
    await db.expenses.add({
      propertyId,
      category: 'works',
      label: 'Travaux',
      amount: 100,
      date: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

async function addExpenseDocument(expenseId: number) {
  const doc: Omit<Document, 'id'> = {
    name: 'facture.pdf',
    type: 'invoice',
    relatedEntityType: 'expense',
    relatedEntityId: expenseId,
    mimeType: 'application/pdf',
    size: 3,
    data: new Blob(['pdf']),
    createdAt: NOW,
    updatedAt: NOW,
  };
  return requireId(await db.documents.add(doc));
}

async function addLease(propertyId: number, status: Lease['status']) {
  return requireId(
    await db.leases.add({
      propertyId,
      tenantIds: [1],
      startDate: NOW,
      rent: 800,
      charges: 50,
      deposit: 800,
      paymentDay: 5,
      status,
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

describe('propertiesRepository', () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all([
      db.properties.clear(),
      db.leases.clear(),
      db.expenses.clear(),
      db.documents.clear(),
    ]);
  });

  it('stores the optional purchase price and acquisition costs', async () => {
    const id = await newProperty('A');
    expect(await db.properties.get(id)).toMatchObject({
      purchasePrice: 180000,
      acquisitionCosts: 15000,
    });
  });

  describe('deleteProperty', () => {
    it('deletes the property with its expenses and their documents, other properties untouched', async () => {
      const a = await newProperty('A');
      const b = await newProperty('B');
      const e1 = await addExpense(a);
      await addExpense(a);
      await addExpense(a);
      await addExpenseDocument(e1);
      const eB = await addExpense(b);
      const docB = await addExpenseDocument(eB);
      await addLease(a, 'ended');

      await deleteProperty(a);

      expect(await db.properties.get(a)).toBeUndefined();
      expect(await db.expenses.where('propertyId').equals(a).count()).toBe(0);
      expect((await db.expenses.toArray()).map(e => e.id)).toEqual([eB]);
      expect((await db.documents.toArray()).map(d => d.id)).toEqual([docB]);
    });

    it('refuses to delete a property with an active lease and deletes nothing', async () => {
      const a = await newProperty('A');
      const e1 = await addExpense(a);
      await addExpenseDocument(e1);
      await addLease(a, 'active');

      await expect(deleteProperty(a)).rejects.toThrow(ACTIVE_LEASE_DELETE_ERROR);

      expect(await db.properties.get(a)).toBeDefined();
      expect(await db.expenses.count()).toBe(1);
      expect(await db.documents.count()).toBe(1);
    });

    it('deletes a property without any expense', async () => {
      const a = await newProperty('A');
      await deleteProperty(a);
      expect(await db.properties.count()).toBe(0);
    });
  });
});
