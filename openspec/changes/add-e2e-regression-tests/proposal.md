# Change: add-e2e-regression-tests

## Why

Après une montée de version, nous voulons garantir l'absence de régressions pour les fonctionnalités critiques de l'application.

## What Changes

- Ajout d'une suite de tests E2E Playwright couvrant: propriétés, locataires, baux, loyers, documents, inventaires et paramètres.
- Ajout d'un guide utilisateur openspec décrivant les scénarios couverts.
- Script npm `e2e` pour lancer les tests.

## Impact

- Affected specs: UI flows for properties, tenants, leases, rents, documents, inventories, settings
- Affected code: e2e tests, openspec docs, package.json scripts
