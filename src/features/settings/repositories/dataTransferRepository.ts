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
  Reminder,
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
  reminders: Reminder[];
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
  db.reminders,
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
    reminders,
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
    db.reminders.toArray(),
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
    reminders,
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
  reminders?: unknown[];
  settings?: unknown[];
}): Promise<void> {
  const tables = businessTables();
  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map(table => table.clear()));

    // Records were validated by importValidationService before reaching here;
    // date fields may still be ISO strings (stored as-is, as before), so each
    // array is asserted to its table's entity type at the Dexie boundary.
    if (params.properties.length) await db.properties.bulkAdd(params.properties as Property[]);
    if (params.tenants.length) await db.tenants.bulkAdd(params.tenants as Tenant[]);
    if (params.leases?.length) await db.leases.bulkAdd(params.leases as Lease[]);
    if (params.rents?.length) await db.rents.bulkAdd(params.rents as Rent[]);
    if (params.documents?.length) await db.documents.bulkAdd(params.documents as Document[]);
    if (params.tenantDocuments?.length)
      await db.tenantDocuments.bulkAdd(params.tenantDocuments as TenantDocument[]);
    if (params.tenantAudits?.length)
      await db.tenantAudits.bulkAdd(params.tenantAudits as TenantAudit[]);
    if (params.inventories?.length) await db.inventories.bulkAdd(params.inventories as Inventory[]);
    if (params.communications?.length)
      await db.communications.bulkAdd(params.communications as Communication[]);
    if (params.chargesAdjustments?.length)
      await db.chargesAdjustments.bulkAdd(params.chargesAdjustments as ChargesAdjustmentRow[]);
    if (params.irlIndices?.length) await db.irlIndices.bulkAdd(params.irlIndices as IrlIndex[]);
    if (params.rentRevisions?.length)
      await db.rentRevisions.bulkAdd(params.rentRevisions as RentRevision[]);
    if (params.reminders?.length) await db.reminders.bulkAdd(params.reminders as Reminder[]);
    if (params.settings?.length) await db.settings.bulkAdd(params.settings as Settings[]);
  });
}
