import { db } from '@/db/database';
import type { Rent } from '@/db/types';

export async function fetchAllRents(): Promise<Rent[]> {
  return db.rents.toArray();
}

export async function fetchRentById(id: number): Promise<Rent | undefined> {
  return db.rents.get(id);
}

export async function createRent(
  rent: Omit<Rent, 'id' | 'createdAt' | 'updatedAt'>,
  now = new Date()
): Promise<Rent> {
  const newRent: Omit<Rent, 'id'> = {
    ...rent,
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.rents.add(newRent as Rent);
  return { ...newRent, id: id as number } as Rent;
}

export async function updateRent(
  id: number,
  updates: Partial<Omit<Rent, 'id' | 'createdAt'>>,
  now = new Date()
): Promise<Rent | undefined> {
  await db.rents.update(id, { ...updates, updatedAt: now });
  return db.rents.get(id);
}

export async function deleteRent(id: number): Promise<void> {
  await db.rents.delete(id);
}
