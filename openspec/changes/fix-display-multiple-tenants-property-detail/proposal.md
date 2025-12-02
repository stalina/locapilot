# Change: Afficher plusieurs locataires dans PropertyDetailView

## Why

Actuellement la vue détaillée d'une propriété affiche le(s) locataire(s) actuel(s) en se basant sur le bail "actif" lié à la propriété. Dans certains cas, une propriété peut avoir plusieurs baux actifs (par ex. plusieurs colocataires chacun avec un bail séparé ou plusieurs entrées de bail historiques marquées actives). La vue doit afficher tous les locataires liés à la propriété.

## What Changes

- Modifier `src/features/properties/views/PropertyDetailView.vue` pour agréger tous les baux affectés à la propriété et afficher l'ensemble des locataires référencés par ces baux.
- S'assurer que les IDs de locataires (`tenantIds`) multiples sont correctement résolus via `tenantsStore` et affichés dans une liste (avec navigation vers le détail locataire).
- Ajouter une spécification delta sous `openspec/changes/fix-display-multiple-tenants-property-detail/specs/properties/spec.md`.

## Impact

- Affected code: `src/features/properties/views/PropertyDetailView.vue`, tests unitaires liés aux vues propriétés/leases, éventuellement `leasesStore` lecture (aucun changement prévu dans la DB schema).
- No DB migration required.
