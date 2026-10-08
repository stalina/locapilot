import { db } from '@/db/database';
import type { Property } from '@/db/types';
import { deleteByPropertyWithDocuments } from '@/features/expenses/repositories/expensesRepository';

export async function fetchAllProperties(): Promise<Property[]> {
  return db.properties.toArray();
}

export async function fetchPropertyById(id: number): Promise<Property | undefined> {
  return db.properties.get(id);
}

export async function createProperty(
  data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>,
  now = new Date()
): Promise<number> {
  const id = await db.properties.add({
    ...data,
    createdAt: now,
    updatedAt: now,
  });

  if (typeof id !== 'number') {
    throw new Error('Failed to create property');
  }

  return id;
}

export async function updateProperty(
  id: number,
  data: Partial<Omit<Property, 'id' | 'createdAt'>>,
  now = new Date()
): Promise<number> {
  return db.properties.update(id, {
    ...data,
    updatedAt: now,
  });
}

export const ACTIVE_LEASE_DELETE_ERROR = 'Impossible de supprimer un bien ayant un bail actif';

/**
 * Delete a property together with its expenses and their supporting documents,
 * in a single transaction. A property with an active lease cannot be deleted:
 * this rule is checked first and nothing is deleted when it applies.
 */
export async function deleteProperty(id: number): Promise<void> {
  await db.transaction('rw', [db.properties, db.leases, db.expenses, db.documents], async () => {
    const activeLeases = await db.leases
      .where('propertyId')
      .equals(id)
      .and(l => l.status === 'active')
      .count();
    if (activeLeases > 0) throw new Error(ACTIVE_LEASE_DELETE_ERROR);

    await deleteByPropertyWithDocuments(id);
    await db.properties.delete(id);
  });
}
