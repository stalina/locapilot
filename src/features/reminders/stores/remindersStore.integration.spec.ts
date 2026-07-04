import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRemindersStore } from './remindersStore';
import { db } from '@/db/database';

describe('remindersStore - integration', () => {
  let leaseId: number;
  let rentId: number;

  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.open();
    await db.reminders.clear();
    await db.communications.clear();
    await db.documents.clear();
    await db.rents.clear();
    await db.leases.clear();
    await db.properties.clear();
    await db.tenants.clear();
    await db.settings.clear();

    const now = new Date();
    const propertyId = (await db.properties.add({
      name: 'Studio Belleville',
      address: '1 rue Test',
      postalCode: '75020',
      town: 'Paris',
      type: 'studio',
      surface: 20,
      rooms: 1,
      rent: 800,
      status: 'occupied',
      createdAt: now,
      updatedAt: now,
    } as any)) as number;

    const tenantId = (await db.tenants.add({
      civility: 'mme',
      firstName: 'Marie',
      lastName: 'Martin',
      email: 'marie@example.com',
      phone: '0102030405',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any)) as number;

    leaseId = (await db.leases.add({
      propertyId,
      tenantIds: [tenantId],
      startDate: new Date('2025-01-01'),
      rent: 800,
      charges: 50,
      deposit: 800,
      paymentDay: 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any)) as number;

    rentId = (await db.rents.add({
      leaseId,
      dueDate: new Date('2026-01-01'),
      amount: 800,
      charges: 50,
      status: 'late',
      createdAt: now,
      updatedAt: now,
    } as any)) as number;
  });

  afterEach(async () => {
    await db.close();
  });

  async function seedGeneratedDocument(): Promise<number> {
    const now = new Date();
    return (await db.documents.add({
      name: 'relance.docx',
      type: 'other',
      relatedEntityType: 'rent',
      relatedEntityId: rentId,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 10,
      data: new Blob([new Uint8Array([1, 2, 3])]),
      createdAt: now,
      updatedAt: now,
    } as any)) as number;
  }

  it('recordReminderSent saves a communication and a reminder linked to the generated document', async () => {
    const store = useRemindersStore();
    const documentId = await seedGeneratedDocument();

    const reminder = await store.recordReminderSent({
      rentId,
      level: 'amiable',
      thresholdDays: 30,
      documentId,
      levelLabel: 'Relance amiable',
      amountDue: '850,00',
      daysLate: 34,
    });

    expect(reminder.rentId).toBe(rentId);
    expect(reminder.level).toBe('amiable');
    expect(reminder.documentId).toBe(documentId);
    expect(store.reminders).toHaveLength(1);

    const communication = await db.communications.get(reminder.communicationId);
    expect(communication).toBeDefined();
    expect(communication?.relatedEntityType).toBe('rent');
    expect(communication?.relatedEntityId).toBe(rentId);
    expect(communication?.type).toBe('letter');
    expect(communication?.attachments).toEqual([documentId]);
  });

  it('fetchReminders loads persisted reminders', async () => {
    const store = useRemindersStore();
    const documentId = await seedGeneratedDocument();
    await store.recordReminderSent({
      rentId,
      level: 'amiable',
      thresholdDays: 30,
      documentId,
      levelLabel: 'Relance amiable',
      amountDue: '850,00',
      daysLate: 34,
    });

    // Simulate a fresh load (e.g. after navigating back to the page)
    store.reminders = [];
    await store.fetchReminders();

    expect(store.reminders).toHaveLength(1);
    expect(store.reminders[0]?.rentId).toBe(rentId);
  });
});
