import type { Lease, Property, Rent } from '@/db/types';
import { parseDate } from './dashboardService';

/**
 * A single point of a dashboard analysis chart: a human-readable label and a
 * numeric value. Used by the revenue curve, occupancy curve and the
 * revenue-per-property breakdown.
 */
export type ChartPoint = {
  label: string;
  value: number;
};

const MONTHS_WINDOW = 12;

/** Rent statuses that count as cashed-in for the revenue charts. */
const CASHED_STATUSES: ReadonlyArray<Rent['status']> = ['paid', 'partial'];

function isCashed(rent: Rent): boolean {
  return CASHED_STATUSES.includes(rent.status);
}

/** Amount actually received for a rent (paidAmount, falling back to amount). */
function cashedAmount(rent: Rent): number {
  return rent.paidAmount ?? rent.amount;
}

/** First day of the month containing `d`, at 00:00:00.000. */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/** Last millisecond of the month containing `d`. */
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthLabel(d: Date): string {
  // e.g. "juil. 2026"
  return d.toLocaleString('fr-FR', { month: 'short', year: 'numeric' });
}

type MonthBucket = {
  start: Date;
  end: Date;
  label: string;
};

/**
 * The last `MONTHS_WINDOW` months up to and including the month of `now`,
 * ordered oldest → newest.
 */
function lastMonths(now: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const anchor = startOfMonth(now);
  for (let i = MONTHS_WINDOW - 1; i >= 0; i--) {
    const start = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1, 0, 0, 0, 0);
    buckets.push({ start, end: endOfMonth(start), label: monthLabel(start) });
  }
  return buckets;
}

/**
 * Monthly cash-flow over the last 12 months: sum of the received amounts
 * (`paidAmount ?? amount`) of paid/partial rents whose payment date
 * (`paidDate`, falling back to `dueDate`) falls in each month.
 *
 * Returns an empty array when no cashed rent exists at all (empty state);
 * otherwise every month is present, with 0 for months without revenue.
 */
export function buildRevenueSeries(params: { rents: Rent[]; now?: Date }): ChartPoint[] {
  const now = params.now ?? new Date();
  const cashedRents = params.rents.filter(isCashed);
  if (cashedRents.length === 0) return [];

  const buckets = lastMonths(now);
  return buckets.map(bucket => {
    let value = 0;
    for (const rent of cashedRents) {
      const when = parseDate(rent.paidDate ?? null) ?? parseDate(rent.dueDate ?? null);
      if (when && when >= bucket.start && when <= bucket.end) {
        value += cashedAmount(rent);
      }
    }
    return { label: bucket.label, value };
  });
}

/**
 * Monthly occupancy rate over the last 12 months: percentage of properties
 * that had at least one active lease during each month, rounded to 1 decimal.
 *
 * A lease is active for a month when `startDate <= end-of-month` and
 * (`endDate` is empty or `endDate >= start-of-month`).
 *
 * Returns an empty array when there is no property at all (empty state).
 */
export function buildOccupancySeries(params: {
  properties: Property[];
  leases: Lease[];
  now?: Date;
}): ChartPoint[] {
  const now = params.now ?? new Date();
  const total = params.properties.length;
  if (total === 0) return [];

  const buckets = lastMonths(now);
  return buckets.map(bucket => {
    const occupiedPropertyIds = new Set<number>();
    for (const lease of params.leases) {
      const start = parseDate(lease.startDate ?? null);
      if (!start || start > bucket.end) continue;
      const end = parseDate(lease.endDate ?? null);
      if (end && end < bucket.start) continue;
      occupiedPropertyIds.add(lease.propertyId);
    }
    // Only count properties that actually exist in the current portfolio.
    let occupiedCount = 0;
    for (const property of params.properties) {
      if (property.id !== undefined && occupiedPropertyIds.has(property.id)) {
        occupiedCount++;
      }
    }
    const value = Math.round((occupiedCount / total) * 100 * 10) / 10;
    return { label: bucket.label, value };
  });
}

/**
 * Revenue received over the last 12 months grouped by property, joining
 * `rent.leaseId → lease.propertyId → property.name`. Rents whose lease or
 * property cannot be resolved are silently skipped (never throw).
 *
 * Returns the properties ordered by descending revenue; empty when no cashed
 * rent resolves to a property (empty state).
 */
export function buildRevenuePerProperty(params: {
  rents: Rent[];
  leases: Lease[];
  properties: Property[];
  now?: Date;
}): ChartPoint[] {
  const now = params.now ?? new Date();
  const buckets = lastMonths(now);
  const windowStart = buckets[0]?.start ?? startOfMonth(now);
  const windowEnd = buckets[buckets.length - 1]?.end ?? endOfMonth(now);

  const leaseToProperty = new Map<number, number>();
  for (const lease of params.leases) {
    if (lease.id !== undefined) leaseToProperty.set(lease.id, lease.propertyId);
  }
  const propertyName = new Map<number, string>();
  for (const property of params.properties) {
    if (property.id !== undefined) propertyName.set(property.id, property.name);
  }

  const totals = new Map<number, number>();
  for (const rent of params.rents) {
    if (!isCashed(rent)) continue;
    const when = parseDate(rent.paidDate ?? null) ?? parseDate(rent.dueDate ?? null);
    if (!when || when < windowStart || when > windowEnd) continue;

    const propertyId = leaseToProperty.get(rent.leaseId);
    if (propertyId === undefined) continue; // lease not resolvable
    if (!propertyName.has(propertyId)) continue; // property not resolvable

    totals.set(propertyId, (totals.get(propertyId) ?? 0) + cashedAmount(rent));
  }

  return [...totals.entries()]
    .map(([propertyId, value]) => ({
      label: propertyName.get(propertyId) ?? `#${propertyId}`,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}
