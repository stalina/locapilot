import { db } from '@/db/database';
import type { Lease } from '@/db/types';

export async function fetchAllLeases(): Promise<Lease[]> {
  return db.leases.toArray();
}

export async function fetchLeaseById(id: number): Promise<Lease | undefined> {
  return db.leases.get(id);
}

export async function createLease(
  lease: Omit<Lease, 'id' | 'createdAt' | 'updatedAt'>,
  now = new Date()
): Promise<Lease> {
  const newLease: Omit<Lease, 'id'> = {
    ...lease,
    createdAt: now,
    updatedAt: now,
  };

  const id = await db.leases.add(newLease as Lease);
  return { ...newLease, id: id as number } as Lease;
}

export async function updateLease(
  id: number,
  updates: Partial<Omit<Lease, 'id' | 'createdAt'>>,
  now = new Date()
): Promise<Lease | undefined> {
  await db.leases.update(id, { ...updates, updatedAt: now });
  return db.leases.get(id);
}

export async function deleteLease(id: number): Promise<void> {
  await db.leases.delete(id);
}
