import type { InventoryRoom, InventoryRoomItem } from '@/db/types';

/**
 * Modèles pré-remplis d'états des lieux (issue #46).
 *
 * Chaque pièce standard est livrée avec la liste des éléments à inspecter.
 * Lors de l'application d'un modèle, chaque élément est initialisé à l'état
 * « good » (bon état) que l'utilisateur ajuste ensuite.
 */

/** Éléments communs présents dans (quasiment) toutes les pièces. */
const COMMON_ITEMS = ['Murs', 'Sol', 'Plafond', 'Plinthes', 'Porte', 'Fenêtres', 'Éclairage'];

/** Catalogue des pièces standard et de leurs éléments à inspecter. */
export const STANDARD_ROOM_TEMPLATES: Record<string, string[]> = {
  Entrée: [...COMMON_ITEMS, 'Interphone', 'Placard'],
  Séjour: [...COMMON_ITEMS, 'Prises électriques', 'Volets'],
  Cuisine: [
    ...COMMON_ITEMS,
    'Plan de travail',
    'Évier',
    'Robinetterie',
    'Meubles hauts et bas',
    'Plaque de cuisson',
    'Hotte',
    'Réfrigérateur',
  ],
  Chambre: [...COMMON_ITEMS, 'Placard', 'Volets', 'Prises électriques'],
  'Salle de bain': [
    ...COMMON_ITEMS,
    'Baignoire / Douche',
    'Lavabo',
    'Robinetterie',
    'Meuble vasque',
    'Miroir',
    'VMC / Ventilation',
  ],
  WC: [
    'Murs',
    'Sol',
    'Plafond',
    'Porte',
    'Cuvette',
    "Chasse d'eau",
    'Lave-mains',
    'VMC / Ventilation',
  ],
};

/**
 * Modèle par défaut appliqué lors de la création d'un état des lieux pour un
 * logement standard (T2 type). L'utilisateur peut ajouter/supprimer des pièces.
 */
export const DEFAULT_TEMPLATE_ROOMS = [
  'Entrée',
  'Séjour',
  'Cuisine',
  'Chambre',
  'Salle de bain',
  'WC',
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
