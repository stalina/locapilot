import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import {
  createCommunication,
  deleteCommunication,
  fetchAllCommunications,
  fetchCommunicationsByEntity,
  fetchCommunicationsForLease,
  fetchReminderLinkedCommunicationIds,
  updateCommunication,
} from './communicationsRepository';

describe('communicationsRepository', () => {
  beforeEach(async () => {
    await db.open();
    await db.communications.clear();
    await db.reminders.clear();
    await db.documents.clear();
    await db.rents.clear();
  });

  it('creates a communication with a createdAt timestamp', async () => {
    const now = new Date('2026-07-01T10:00:00.000Z');
    const created = await createCommunication(
      {
        relatedEntityType: 'tenant',
        relatedEntityId: 1,
        type: 'phone',
        direction: 'inbound',
        content: 'Appel entrant',
        date: new Date('2026-06-30'),
      },
      now
    );
    expect(created.id).toBeTypeOf('number');
    expect(created.createdAt).toEqual(now);
  });

  it('lists all communications most-recent-first', async () => {
    await createCommunication({
      relatedEntityType: 'tenant',
      relatedEntityId: 1,
      type: 'phone',
      direction: 'inbound',
      content: 'ancien',
      date: new Date('2026-01-01'),
    });
    await createCommunication({
      relatedEntityType: 'tenant',
      relatedEntityId: 1,
      type: 'email',
      direction: 'outbound',
      content: 'récent',
      date: new Date('2026-06-01'),
    });
    const all = await fetchAllCommunications();
    expect(all.map(c => c.content)).toEqual(['récent', 'ancien']);
  });

  it('lists communications scoped by entity', async () => {
    await createCommunication({
      relatedEntityType: 'tenant',
      relatedEntityId: 1,
      type: 'phone',
      direction: 'inbound',
      content: 'pour tenant 1',
      date: new Date('2026-01-01'),
    });
    await createCommunication({
      relatedEntityType: 'tenant',
      relatedEntityId: 2,
      type: 'phone',
      direction: 'inbound',
      content: 'pour tenant 2',
      date: new Date('2026-01-01'),
    });
    await createCommunication({
      relatedEntityType: 'lease',
      relatedEntityId: 1,
      type: 'phone',
      direction: 'inbound',
      content: 'pour lease 1',
      date: new Date('2026-01-01'),
    });

    const forTenant1 = await fetchCommunicationsByEntity('tenant', 1);
    expect(forTenant1).toHaveLength(1);
    expect(forTenant1[0].content).toBe('pour tenant 1');
  });

  it('updates a communication', async () => {
    const created = await createCommunication({
      relatedEntityType: 'tenant',
      relatedEntityId: 1,
      type: 'phone',
      direction: 'inbound',
      subject: 'avant',
      content: 'avant',
      date: new Date('2026-01-01'),
    });
    const updated = await updateCommunication(created.id!, { subject: 'après', content: 'après' });
    expect(updated.subject).toBe('après');
    expect(updated.content).toBe('après');
  });

  it('deletes a communication without deleting its attached documents', async () => {
    const docId = (await db.documents.add({
      name: 'lettre.pdf',
      type: 'other',
      mimeType: 'application/pdf',
      size: 10,
      data: new Blob(['x']),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)) as number;

    const created = await createCommunication({
      relatedEntityType: 'rent',
      relatedEntityId: 1,
      type: 'letter',
      direction: 'outbound',
      content: 'relance',
      date: new Date('2026-01-01'),
      attachments: [docId],
    });

    await deleteCommunication(created.id!);

    expect(await db.communications.get(created.id!)).toBeUndefined();
    // The attached document must survive.
    expect(await db.documents.get(docId)).toBeDefined();
  });

  it('reports communication ids referenced by reminders', async () => {
    const commId = (await db.communications.add({
      relatedEntityType: 'rent',
      relatedEntityId: 1,
      type: 'letter',
      direction: 'outbound',
      content: 'relance auto',
      date: new Date('2026-01-01'),
      createdAt: new Date(),
    } as any)) as number;

    await db.reminders.add({
      rentId: 1,
      level: 'amiable',
      thresholdDays: 5,
      sentDate: new Date(),
      documentId: 1,
      communicationId: commId,
      createdAt: new Date(),
    } as any);

    const linked = await fetchReminderLinkedCommunicationIds();
    expect(linked.has(commId)).toBe(true);
    expect(linked.has(9999)).toBe(false);
  });

  describe('fetchCommunicationsForLease', () => {
    it('aggregates lease-scoped and rent-scoped communications, most-recent-first', async () => {
      const leaseId = 50;
      // A rent belonging to the lease
      const rentId = (await db.rents.add({
        leaseId,
        dueDate: new Date('2026-05-01'),
        amount: 1000,
        charges: 0,
        status: 'late',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)) as number;

      // Directly lease-scoped communication (older)
      await createCommunication({
        relatedEntityType: 'lease',
        relatedEntityId: leaseId,
        type: 'meeting',
        direction: 'outbound',
        content: 'visite du bail',
        date: new Date('2026-04-01'),
      });

      // Reminder letter historized on the rent (newer)
      await createCommunication({
        relatedEntityType: 'rent',
        relatedEntityId: rentId,
        type: 'letter',
        direction: 'outbound',
        subject: 'Relance amiable',
        content: 'Relance amiable envoyée pour un impayé.',
        date: new Date('2026-06-01'),
      });

      // Noise: a communication on a rent of a DIFFERENT lease must not leak in
      const otherRentId = (await db.rents.add({
        leaseId: 999,
        dueDate: new Date('2026-05-01'),
        amount: 500,
        charges: 0,
        status: 'late',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)) as number;
      await createCommunication({
        relatedEntityType: 'rent',
        relatedEntityId: otherRentId,
        type: 'letter',
        direction: 'outbound',
        content: 'relance autre bail',
        date: new Date('2026-06-15'),
      });

      const result = await fetchCommunicationsForLease(leaseId);

      expect(result).toHaveLength(2);
      // Most-recent-first: the historized reminder letter comes first
      expect(result[0].type).toBe('letter');
      expect(result[0].content).toContain('Relance amiable');
      expect(result[1].content).toBe('visite du bail');
      // The other lease's reminder is excluded
      expect(result.some(c => c.content === 'relance autre bail')).toBe(false);
    });

    it('returns lease-scoped communications when the lease has no rents', async () => {
      const leaseId = 60;
      await createCommunication({
        relatedEntityType: 'lease',
        relatedEntityId: leaseId,
        type: 'phone',
        direction: 'inbound',
        content: 'appel bail',
        date: new Date('2026-01-01'),
      });

      const result = await fetchCommunicationsForLease(leaseId);
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('appel bail');
    });
  });
});
