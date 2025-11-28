# Change: Ajout du support des photos aux états des lieux

## Why

Les états des lieux nécessitent souvent des preuves photographiques pour documenter l'état des biens au moment de l'entrée et de la sortie des locataires. Actuellement, le champ `photos` existe dans `Inventory` et `InventoryItem` mais utilise des types incompatibles (`string[]` vs `number[]`) et n'est pas fonctionnel.

## What Changes

- **Harmonisation du type `photos`** : Utiliser `number[]` (IDs de documents) de manière cohérente
- **Interface utilisateur** : Ajouter une galerie de photos par pièce/item dans les états des lieux
- **Composable réutilisable** : Créer `useInventoryPhotos` basé sur `usePropertyPhotos`
- **Vue inventaires** : Interface pour ajouter/gérer les photos lors de la création/modification d'un état des lieux

## Impact

- Affected specs: `database-layer`
- Affected code:
  - `src/db/schema.ts` (correction du type `Inventory.photos`)
  - `src/features/inventories/` (nouveaux composants et composables)
  - Réutilisation de `PhotoGallery` et `usePropertyPhotos` comme base

## Technical Details

- Migration DB v3 : Harmoniser le type `photos` dans `Inventory`
- Les photos sont stockées comme documents avec `relatedEntityType: 'inventory'`
- Chaque `InventoryItem` peut avoir ses propres photos (par pièce/équipement)
- Export/Import : Les photos d'inventaire sont automatiquement incluses via le système existant
