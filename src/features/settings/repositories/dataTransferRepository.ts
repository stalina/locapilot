import { db } from '@/db/database';
import type {
  ChargesAdjustmentRow,
  Communication,
  Document,
  Inventory,
  IrlIndex,
  Lease,
  Property,
  Rent,
  RentRevision,
  Settings,
  Tenant,
  TenantAudit,
  TenantDocument,
} from '@/db/types';

export type RawExportData = {
  properties: Property[];
  tenants: Tenant[];
  leases: Lease[];
  rents: Rent[];
  documents: Document[];
  tenantDocuments: TenantDocument[];
  tenantAudits: TenantAudit[];
  inventories: Inventory[];
  communications: Communication[];
  chargesAdjustments: ChargesAdjustmentRow[];
  irlIndices: IrlIndex[];
  rentRevisions: RentRevision[];
  settings: Settings[];
};

// Single source of truth: every persisted business table must be listed here so
// that fetch / clear / import all stay in sync (cf. issue #55).
const businessTables = () => [
  db.properties,
  db.tenants,
  db.leases,
  db.rents,
  db.documents,
  db.tenantDocuments,
  db.tenantAudits,
  db.inventories,
  db.communications,
  db.chargesAdjustments,
  db.irlIndices,
  db.rentRevisions,
  db.settings,
];

export async function fetchRawExportData(): Promise<RawExportData> {
  const [
    properties,
    tenants,
    leases,
    rents,
    documents,
    tenantDocuments,
    tenantAudits,
    inventories,
    communications,
    chargesAdjustments,
    irlIndices,
    rentRevisions,
    settings,
  ] = await Promise.all([
    db.properties.toArray(),
    db.tenants.toArray(),
    db.leases.toArray(),
    db.rents.toArray(),
    db.documents.toArray(),
    db.tenantDocuments.toArray(),
    db.tenantAudits.toArray(),
    db.inventories.toArray(),
    db.communications.toArray(),
    db.chargesAdjustments.toArray(),
    db.irlIndices.toArray(),
    db.rentRevisions.toArray(),
    db.settings.toArray(),
  ]);

  return {
    properties,
    tenants,
    leases,
    rents,
    documents,
    tenantDocuments,
    tenantAudits,
    inventories,
    communications,
    chargesAdjustments,
    irlIndices,
    rentRevisions,
    settings,
  };
}

export async function clearBusinessData(): Promise<void> {
  const tables = businessTables();
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map(table => table.clear()));
  });
}

export async function importBusinessData(params: {
  properties: unknown[];
  tenants: unknown[];
  leases?: unknown[];
  rents?: unknown[];
  documents?: unknown[];
  tenantDocuments?: unknown[];
  tenantAudits?: unknown[];
  inventories?: unknown[];
  communications?: unknown[];
  chargesAdjustments?: unknown[];
  irlIndices?: unknown[];
  rentRevisions?: unknown[];
  settings?: unknown[];
}): Promise<void> {
  const tables = businessTables();
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map(table => table.clear()));

    if (params.properties.length) await db.properties.bulkAdd(params.properties as any);
    if (params.tenants.length) await db.tenants.bulkAdd(params.tenants as any);
    if (params.leases?.length) await db.leases.bulkAdd(params.leases as any);
    if (params.rents?.length) await db.rents.bulkAdd(params.rents as any);
    if (params.documents?.length) await db.documents.bulkAdd(params.documents as any);
    if (params.tenantDocuments?.length)
      await db.tenantDocuments.bulkAdd(params.tenantDocuments as any);
    if (params.tenantAudits?.length) await db.tenantAudits.bulkAdd(params.tenantAudits as any);
    if (params.inventories?.length) await db.inventories.bulkAdd(params.inventories as any);
    if (params.communications?.length)
      await db.communications.bulkAdd(params.communications as any);
    if (params.chargesAdjustments?.length)
      await db.chargesAdjustments.bulkAdd(params.chargesAdjustments as any);
    if (params.irlIndices?.length) await db.irlIndices.bulkAdd(params.irlIndices as any);
    if (params.rentRevisions?.length) await db.rentRevisions.bulkAdd(params.rentRevisions as any);
    if (params.settings?.length) await db.settings.bulkAdd(params.settings as any);
  });
}
