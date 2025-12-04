# Change: add-charges-adjustment-table

## Why

Les gestionnaires ont besoin d'un tableau de régularisation des charges sur la vue détail d'un bail pour suivre annuellement les charges réelles, provisions et la régularisation à effectuer.

## What Changes

- Ajouter une nouvelle table `chargesAdjustments` en base pour stocker les lignes annuelles et les colonnes personnalisées.
- Ajouter un composant `ChargesAdjustmentTable.vue` réutilisable.
- Intégrer le composant dans la vue `LeaseDetailView.vue` sous les informations financières.
- Ajouter des actions dans le store `leasesStore` pour charger et sauvegarder les lignes.
- Ajouter une popin pour ajouter dynamiquement des colonnes de charges personnalisées.

## Impact

- Affected specs: `specs/leases/spec.md`
- Affected code: `src/db/schema.ts`, `src/features/leases/stores/leasesStore.ts`, `src/features/leases/components/ChargesAdjustmentTable.vue`, `src/features/leases/views/LeaseDetailView.vue`.

BREAKING: non
