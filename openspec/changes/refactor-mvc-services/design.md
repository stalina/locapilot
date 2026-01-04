## Context

Locapilot est une PWA offline-first (Vue 3 + Pinia + Dexie). Aujourd’hui, certaines vues contiennent :

- accès DB (Dexie)
- règles métiers (calculs, agrégations, normalisations)
- logique d’orchestration (export/import, sync)

Objectif: améliorer la séparation des couches sans changer le comportement.

## Goals / Non-Goals

Goals:

- Vues limitées à l’affichage + UI state + navigation.
- Logique métier dans des services nommés et testés.
- Accès Dexie encapsulé (repositories).
- Stores Pinia = orchestration (actions), pas de calculs complexes.
- Zéro régression (tests comme garde-fou).

Non-Goals:

- Changer les routes, écrans, ou le design.
- Introduire un backend.

## Decisions

### 1) Layering cible (MVC adapté à Vue)

- **Views (V)**
  - lisent l’état (store/computed)
  - déclenchent des actions (store)
  - font la navigation
  - n’accèdent jamais à `db` et ne calculent pas de règles métiers.

- **Stores Pinia (C)**
  - orchestrent les cas d’usage (load, create/update, export/import)
  - gèrent l’état UI/async (loading/error)
  - appellent des services métier.

- **Services métier (M)**
  - fonctions pures quand possible (calculs, normalisations)
  - “use-cases” quand nécessaire (plusieurs repos)
  - testés en priorité.

- **Repositories**
  - encapsulent Dexie et les requêtes (where/between/bulkGet/transactions)
  - exposent une API typed stable
  - testés (fake-indexeddb) ou via tests d’intégration ciblés.

### 2) Organisation des dossiers

- Feature-scoped:
  - `src/features/<feature>/services/*Service.ts`
  - `src/features/<feature>/repositories/*Repository.ts`

- Shared:
  - `src/shared/services/*`
  - `src/shared/utils/*` (purs)

### 3) Stratégie anti-régression

- Geler le comportement existant par des tests unitaires ciblés sur les calculs extraits.
- Conserver les tests E2E comme garde-fou.
- Refacto par petits PRs/étapes (feature par feature).

## Risks / Trade-offs

- Risque: changer involontairement des formats (dates, tri) → mitigation: tests snapshot/attendus.
- Risque: coupler services à Dexie → mitigation: repositories derrière interfaces.

## Migration Plan

1. Ajouter la couche repository/service sans toucher l’UI.
2. Déplacer progressivement la logique depuis les vues.
3. Mettre à jour tests au fur et à mesure.
4. Supprimer duplications/code mort seulement en fin.

## Open Questions

- Souhaites-tu que le “Controller” soit uniquement les stores Pinia (recommandé ici), ou veux-tu introduire des “use-case” classes en plus ?
- Préférence pour la localisation des repositories: `@/db/repositories` (transverse) vs par feature ?
