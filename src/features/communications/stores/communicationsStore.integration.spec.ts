import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { db } from '@/db/database';
import { useCommunicationsStore } from './communicationsStore';

describe('communicationsStore - integration', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.open();
    await db.communications.clear();
    await db.reminders.clear();
    await db.documents.clear();
  });

  it('fetches communications sorted most-recent-first', async () => {
    await db.communications.bulkAdd([
      {
        relatedEntityType: 'tenant',
        relatedEntityId: 1,
        type: 'phone',
        direction: 'inbound',
        content: 'ancien',
        date: new Date('2026-01-01'),
        createdAt: new Date(),
      },
      {
        relatedEntityType: 'tenant',
        relatedEntityId: 1,
        type: 'email',
        direction: 'outbound',
        content: 'récent',
        date: new Date('2026-06-01'),
        createdAt: new Date(),
      },
    ] as any);

    const store = useCommunicationsStore();
    await store.fetchCommunications();

    expect(store.communications[0].content).toBe('récent');
  });

  it('creates a manual communication and places it at the top', async () => {
    const store = useCommunicationsStore();
    await store.fetchCommunications();

    const created = await store.createCommunication({
      relatedEntityType: 'tenant',
      relatedEntityId: 1,
      type: 'phone',
      direction: 'inbound',
      subject: 'Appel',
      content: 'Le locataire a appelé',
      date: new Date('2026-06-15'),
    });

    expect(created.id).toBeTypeOf('number');
    expect(store.communications[0].id).toBe(created.id);
  });

  it('rejects a manual communication with a future date', async () => {
    const store = useCommunicationsStore();
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);

    await expect(
      store.createCommunication({
        relatedEntityType: 'tenant',
        relatedEntityId: 1,
        type: 'phone',
        direction: 'inbound',
        content: 'futur',
        date: future,
      })
    ).rejects.toThrow(/futur/i);
    expect(store.communications).toHaveLength(0);
  });

  it('rejects a manual communication with empty content', async () => {
    const store = useCommunicationsStore();
    await expect(
      store.createCommunication({
        relatedEntityType: 'tenant',
        relatedEntityId: 1,
        type: 'phone',
        direction: 'inbound',
        content: '   ',
        date: new Date('2026-01-01'),
      })
    ).rejects.toThrow(/contenu/i);
  });

  it('marks reminder-linked communications as read-only and refuses edit/delete', async () => {
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

    const store = useCommunicationsStore();
    await store.fetchCommunications();

    expect(store.isReadOnly({ id: commId })).toBe(true);
    await expect(store.deleteCommunication(commId)).rejects.toThrow(/lecture seule/i);
    // The read-only communication was not removed.
    expect(await db.communications.get(commId)).toBeDefined();
  });

  it('deletes a manual communication but keeps its attachment', async () => {
    const docId = (await db.documents.add({
      name: 'note.pdf',
      type: 'other',
      mimeType: 'application/pdf',
      size: 5,
      data: new Blob(['x']),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)) as number;

    const store = useCommunicationsStore();
    await store.fetchCommunications();
    const created = await store.createCommunication({
      relatedEntityType: 'lease',
      relatedEntityId: 1,
      type: 'letter',
      direction: 'outbound',
      content: 'courrier manuel',
      date: new Date('2026-01-01'),
      attachments: [docId],
    });

    await store.deleteCommunication(created.id!);

    expect(store.communications.find(c => c.id === created.id)).toBeUndefined();
    expect(await db.documents.get(docId)).toBeDefined();
  });

  it('applies filters through the getter', async () => {
    const store = useCommunicationsStore();
    await store.fetchCommunications();
    await store.createCommunication({
      relatedEntityType: 'tenant',
      relatedEntityId: 1,
      type: 'phone',
      direction: 'inbound',
      content: 'appel',
      date: new Date('2026-01-01'),
    });
    await store.createCommunication({
      relatedEntityType: 'tenant',
      relatedEntityId: 1,
      type: 'letter',
      direction: 'outbound',
      content: 'courrier',
      date: new Date('2026-02-01'),
    });

    store.filters.type = 'letter';
    expect(store.filteredCommunications).toHaveLength(1);
    expect(store.filteredCommunications[0].content).toBe('courrier');

    store.resetFilters();
    expect(store.filteredCommunications).toHaveLength(2);
  });
});
