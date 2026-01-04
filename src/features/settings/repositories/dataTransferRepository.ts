import { db } from '@/db/database';
import type { Document, Inventory, Lease, Property, Rent, Tenant } from '@/db/types';

export type RawExportData = {
  properties: Property[];
  tenants: Tenant[];
  leases: Lease[];
  rents: Rent[];
  documents: Document[];
  inventories: Inventory[];
};

export async function fetchRawExportData(): Promise<RawExportData> {
  const [properties, tenants, leases, rents, documents, inventories] = await Promise.all([
    db.properties.toArray(),
    db.tenants.toArray(),
    db.leases.toArray(),
    db.rents.toArray(),
    db.documents.toArray(),
    db.inventories.toArray(),
  ]);

  return { properties, tenants, leases, rents, documents, inventories };
}

export async function clearBusinessData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.properties, db.tenants, db.leases, db.rents, db.documents, db.inventories],
    async () => {
      await Promise.all([
        db.properties.clear(),
        db.tenants.clear(),
        db.leases.clear(),
        db.rents.clear(),
        db.documents.clear(),
        db.inventories.clear(),
      ]);
    }
  );
}

export async function importBusinessData(params: {
  properties: unknown[];
  tenants: unknown[];
  leases?: unknown[];
  rents?: unknown[];
  documents?: unknown[];
  inventories?: unknown[];
}): Promise<void> {
  await db.transaction(
    'rw',
    [db.properties, db.tenants, db.leases, db.rents, db.documents, db.inventories],
    async () => {
      await Promise.all([
        db.properties.clear(),
        db.tenants.clear(),
        db.leases.clear(),
        db.rents.clear(),
        db.documents.clear(),
        db.inventories.clear(),
      ]);

      if (params.properties.length) await db.properties.bulkAdd(params.properties as any);
      if (params.tenants.length) await db.tenants.bulkAdd(params.tenants as any);
      if (params.leases?.length) await db.leases.bulkAdd(params.leases as any);
      if (params.rents?.length) await db.rents.bulkAdd(params.rents as any);
      if (params.documents?.length) await db.documents.bulkAdd(params.documents as any);
      if (params.inventories?.length) await db.inventories.bulkAdd(params.inventories as any);
    }
  );
}
