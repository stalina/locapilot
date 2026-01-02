## ADDED Requirements

### Requirement: Dashboard
Le systme DOIT fournir une vue "Tableau de bord" qui prsente un rsum oprationnel des proprits, loyers et vnements.

#### Scenario: Affichage des statistiques
- **WHEN** l'utilisateur accde  la route '/'
- **THEN** la page affiche les cartes de statistiques: total proprits, taux d'occupation, revenus mensuels et loyers en attente

#### Scenario: Chargement des donnes depuis la base locale
- **WHEN** la vue est monte
- **THEN** les valeurs des cartes sont charges depuis IndexedDB (tables: properties, rents)

#### Scenario: Activit rcente et vnements
- **WHEN** la vue est monte
- **THEN** la page affiche une liste d'activits rcentes et une liste d'vnements  venir (peuvent .editorconfig .git .github .gitignore .husky .prettierrc.json .vscode CONTRIBUTING.md README.md e2e eslint.config.js index.html mockups openspec package-lock.json package.json playwright.config.ts public src tsconfig.app.json tsconfig.json tsconfig.node.json tsconfig.test.json vite.config.ts vitest.config.ts vitest.shims.d.ts tre mockes si non disponibles)

#### Scenario: Rutilisation des styles
- **WHEN** la fonctionnalit est implmente
- **THEN** elle utilise les styles globaux dfinis dans src/shared/styles/views.css et les composants partags (StatCard, Button, Badge)
