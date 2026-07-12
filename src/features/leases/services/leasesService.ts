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

/**
 * Construit la mise à jour du bail marquant la réception du dépôt de garantie.
 * Lève une erreur si la date de réception est invalide.
 */
export function buildDepositReceptionUpdates(receivedDate: Date): Partial<Lease> {
  const date = receivedDate instanceof Date ? receivedDate : new Date(receivedDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error('La date de réception est invalide');
  }
  return { depositReceivedDate: date };
}

/**
 * Construit la mise à jour du bail enregistrant la restitution du dépôt de garantie.
 * Applique les règles métier :
 * - le dépôt doit d'abord avoir été marqué comme reçu ;
 * - la date de restitution doit être postérieure (ou égale) à la réception ;
 * - le montant restitué doit être compris entre 0 et le montant du dépôt.
 * Lève une erreur explicite (message affichable) si une règle est violée.
 */
export function buildDepositRestitutionUpdates(
  lease: Pick<Lease, 'deposit' | 'depositReceivedDate'>,
  returnedDate: Date,
  returnedAmount: number
): Partial<Lease> {
  if (!lease.depositReceivedDate) {
    throw new Error('Le dépôt doit d’abord être marqué comme reçu');
  }

  const date = returnedDate instanceof Date ? returnedDate : new Date(returnedDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error('La date de restitution est invalide');
  }

  const received = new Date(lease.depositReceivedDate);
  if (date.getTime() < received.getTime()) {
    throw new Error('La date de restitution doit être postérieure à la réception');
  }

  if (typeof returnedAmount !== 'number' || Number.isNaN(returnedAmount) || returnedAmount < 0) {
    throw new Error('Le montant restitué doit être positif');
  }
  if (returnedAmount > lease.deposit) {
    throw new Error('Le montant restitué ne peut pas dépasser le dépôt');
  }

  return { depositReturnedDate: date, depositReturnedAmount: returnedAmount };
}
