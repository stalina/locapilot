import type { IrlIndex, Lease } from '@/db/types';

export type Quarter = 1 | 2 | 3 | 4;

/**
 * Trimestre (1-4) d'une date donnée.
 */
export function quarterOf(date: Date | string): Quarter {
  const month = new Date(date).getMonth(); // 0-11
  return (Math.floor(month / 3) + 1) as Quarter;
}

/**
 * Libellé d'un trimestre, ex: "T2 2024".
 */
export function quarterLabel(quarter: Quarter, year: number): string {
  return `T${quarter} ${year}`;
}

/**
 * Date anniversaire du bail pour une année donnée (même jour/mois que la date
 * de début du bail).
 */
export function anniversaryDate(startDate: Date | string, year: number): Date {
  const start = new Date(startDate);
  return new Date(year, start.getMonth(), start.getDate());
}

/**
 * Recherche la valeur d'IRL pour un trimestre et une année donnés.
 */
export function findIrl(indices: IrlIndex[], year: number, quarter: Quarter): IrlIndex | undefined {
  return indices.find(i => i.year === year && i.quarter === quarter);
}

/**
 * Calcule le loyer révisé selon la formule légale (IRL INSEE) :
 *   nouveau loyer = ancien loyer × (IRL trimestre courant / IRL même trimestre année précédente)
 * Le résultat est arrondi à 2 décimales (au centime).
 */
export function computeIndexedRent(
  oldRent: number,
  currentIrl: number,
  previousIrl: number
): number {
  if (!previousIrl) return oldRent;
  return Math.round(((oldRent * currentIrl) / previousIrl) * 100) / 100;
}

export interface RentRevisionProposal {
  leaseId: number;
  year: number;
  anniversaryDate: Date;
  effectiveDate: Date;
  referenceQuarter: Quarter;
  oldRent: number;
  newRent: number;
  currentIrl: number;
  previousIrl: number;
  charges: number;
}

export interface BuildProposalResult {
  /** Proposition complète quand les deux IRL nécessaires sont disponibles. */
  proposal: RentRevisionProposal | null;
  /** Trimestre de référence dérivé de la date de début du bail. */
  referenceQuarter: Quarter;
  anniversaryDate: Date;
  /** Indices manquants empêchant le calcul (libellés lisibles). */
  missingIndices: string[];
}

/**
 * Construit la proposition de révision pour un bail à la date anniversaire d'une
 * année donnée. Le trimestre de référence est dérivé du trimestre de signature
 * (date de début) du bail. Retourne les indices manquants si le calcul est
 * impossible.
 */
export function buildRevisionProposal(params: {
  lease: Lease;
  indices: IrlIndex[];
  year: number;
}): BuildProposalResult {
  const { lease, indices, year } = params;
  const referenceQuarter = quarterOf(lease.startDate);
  const anniversary = anniversaryDate(lease.startDate, year);

  const current = findIrl(indices, year, referenceQuarter);
  const previous = findIrl(indices, year - 1, referenceQuarter);

  const missingIndices: string[] = [];
  if (!current) missingIndices.push(quarterLabel(referenceQuarter, year));
  if (!previous) missingIndices.push(quarterLabel(referenceQuarter, year - 1));

  if (!current || !previous) {
    return { proposal: null, referenceQuarter, anniversaryDate: anniversary, missingIndices };
  }

  const newRent = computeIndexedRent(lease.rent, current.value, previous.value);

  return {
    proposal: {
      leaseId: lease.id as number,
      year,
      anniversaryDate: anniversary,
      effectiveDate: anniversary,
      referenceQuarter,
      oldRent: lease.rent,
      newRent,
      currentIrl: current.value,
      previousIrl: previous.value,
      charges: lease.charges,
    },
    referenceQuarter,
    anniversaryDate: anniversary,
    missingIndices,
  };
}

/**
 * Détermine si une révision est due pour ce bail à la date de référence :
 * le bail est actif, a commencé il y a au moins un an, et la date anniversaire
 * de l'année courante est passée.
 */
export function isRevisionDue(lease: Lease, referenceDate: Date = new Date()): boolean {
  if (lease.status !== 'active') return false;
  const start = new Date(lease.startDate);
  const refYear = referenceDate.getFullYear();
  // Au moins une année écoulée depuis le début du bail
  if (start >= anniversaryDate(lease.startDate, refYear)) return false;
  const anniversary = anniversaryDate(lease.startDate, refYear);
  return referenceDate >= anniversary;
}

/**
 * Année de révision la plus pertinente à proposer (année de la dernière date
 * anniversaire atteinte).
 */
export function currentRevisionYear(lease: Lease, referenceDate: Date = new Date()): number {
  const refYear = referenceDate.getFullYear();
  const anniversary = anniversaryDate(lease.startDate, refYear);
  return referenceDate >= anniversary ? refYear : refYear - 1;
}
