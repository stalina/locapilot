import { db } from '@/db/database';
import type { ChargesAdjustmentRow } from '@/db/types';

export async function fetchChargesAdjustmentsByLeaseId(
  leaseId: number
): Promise<ChargesAdjustmentRow[]> {
  return db.chargesAdjustments.where({ leaseId }).sortBy('year');
}

export async function upsertChargesAdjustment(
  row: Partial<ChargesAdjustmentRow> & { leaseId: number; year: number },
  now = new Date()
): Promise<ChargesAdjustmentRow | undefined> {
  const existing = await db.chargesAdjustments
    .where({ leaseId: row.leaseId, year: row.year })
    .first();

  if (existing?.id) {
    const updates = JSON.parse(
      JSON.stringify({ ...row, updatedAt: now })
    ) as Partial<ChargesAdjustmentRow>;
    updates.updatedAt = now;

    await db.chargesAdjustments.update(existing.id, updates);
    return db.chargesAdjustments.get(existing.id);
  }

  const toAdd = JSON.parse(
    JSON.stringify({
      leaseId: row.leaseId,
      year: row.year,
      monthlyRent: row.monthlyRent ?? 0,
      annualCharges: row.annualCharges ?? 0,
      chargesProvisionPaid: row.chargesProvisionPaid ?? 0,
      rentsPaidCount: row.rentsPaidCount ?? 0,
      rentsPaidTotal: row.rentsPaidTotal ?? 0,
      customCharges: row.customCharges ?? {},
      createdAt: now,
      updatedAt: now,
    })
  ) as ChargesAdjustmentRow;

  toAdd.createdAt = now;
  toAdd.updatedAt = now;

  const id = await db.chargesAdjustments.add(toAdd);
  return db.chargesAdjustments.get(id);
}
