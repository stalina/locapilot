import type { Document, Lease, Property, Rent } from '@/db/types';
import { LEASE_EXPIRY_WINDOW_DAYS } from '@/features/leases/services/leasesService';
import {
  DEFAULT_REMINDER_THRESHOLDS,
  type ReminderThresholdConfig,
} from '@/features/settings/stores/settingsStore';

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

/**
 * Dérive le seuil (en jours) au-delà duquel un impayé devient critique à
 * partir des seuils de relance configurés dans les paramètres — même source
 * unique que les courriers de relance :
 * - le palier « mise en demeure » activé, s'il existe ;
 * - sinon le palier activé le plus élevé ;
 * - à défaut (aucun palier activé), le palier le plus élevé des valeurs par défaut.
 */
export function resolveCriticalArrearsDays(thresholds: ReminderThresholdConfig[]): number {
  const miseEnDemeure = thresholds.find(t => t.level === 'mise-en-demeure' && t.enabled);
  if (miseEnDemeure) return miseEnDemeure.days;

  const enabledDays = thresholds.filter(t => t.enabled).map(t => t.days);
  if (enabledDays.length > 0) return Math.max(...enabledDays);

  return Math.max(...DEFAULT_REMINDER_THRESHOLDS.map(t => t.days));
}

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
 * Impayés critiques : loyers `late` ou `partial` dont le retard atteint le
 * seuil critique dérivé des seuils de relance configurés
 * (`criticalArrearsDays`). Même sémantique que les relances : `daysLate >= seuil`
 * avec un nombre de jours entier (voir `remindersService.computePendingReminders`).
 */
function computeCriticalArrearsAlerts(params: {
  rents: Rent[];
  leases: Lease[];
  properties: Property[];
  criticalArrearsDays: number;
  now: Date;
}): DashboardAlert[] {
  const { rents, leases, properties, criticalArrearsDays, now } = params;

  return rents
    .map(rent => ({ rent, dueDate: parseDate(rent.dueDate) }))
    .filter(({ rent, dueDate }) => {
      if (rent.status !== 'late' && rent.status !== 'partial') return false;
      if (!dueDate) return false;
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / DAY_MS);
      return daysOverdue >= criticalArrearsDays;
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
 *
 * `criticalArrearsDays` est le seuil critique d'impayé (en jours), à dériver
 * des seuils de relance configurés via {@link resolveCriticalArrearsDays} —
 * la fonction reste pure, l'appelant fait le lien avec le store des paramètres.
 */
export function computeDashboardAlerts(params: {
  leases: Lease[];
  properties: Property[];
  rents: Rent[];
  documents: Document[];
  criticalArrearsDays: number;
  now?: Date;
}): DashboardAlert[] {
  const now = params.now ?? new Date();
  const { leases, properties, rents, documents, criticalArrearsDays } = params;

  return [
    ...computeCriticalArrearsAlerts({ rents, leases, properties, criticalArrearsDays, now }),
    ...computeExpiredDiagnosticAlerts({ documents, now }),
    ...computeLeaseExpiryAlerts({ leases, properties, now }),
  ];
}
