import { db } from '@/db/database';
import type { Property } from '@/db/types';

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
  return db.properties.add({
    ...data,
    createdAt: now,
    updatedAt: now,
  } as any);
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

export async function deleteProperty(id: number): Promise<void> {
  await db.properties.delete(id);
}
