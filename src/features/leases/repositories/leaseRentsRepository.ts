import { db } from '@/db/database';
import type { Rent } from '@/db/types';

export async function fetchRentsByLeaseId(leaseId: number): Promise<Rent[]> {
  return db.rents.where({ leaseId }).toArray();
}
