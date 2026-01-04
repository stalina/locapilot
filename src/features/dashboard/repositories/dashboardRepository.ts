import { db } from '@/db/database';
import type { Communication, Inventory, Lease, Property, Rent } from '@/db/types';

export type DashboardRawData = {
  properties: Property[];
  rentsThisMonth: Rent[];
  allRents: Rent[];
  allLeases: Lease[];
  allInventories: Inventory[];
  allCommunications: Communication[];
};

export async function fetchDashboardRawData(now = new Date()): Promise<DashboardRawData> {
  const properties = await db.properties.toArray();

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const rentsThisMonth = await db.rents
    .where('dueDate')
    .between(new Date(currentYear, currentMonth, 1), new Date(currentYear, currentMonth + 1, 0))
    .toArray();

  const [allRents, allLeases, allInventories, allCommunications] = await Promise.all([
    db.rents.toArray(),
    db.leases.toArray(),
    db.inventories.toArray(),
    db.communications.toArray(),
  ]);

  return {
    properties,
    rentsThisMonth,
    allRents,
    allLeases,
    allInventories,
    allCommunications,
  };
}
