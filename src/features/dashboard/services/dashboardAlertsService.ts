import type { Document, Lease, Property, Rent } from '@/db/types';

export type DashboardAlertSeverity = 'critical' | 'warning';

export type DashboardAlertLink = {
  path: string;
  query?: Record<string, string>;
};

export type DashboardAlert = {
  id: string;
  severity: DashboardAlertSeverity;
  title: string;
  description: string;
  link: DashboardAlertLink;
};

const DAY_MS = 86_400_000;

/** Seuil (en jours) au-delà duquel un impayé devient critique. */
export const CRITICAL_ARREARS_DAYS = 60;

/** Fenêtre (en jours) d'anticipation des fins de bail. */
export const LEASE_EXPIRY_WINDOW_DAYS = 30;

function parseDate(input: Date | string | undefined | null): Date | null {
  if (!input) return null;
  const parsed = input instanceof Date ? input : new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function propertyNameForLease(
  lease: Lease | undefined,
  properties: Property[]
): string | undefined {
  if (!lease) return undefined;
  return properties.find(p => p.id === lease.propertyId)?.name;
}

/**
 * Impayés critiques : loyers `late` ou `partial` dont l'échéance est dépassée
 * de plus de `CRITICAL_ARREARS_DAYS` jours.
 */
function computeCriticalArrearsAlerts(params: {
  rents: Rent[];
  leases: Lease[];
  properties: Property[];
  now: Date;
}): DashboardAlert[] {
  const { rents, leases, properties, now } = params;

  return rents
    .map(rent => ({ rent, dueDate: parseDate(rent.dueDate) }))
    .filter(({ rent, dueDate }) => {
      if (rent.status !== 'late' && rent.status !== 'partial') return false;
      if (!dueDate) return false;
      const daysOverdue = (now.getTime() - dueDate.getTime()) / DAY_MS;
      return daysOverdue > CRITICAL_ARREARS_DAYS;
    })
    .map(({ rent, dueDate }) => {
      const daysOverdue = Math.floor((now.getTime() - (dueDate as Date).getTime()) / DAY_MS);
      const lease = leases.find(l => l.id === rent.leaseId);
      const propertyName = propertyNameForLease(lease, properties);
      const where = propertyName ? ` — ${propertyName}` : '';
      return {
        id: `arrears-${rent.id}`,
        severity: 'critical' as const,
        title: 'Impayé critique',
        description: `Loyer du ${formatDate(dueDate as Date)}${where} : ${daysOverdue} jours de retard`,
        link: { path: '/rents' },
      };
    });
}

/**
 * Diagnostics expirés : documents `diagnostic` dont `expiresAt` est strictement
 * dans le passé. Un document sans `expiresAt` n'expire jamais.
 */
function computeExpiredDiagnosticAlerts(params: {
  documents: Document[];
  now: Date;
}): DashboardAlert[] {
  const { documents, now } = params;

  return documents
    .map(document => ({ document, expiresAt: parseDate(document.expiresAt) }))
    .filter(
      ({ document, expiresAt }) =>
        document.type === 'diagnostic' && expiresAt !== null && expiresAt.getTime() < now.getTime()
    )
    .map(({ document, expiresAt }) => {
      const linkedToProperty =
        document.relatedEntityType === 'property' && document.relatedEntityId != null;
      return {
        id: `diagnostic-${document.id}`,
        severity: 'warning' as const,
        title: 'Diagnostic expiré',
        description: `« ${document.name} » a expiré le ${formatDate(expiresAt as Date)}`,
        link: linkedToProperty
          ? { path: `/properties/${document.relatedEntityId}` }
          : { path: '/documents' },
      };
    });
}

/**
 * Fins de bail : baux actifs dont la date de fin tombe dans les
 * `LEASE_EXPIRY_WINDOW_DAYS` prochains jours.
 */
function computeLeaseExpiryAlerts(params: {
  leases: Lease[];
  properties: Property[];
  now: Date;
}): DashboardAlert[] {
  const { leases, properties, now } = params;
  const windowEnd = now.getTime() + LEASE_EXPIRY_WINDOW_DAYS * DAY_MS;

  return leases
    .map(lease => ({ lease, endDate: parseDate(lease.endDate) }))
    .filter(({ lease, endDate }) => {
      if (lease.status !== 'active') return false;
      if (!endDate) return false;
      return endDate.getTime() >= now.getTime() && endDate.getTime() <= windowEnd;
    })
    .map(({ lease, endDate }) => {
      const daysLeft = Math.ceil(((endDate as Date).getTime() - now.getTime()) / DAY_MS);
      const propertyName = propertyNameForLease(lease, properties);
      const subject = propertyName ? `Le bail de ${propertyName}` : `Le bail #${lease.id}`;
      return {
        id: `lease-expiry-${lease.id}`,
        severity: 'warning' as const,
        title: 'Fin de bail proche',
        description: `${subject} se termine dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} (${formatDate(endDate as Date)})`,
        link: { path: `/leases/${lease.id}` },
      };
    });
}

/**
 * Calcule les alertes proactives du tableau de bord, ordonnées par sévérité :
 * impayés critiques, puis diagnostics expirés, puis fins de bail.
 */
export function computeDashboardAlerts(params: {
  leases: Lease[];
  properties: Property[];
  rents: Rent[];
  documents: Document[];
  now?: Date;
}): DashboardAlert[] {
  const now = params.now ?? new Date();
  const { leases, properties, rents, documents } = params;

  return [
    ...computeCriticalArrearsAlerts({ rents, leases, properties, now }),
    ...computeExpiredDiagnosticAlerts({ documents, now }),
    ...computeLeaseExpiryAlerts({ leases, properties, now }),
  ];
}
