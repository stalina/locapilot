import { db } from '@/db/database';
import type { Communication } from '@/db/types';

/**
 * Fetch every communication, ordered most-recent-first by `date`.
 */
export async function fetchAllCommunications(): Promise<Communication[]> {
  const all = await db.communications.toArray();
  return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Fetch the communications attached to a single entity, most-recent-first.
 */
export async function fetchCommunicationsByEntity(
  relatedEntityType: Communication['relatedEntityType'],
  relatedEntityId: number
): Promise<Communication[]> {
  const rows = await db.communications
    .where('relatedEntityType')
    .equals(relatedEntityType)
    .and(c => c.relatedEntityId === relatedEntityId)
    .toArray();
  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Fetch every communication relevant to a lease: those scoped directly to the
 * lease (`relatedEntityType='lease'`) AND those scoped to any of the lease's
 * rents (`relatedEntityType='rent'`). Reminder letters are historized on the
 * rent, so aggregating rent-scoped communications is what surfaces them on the
 * lease timeline. Result is de-duplicated and sorted most-recent-first.
 */
export async function fetchCommunicationsForLease(leaseId: number): Promise<Communication[]> {
  const rents = await db.rents.where('leaseId').equals(leaseId).toArray();
  const rentIds = new Set(
    rents.map(r => r.id).filter((id): id is number => typeof id === 'number')
  );

  const [leaseScoped, rentScoped] = await Promise.all([
    db.communications
      .where('relatedEntityType')
      .equals('lease')
      .and(c => c.relatedEntityId === leaseId)
      .toArray(),
    rentIds.size > 0
      ? db.communications
          .where('relatedEntityType')
          .equals('rent')
          .and(c => rentIds.has(c.relatedEntityId))
          .toArray()
      : Promise.resolve([] as Communication[]),
  ]);

  const byId = new Map<number | undefined, Communication>();
  for (const c of [...leaseScoped, ...rentScoped]) {
    byId.set(c.id, c);
  }

  return [...byId.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function createCommunication(
  communication: Omit<Communication, 'id' | 'createdAt'>,
  now = new Date()
): Promise<Communication> {
  const id = (await db.communications.add({
    ...communication,
    createdAt: now,
  } as Communication)) as number;
  const created = await db.communications.get(id);
  if (!created) throw new Error('Failed to create communication');
  return created;
}

export async function updateCommunication(
  id: number,
  changes: Partial<Omit<Communication, 'id' | 'createdAt'>>
): Promise<Communication> {
  await db.communications.update(id, changes);
  const updated = await db.communications.get(id);
  if (!updated) throw new Error('Communication not found after update');
  return updated;
}

/**
 * Delete a communication. Attached `Document` records are intentionally left
 * untouched: they may be shared (e.g. a reminder letter is also referenced by a
 * Reminder row) and belong to the Documents module.
 */
export async function deleteCommunication(id: number): Promise<void> {
  await db.communications.delete(id);
}

/**
 * Return the set of communication ids that are referenced by a Reminder row.
 * These entries were auto-generated and must be treated as read-only.
 */
export async function fetchReminderLinkedCommunicationIds(): Promise<Set<number>> {
  const reminders = await db.reminders.toArray();
  return new Set(
    reminders.map(r => r.communicationId).filter((cid): cid is number => typeof cid === 'number')
  );
}
