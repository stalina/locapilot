import type { ChargesAdjustmentRow, Inventory, Lease, Property, RentRevision } from '@/db/types';
import { anniversaryDate } from '@/features/indexation/services/indexationService';
import type { DashboardAlertLink } from './dashboardAlertsService';

export type ScheduleItem = {
  id: string;
  date: Date;
  title: string;
  description: string;
  link: DashboardAlertLink;
};

const DAY_MS = 86_400_000;

/** Fenêtre (en jours) d'anticipation des révisions IRL. */
export const REVISION_WINDOW_DAYS = 30;

function parseDate(input: Date | string | undefined | null): Date | null {
  if (!input) return null;
  const parsed = input instanceof Date ? input : new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function propertyNameForLease(lease: Lease, properties: Property[]): string {
  return properties.find(p => p.id === lease.propertyId)?.name ?? `Bail #${lease.id}`;
}

/**
 * Révisions IRL à venir : baux actifs dont la date anniversaire tombe dans les
 * `REVISION_WINDOW_DAYS` prochains jours et sans révision `applied` pour cette
 * année de révision.
 */
function computeUpcomingRevisions(params: {
  leases: Lease[];
  properties: Property[];
  revisions: RentRevision[];
  now: Date;
}): ScheduleItem[] {
  const { leases, properties, revisions, now } = params;
  const windowEnd = now.getTime() + REVISION_WINDOW_DAYS * DAY_MS;
  const items: ScheduleItem[] = [];

  for (const lease of leases) {
    if (lease.status !== 'active') continue;
    const start = parseDate(lease.startDate);
    if (!start) continue;

    // L'anniversaire dans la fenêtre peut appartenir à l'année courante ou à la
    // suivante (fenêtre à cheval sur le 1er janvier).
    for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
      // Pas de révision avant le premier anniversaire du bail.
      if (year <= start.getFullYear()) continue;

      const anniversary = anniversaryDate(start, year);
      if (anniversary.getTime() < now.getTime() || anniversary.getTime() > windowEnd) continue;

      const alreadyApplied = revisions.some(
        r => r.leaseId === lease.id && r.year === year && r.status === 'applied'
      );
      if (alreadyApplied) continue;

      items.push({
        id: `revision-${lease.id}-${year}`,
        date: anniversary,
        title: 'Réviser le loyer',
        description: `${propertyNameForLease(lease, properties)} — révision IRL ${year}`,
        link: { path: '/indexation' },
      });
    }
  }

  return items;
}

/**
 * Régularisations de charges en attente : baux actifs (déjà en cours l'année
 * précédente) sans ligne de régularisation pour l'année N-1.
 */
function computePendingChargesRegularizations(params: {
  leases: Lease[];
  properties: Property[];
  adjustments: ChargesAdjustmentRow[];
  now: Date;
}): ScheduleItem[] {
  const { leases, properties, adjustments, now } = params;
  const previousYear = now.getFullYear() - 1;

  return leases
    .filter(lease => {
      if (lease.status !== 'active') return false;
      const start = parseDate(lease.startDate);
      // Le bail doit avoir couru sur l'année N-1 pour avoir des charges à régulariser.
      if (!start || start.getFullYear() > previousYear) return false;
      return !adjustments.some(a => a.leaseId === lease.id && a.year === previousYear);
    })
    .map(lease => ({
      id: `charges-${lease.id}-${previousYear}`,
      date: now,
      title: `Régulariser les charges ${previousYear}`,
      description: propertyNameForLease(lease, properties),
      link: { path: `/leases/${lease.id}` },
    }));
}

/**
 * États des lieux planifiés : inventaires dont la date est dans le futur.
 */
function computeScheduledInventories(params: {
  inventories: Inventory[];
  leases: Lease[];
  properties: Property[];
  now: Date;
}): ScheduleItem[] {
  const { inventories, leases, properties, now } = params;

  return inventories
    .map(inventory => ({ inventory, date: parseDate(inventory.date) }))
    .filter(({ date }) => date !== null && date.getTime() > now.getTime())
    .map(({ inventory, date }) => {
      const lease = leases.find(l => l.id === inventory.leaseId);
      return {
        id: `inventory-${inventory.id}`,
        date: date as Date,
        title:
          inventory.type === 'checkin' ? "État des lieux d'entrée" : 'État des lieux de sortie',
        description: lease ? propertyNameForLease(lease, properties) : `Bail #${inventory.leaseId}`,
        link: { path: '/inventories' },
      };
    });
}

/**
 * Construit l'échéancier des prochaines actions du bailleur (révisions IRL,
 * régularisations de charges, états des lieux), trié par date croissante.
 */
export function computeActionSchedule(params: {
  leases: Lease[];
  properties: Property[];
  revisions: RentRevision[];
  adjustments: ChargesAdjustmentRow[];
  inventories: Inventory[];
  now?: Date;
}): ScheduleItem[] {
  const now = params.now ?? new Date();
  const { leases, properties, revisions, adjustments, inventories } = params;

  const items = [
    ...computeUpcomingRevisions({ leases, properties, revisions, now }),
    ...computePendingChargesRegularizations({ leases, properties, adjustments, now }),
    ...computeScheduledInventories({ inventories, leases, properties, now }),
  ];

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}
