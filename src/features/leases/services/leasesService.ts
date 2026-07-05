import type { Lease } from '@/db/types';

/**
 * Fenêtre (en jours) d'anticipation des fins de bail — point de déclaration
 * unique, partagé entre le getter `expiringLeases` du store des baux et les
 * alertes proactives du tableau de bord.
 */
export const LEASE_EXPIRY_WINDOW_DAYS = 30;

export function buildTerminationUpdates(now = new Date()): Partial<Lease> {
  return {
    status: 'ended',
    endDate: now,
  };
}
