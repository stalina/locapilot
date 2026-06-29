import { db } from '@/db/database';
import type { RentRevision } from '@/db/types';

export async function fetchRevisionsByLeaseId(leaseId: number): Promise<RentRevision[]> {
  const rows = await db.rentRevisions.where('leaseId').equals(leaseId).toArray();
  return rows.sort((a, b) => b.year - a.year);
}

/**
 * Crée ou met à jour la révision d'un bail pour une année donnée (upsert sur le
 * couple leaseId + year).
 */
export async function upsertRevision(
  revision: Omit<RentRevision, 'id' | 'createdAt' | 'updatedAt'>,
  now = new Date()
): Promise<RentRevision | undefined> {
  const existing = await db.rentRevisions
    .where('[leaseId+year]')
    .equals([revision.leaseId, revision.year])
    .first();

  if (existing?.id) {
    await db.rentRevisions.update(existing.id, { ...revision, updatedAt: now });
    return db.rentRevisions.get(existing.id);
  }

  const id = await db.rentRevisions.add({
    ...revision,
    createdAt: now,
    updatedAt: now,
  } as RentRevision);
  return db.rentRevisions.get(id);
}

export async function updateRevision(
  id: number,
  updates: Partial<Omit<RentRevision, 'id' | 'createdAt'>>,
  now = new Date()
): Promise<RentRevision | undefined> {
  await db.rentRevisions.update(id, { ...updates, updatedAt: now });
  return db.rentRevisions.get(id);
}

export async function deleteRevision(id: number): Promise<void> {
  await db.rentRevisions.delete(id);
}
