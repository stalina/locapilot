export function defaultAnnonceTemplate(): string {
  return `Particulier loue propriété

Montant du loyer : {LOYER} € / mois.
Montant des charges : {CHARGES} € / mois (provisions sur charges mensuelles et donnant lieu à une régularisation annuelle).
Dépôt de garantie : {GARANTIE} € (1 mois de loyer).
Les premiers contacts seront réalisés par email


Cordialement,

`;
}

export function formatAnnoncePlaceholders(
  template: string,
  values: { LOYER?: number; CHARGES?: number; GARANTIE?: number }
) {
  const nf = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (n?: number) => (typeof n === 'number' ? nf.format(n) : nf.format(0));
  return template
    .replaceAll('{LOYER}', fmt(values.LOYER))
    .replaceAll('{CHARGES}', fmt(values.CHARGES))
    .replaceAll('{GARANTIE}', fmt(values.GARANTIE));
}
