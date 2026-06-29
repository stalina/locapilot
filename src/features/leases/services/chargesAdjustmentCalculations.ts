import type { ChargesAdjustmentRow } from '@/db/types';

/**
 * Régularisation des charges — pure calculation helpers.
 *
 * Modèle de saisie « Total + détail optionnel » :
 * - Le bailleur saisit un total de charges réelles annuelles (`annualCharges`).
 * - Il peut, en option, détailler ce total en colonnes nommées (`customCharges`,
 *   ex : Eau, Chauffage). Dès qu'au moins une colonne de détail existe, c'est la
 *   somme des colonnes qui fait foi (le total devient calculé, non saisi).
 * - La régularisation = provision de charges payée − total des charges réelles.
 *   Un résultat positif = trop-perçu à rembourser au locataire ;
 *   un résultat négatif = complément dû par le locataire.
 */

type CustomChargesSource = Pick<ChargesAdjustmentRow, 'customCharges'>;
type TotalChargesSource = Pick<ChargesAdjustmentRow, 'customCharges' | 'annualCharges'>;
type RegulationSource = TotalChargesSource & Pick<ChargesAdjustmentRow, 'chargesProvisionPaid'>;

/** Somme des colonnes de détail (`customCharges`). */
export function computeCustomTotal(row: CustomChargesSource): number {
  if (!row.customCharges) return 0;
  return Object.values(row.customCharges).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

/**
 * Total des charges réelles de l'année.
 * @param hasBreakdown - vrai si un détail en colonnes est utilisé pour ce bail.
 *   Si vrai, le total = somme des colonnes ; sinon, le total saisi (`annualCharges`).
 */
export function computeTotalCharges(row: TotalChargesSource, hasBreakdown: boolean): number {
  return hasBreakdown ? computeCustomTotal(row) : Number(row.annualCharges) || 0;
}

/**
 * Régularisation = provision payée − total des charges réelles.
 * Positif : trop-perçu (remboursement). Négatif : complément dû par le locataire.
 */
export function computeRegulation(row: RegulationSource, hasBreakdown: boolean): number {
  return (Number(row.chargesProvisionPaid) || 0) - computeTotalCharges(row, hasBreakdown);
}
