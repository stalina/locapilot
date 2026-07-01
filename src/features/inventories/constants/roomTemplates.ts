import type { InventoryRoom, InventoryRoomItem } from '@/db/types';

/**
 * Modèles pré-remplis d'états des lieux (issue #46).
 *
 * Le contenu est calqué sur un constat d'état des lieux entrant réel
 * (appartement T2) : pièces et éléments inspectés, dans le même ordre que le
 * document de référence. Lors de l'application d'un modèle, chaque élément est
 * initialisé à l'état « good » (bon état) que l'utilisateur ajuste ensuite.
 *
 * Sections (dans l'ordre) : relevé des compteurs, liste des clés, boîte aux
 * lettres / annexes, accès / entrée, cuisine + séjour, salle de bains, chambre,
 * balcon.
 */

/** Éléments communs présents dans (quasiment) toutes les pièces. */
const COMMON_ITEMS = [
  'Murs',
  'Sol',
  'Plafond',
  'Plinthes',
  'Porte',
  'Fenêtres',
  'Interrupteurs',
  'Prises électriques',
  'Éclairage plafond',
];

/** Catalogue des pièces / sections standard et de leurs éléments à inspecter. */
export const STANDARD_ROOM_TEMPLATES: Record<string, string[]> = {
  'Relevé des compteurs': [
    'Compteur eau',
    'Compteur gaz',
    'Compteur électricité',
    'Détecteur de fumée',
  ],
  'Liste des clés': [
    'Clé entrée logement',
    'Clé boîte aux lettres',
    'Boîtier parking',
    'Badge porte',
    'Code porte',
  ],
  'Boîte aux lettres / annexes': [
    'Boîte aux lettres',
    'Serrure boîte aux lettres',
    'Parking intérieur',
  ],
  'Accès / entrée': [
    'Murs',
    'Sol',
    'Plafond',
    'Plinthes',
    'Porte palière',
    'Plaque / poignée',
    'Judas',
    'Serrure',
    'Sonnette',
    'Portier audio / vidéo',
    'Interrupteurs',
    'Prises électriques',
    'Éclairage plafond',
    'Tableau électrique',
    "Thermostat d'ambiance",
    'Armoire / penderie',
  ],
  'Cuisine + séjour': [
    'Murs',
    'Sol',
    'Plafond',
    'Plinthes',
    'Crédence murale',
    'Porte-fenêtre',
    'Vitrages',
    'Interrupteurs',
    'Prises électriques',
    'Prises RJ45',
    'Éclairages plafond',
    'Évier',
    'Robinetterie',
    'Vidage',
    'Siphon',
    'Meuble sous évier',
    'Plan de travail',
    'Éléments bas',
    'Éléments hauts',
    'Robinet machine à laver',
    'Radiateur',
    'Ventilation VMC',
    'Plaque de cuisson',
    'Four',
    'Hotte aspirante',
  ],
  'Salle de bains': [
    'Murs',
    'Faïence murale / crédence',
    'Sol',
    'Plafond',
    'Plinthes',
    'Porte',
    'Plaque / poignée',
    'Serrure',
    'Interrupteur',
    'Prises électriques',
    'Éclairage mural',
    'Éclairage plafond',
    'Lavabo / vasque',
    'Robinetterie lavabo',
    'Vidage',
    'Siphon',
    'Bac douche',
    'Robinetterie douche',
    'Flexible',
    'Douchette',
    'Vidage / siphon douche',
    'Rideau de douche',
    'Bloc WC',
    "Chasse d'eau",
    'Cuvette',
    'Abattant',
    'Chauffage (sèche-serviette)',
    'Ventilation VMC',
    'Meuble sous vasque',
    'Miroir',
  ],
  Chambre: [
    'Murs',
    'Sol',
    'Plafond',
    'Plinthes',
    'Porte',
    'Plaque / poignée',
    'Serrure',
    'Porte-fenêtre',
    'Vitrages',
    'Volet',
    'Interrupteurs',
    'Prises électriques',
    'Prise RJ45',
    'Éclairage plafond',
    'Radiateur',
  ],
  Balcon: ['Murs', 'Sol', 'Garde-corps'],
};

/**
 * Modèle par défaut appliqué lors de la création d'un état des lieux pour un
 * logement standard (T2 type), dans l'ordre du document de référence.
 * L'utilisateur peut ajouter/supprimer des pièces.
 */
export const DEFAULT_TEMPLATE_ROOMS = [
  'Relevé des compteurs',
  'Liste des clés',
  'Boîte aux lettres / annexes',
  'Accès / entrée',
  'Cuisine + séjour',
  'Salle de bains',
  'Chambre',
  'Balcon',
];

/** Construit la liste des éléments d'une pièce, tous initialisés à « good ». */
export function buildRoomItems(roomName: string): InventoryRoomItem[] {
  const labels = STANDARD_ROOM_TEMPLATES[roomName] ?? COMMON_ITEMS;
  return labels.map(label => ({ label, condition: 'good' as const }));
}

/**
 * Construit un état des lieux pré-rempli à partir d'une liste de noms de pièces.
 * Par défaut, applique le modèle standard.
 */
export function buildTemplateRooms(roomNames: string[] = DEFAULT_TEMPLATE_ROOMS): InventoryRoom[] {
  return roomNames.map(name => ({ name, items: buildRoomItems(name) }));
}
