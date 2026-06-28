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

    await db.settings.add({ key: 'ownerName', value: 'Jean Dupont', updatedAt: new Date() } as any);

    const raw = await fetchRawExportData();
    expect(raw.properties.length).toBe(1);
    expect(raw.documents.length).toBe(1);
    expect(raw.settings.length).toBe(1);
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

    await db.settings.add({ key: 'ownerName', value: 'OldOwner', updatedAt: new Date() } as any);

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
      settings: [{ key: 'ownerName', value: 'NewOwner', updatedAt: new Date() }],
    });

    const props = await db.properties.toArray();
    expect(props.length).toBe(1);
    expect(props[0]?.name).toBe('New');

    const settings = await db.settings.toArray();
    expect(settings.length).toBe(1);
    expect(settings[0]?.value).toBe('NewOwner');
  });

  it('round-trips every business table (regression for #55)', async () => {
    const now = new Date();

    // Seed one record in each persisted table.
    await db.properties.add({
      name: 'P',
      address: 'A',
      type: 'apartment',
      surface: 10,
      rooms: 1,
      rent: 500,
      status: 'occupied',
      createdAt: now,
      updatedAt: now,
    } as any);
    await db.tenants.add({
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'j@d.fr',
      phone: '0102030405',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await db.leases.add({
      propertyId: 1,
      tenantIds: [1],
      startDate: now,
      rent: 500,
      charges: 50,
      deposit: 500,
      paymentDay: 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await db.rents.add({
      leaseId: 1,
      dueDate: now,
      amount: 500,
      charges: 50,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    } as any);
    await db.documents.add({
      name: 'doc',
      type: 'other',
      mimeType: 'application/octet-stream',
      size: 3,
      data: new Blob([new Uint8Array([1, 2, 3])]),
      createdAt: now,
      updatedAt: now,
    } as any);
    await db.tenantDocuments.add({
      tenantId: 1,
      name: 'payslip',
      mimeType: 'application/octet-stream',
      size: 2,
      uploadedAt: now,
      data: new Blob([new Uint8Array([4, 5])]),
    } as any);
    await db.tenantAudits.add({
      tenantId: 1,
      action: 'validated',
      timestamp: now,
    } as any);
    await db.inventories.add({ leaseId: 1, type: 'checkin', date: now } as any);
    await db.communications.add({
      relatedEntityType: 'tenant',
      relatedEntityId: 1,
      type: 'email',
      direction: 'outbound',
      content: 'hello',
      date: now,
      createdAt: now,
    } as any);
    await db.chargesAdjustments.add({
      leaseId: 1,
      year: 2025,
      monthlyRent: 500,
      chargesProvisionPaid: 600,
      rentsPaidCount: 12,
      rentsPaidTotal: 6000,
      createdAt: now,
      updatedAt: now,
    } as any);
    await db.settings.add({ key: 'ownerName', value: 'Jean', updatedAt: now } as any);

    // Export must surface every table.
    const raw = await fetchRawExportData();
    expect(raw.properties.length).toBe(1);
    expect(raw.tenants.length).toBe(1);
    expect(raw.leases.length).toBe(1);
    expect(raw.rents.length).toBe(1);
    expect(raw.documents.length).toBe(1);
    expect(raw.tenantDocuments.length).toBe(1);
    expect(raw.tenantAudits.length).toBe(1);
    expect(raw.inventories.length).toBe(1);
    expect(raw.communications.length).toBe(1);
    expect(raw.chargesAdjustments.length).toBe(1);
    expect(raw.settings.length).toBe(1);

    // Import must clear and restore every table (no silent data loss).
    await importBusinessData({
      properties: raw.properties,
      tenants: raw.tenants,
      leases: raw.leases,
      rents: raw.rents,
      documents: raw.documents,
      tenantDocuments: raw.tenantDocuments,
      tenantAudits: raw.tenantAudits,
      inventories: raw.inventories,
      communications: raw.communications,
      chargesAdjustments: raw.chargesAdjustments,
      settings: raw.settings,
    });

    expect(await db.tenantDocuments.count()).toBe(1);
    expect(await db.tenantAudits.count()).toBe(1);
    expect(await db.communications.count()).toBe(1);
    expect(await db.chargesAdjustments.count()).toBe(1);
    expect((await db.chargesAdjustments.toArray())[0]?.rentsPaidTotal).toBe(6000);
  });

  it('clearBusinessData empties every table', async () => {
    const now = new Date();
    await db.communications.add({
      relatedEntityType: 'tenant',
      relatedEntityId: 1,
      type: 'email',
      direction: 'outbound',
      content: 'x',
      date: now,
      createdAt: now,
    } as any);
    await db.chargesAdjustments.add({
      leaseId: 1,
      year: 2025,
      monthlyRent: 500,
      chargesProvisionPaid: 0,
      rentsPaidCount: 0,
      rentsPaidTotal: 0,
      createdAt: now,
      updatedAt: now,
    } as any);

    await clearBusinessData();

    expect(await db.communications.count()).toBe(0);
    expect(await db.chargesAdjustments.count()).toBe(0);
  });
});
