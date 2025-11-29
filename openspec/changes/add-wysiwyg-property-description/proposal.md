# Change: Ajout d'un éditeur WYSIWYG pour la description des propriétés

## Why

Actuellement, la description des propriétés est un simple champ texte (`textarea`) qui ne permet pas de mise en forme. Les utilisateurs ont besoin de pouvoir structurer et mettre en forme les descriptions (titres, listes, gras, italique, liens) pour présenter leurs biens de manière professionnelle et lisible.

## What Changes

- Remplacement du champ `textarea` par un éditeur WYSIWYG riche
- Stockage du contenu au format HTML dans le champ `description` existant
- Ajout d'une dépendance pour l'éditeur (TipTap recommandé pour Vue 3)
- Affichage du HTML formaté dans la vue détail de la propriété
- Sanitisation du HTML pour éviter les failles XSS

## Impact

- **Affected specs**: `core-infrastructure` (ajout de dépendance et composant UI)
- **Affected code**:
  - `src/features/properties/components/PropertyFormModal.vue` (remplacement textarea)
  - `src/features/properties/views/PropertyDetailView.vue` (affichage HTML)
  - `package.json` (nouvelle dépendance)
- **Breaking changes**: Aucun (backward compatible - les descriptions texte existantes restent valides)
- **Migration**: Aucune migration nécessaire, les descriptions existantes s'affichent comme du texte brut
