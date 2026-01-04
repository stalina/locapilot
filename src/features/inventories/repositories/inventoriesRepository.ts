import { db } from '@/db/database';
import type { Inventory } from '@/db/types';

export async function fetchAllInventories(): Promise<Inventory[]> {
  return db.inventories.toArray();
}

export async function fetchInventoryById(id: number): Promise<Inventory | undefined> {
  return db.inventories.get(id);
}

export async function createInventory(
  data: Omit<Inventory, 'id' | 'createdAt' | 'updatedAt'>,
  now = new Date()
): Promise<number> {
  const id = await db.inventories.add({
    ...data,
    createdAt: now,
    updatedAt: now,
  } as any);

  if (typeof id !== 'number') {
    throw new Error('Failed to create inventory');
  }

  return id;
}

export async function updateInventory(
  id: number,
  data: Partial<Omit<Inventory, 'id' | 'createdAt'>>,
  now = new Date()
): Promise<number> {
  return db.inventories.update(id, {
    ...data,
    updatedAt: now,
  } as any);
}

export async function deleteInventory(id: number): Promise<void> {
  await db.inventories.delete(id);
}
