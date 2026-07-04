import { db } from '@/db/database';
import type {
  ChargesAdjustmentRow,
  Communication,
  Document,
  Inventory,
  Lease,
  Property,
  Reminder,
  Rent,
  RentRevision,
} from '@/db/types';

export type DashboardRawData = {
  properties: Property[];
  rentsThisMonth: Rent[];
  allRents: Rent[];
  allLeases: Lease[];
  allInventories: Inventory[];
  allCommunications: Communication[];
  allReminders: Reminder[];
  diagnosticDocuments: Document[];
  allRentRevisions: RentRevision[];
  allChargesAdjustments: ChargesAdjustmentRow[];
};

export async function fetchDashboardRawData(now = new Date()): Promise<DashboardRawData> {
  const properties = await db.properties.toArray();

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const rentsThisMonth = await db.rents
    .where('dueDate')
    .between(new Date(currentYear, currentMonth, 1), new Date(currentYear, currentMonth + 1, 0))
    .toArray();

  const [
    allRents,
    allLeases,
    allInventories,
    allCommunications,
    allReminders,
    diagnosticDocuments,
    allRentRevisions,
    allChargesAdjustments,
  ] = await Promise.all([
    db.rents.toArray(),
    db.leases.toArray(),
    db.inventories.toArray(),
    db.communications.toArray(),
    db.reminders.toArray(),
    // Seuls les diagnostics sont nécessaires (alerte d'expiration) — évite de
    // charger les blobs de tous les documents.
    db.documents.where('type').equals('diagnostic').toArray(),
    db.rentRevisions.toArray(),
    db.chargesAdjustments.toArray(),
  ]);

  return {
    properties,
    rentsThisMonth,
    allRents,
    allLeases,
    allInventories,
    allCommunications,
    allReminders,
    diagnosticDocuments,
    allRentRevisions,
    allChargesAdjustments,
  };
}
