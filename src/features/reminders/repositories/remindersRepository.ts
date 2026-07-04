import { db } from '@/db/database';
import type { Reminder } from '@/db/types';

export async function fetchAllReminders(): Promise<Reminder[]> {
  return db.reminders.toArray();
}

export async function fetchRemindersByRentId(rentId: number): Promise<Reminder[]> {
  return db.reminders.where('rentId').equals(rentId).toArray();
}

export async function createReminder(
  reminder: Omit<Reminder, 'id' | 'createdAt'>,
  now = new Date()
): Promise<Reminder> {
  const id = await db.reminders.add({ ...reminder, createdAt: now } as Reminder);
  const created = await db.reminders.get(id);
  if (!created) throw new Error('Failed to create reminder');
  return created;
}
