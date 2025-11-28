# Change: Amélioration de l'affichage des photos de logement

## Why

Les photos de logement sont maintenant stockées dans IndexedDB mais ne sont visibles que sur la page de détail. Pour une meilleure expérience utilisateur, les photos principales doivent être visibles partout où un logement est représenté, et les documents photos doivent avoir des aperçus visuels.

## What Changes

- **Vignettes de logement** : Affichage de la photo principale sur toutes les représentations visuelles (cards, listes)
- **Documents** : Aperçu visuel des photos dans la liste des documents
- **Baux** : Photo principale du logement affichée sur les vignettes de bail
- **Filtrage** : Filtre par type "image/photo" dans la vue Documents

## Impact

- Affected specs: `database-layer`
- Affected code:
  - `src/features/documents/views/DocumentsView.vue` (filtre + aperçu)
  - `src/shared/components/LeaseCard.vue` (si existe) ou composant équivalent
  - Composables existants déjà en place (`usePropertyPhotos`)

## Technical Details

- Réutilisation du composable `usePropertyPhotos` existant
- Optimisation : cache des URLs de photos pour éviter les rechargements
- Gestion mémoire : révocation des blob URLs après usage
