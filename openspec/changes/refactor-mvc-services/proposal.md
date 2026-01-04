# Change: Refactorisation MVC (services métier + zéro régression)

## Why

Aujourd’hui, plusieurs vues contiennent des règles métiers, des calculs et parfois des accès directs à IndexedDB (Dexie). Cela brouille les responsabilités, rend la réutilisation difficile, et fragilise la qualité (tests) et l’évolutivité.

Exemples observés (non exhaustifs) :

- Dashboard: calculs de stats + agrégation multi-tables directement dans la vue.
- Settings: export/import (conversion Blob/base64, lecture/écriture multi-tables) dans la vue.
- Tenant detail: calcul d’âge, mapping statut→UI, lecture `tenantAudits` via `db` dans la vue.

## What Changes

- **Architecture**: appliquer une séparation stricte des responsabilités de type MVC adaptée à Vue/Pinia.
  - **View (V)**: affichage + interactions UI + navigation; aucune règle métier, aucun accès DB.
  - **Controller/State (C)**: stores Pinia orchestrateurs (chargement, actions, états, erreurs) ; ils appellent des services.
  - **Model (M)**: services métier (purs ou quasi-purs) + repositories (accès Dexie), testés.

- **Extraction**: déplacer progressivement la logique métier/calculs des vues vers des services nommés et réutilisables.

- **Déduplication**: centraliser les utilitaires transverses (dates, formatage, mapping statuts, filtres/tri communs).

- **Tests**:
  - renforcer les tests unitaires des services et des stores
  - conserver/étendre les tests E2E existants comme garde-fou anti-régression.

- **Aucune régression fonctionnelle/UX**: mêmes écrans, mêmes flux, mêmes données.

## Impact

- Affected specs:
  - `core-infrastructure` (contraintes d’architecture / layering)

- Affected code (prévisionnel):
  - vues: `src/features/**/views/*.vue`
  - stores: `src/features/**/stores/*.ts`
  - nouveaux services/repositories: `src/features/**/services/`, `src/shared/services/`
  - utilitaires: `src/shared/utils/`
  - tests: `src/features/**/**/*.spec.ts`, `e2e/*.spec.ts`

## Non-Goals

- Modifier l’UX, ajouter des fonctionnalités, ou changer le modèle de données.
- Refondre le design system.

## Rollout / Safety

Refactorisation incrémentale par feature avec garde-fous :

- baseline des tests (unit + e2e)
- ajout/ajustement de tests ciblés pour figer le comportement
- extraction vers services/repositories
- refacto des vues pour ne plus contenir que UI + appels store
- suppression du code mort uniquement après stabilisation
