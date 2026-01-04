import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import {
  clearBusinessData,
  fetchRawExportData,
  importBusinessData,
} from './dataTransferRepository';

describe('dataTransferRepository (integration)', () => {
  beforeEach(async () => {
    await db.open();
    await clearBusinessData();
  });

  it('fetchRawExportData returns persisted records', async () => {
    await db.properties.add({
      name: 'P1',
      address: 'A',
      type: 'apartment',
      surface: 10,
      rooms: 1,
      rent: 500,
      status: 'vacant',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' });
    await db.documents.add({
      name: 'doc',
      type: 'other',
      mimeType: 'application/octet-stream',
      size: blob.size,
      data: blob,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const raw = await fetchRawExportData();
    expect(raw.properties.length).toBe(1);
    expect(raw.documents.length).toBe(1);
  });

  it('importBusinessData clears and bulkAdds in a transaction', async () => {
    await db.properties.add({
      name: 'Old',
      address: 'Old',
      type: 'apartment',
      surface: 10,
      rooms: 1,
      rent: 500,
      status: 'vacant',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    await importBusinessData({
      properties: [
        {
          name: 'New',
          address: 'New',
          type: 'apartment',
          surface: 10,
          rooms: 1,
          rent: 500,
          status: 'vacant',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      tenants: [],
      leases: [],
      rents: [],
      documents: [],
      inventories: [],
    });

    const props = await db.properties.toArray();
    expect(props.length).toBe(1);
    expect(props[0]?.name).toBe('New');
  });
});
