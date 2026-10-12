import { db } from '@/db/database';
import type { Expense, Lease, Property, Rent } from '@/db/types';

export interface FiscalSources {
  properties: Property[];
  leases: Lease[];
  rents: Rent[];
  expenses: Expense[];
}

/**
 * Every record the fiscal summary is computed from (read-only: the report
 * never writes to the database).
 */
export async function fetchFiscalSources(): Promise<FiscalSources> {
  const [properties, leases, rents, expenses] = await Promise.all([
    db.properties.toArray(),
    db.leases.toArray(),
    db.rents.toArray(),
    db.expenses.toArray(),
  ]);
  return { properties, leases, rents, expenses };
}
