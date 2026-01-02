# Change: add-mobile-e2e-support

## Why

L'application doit fonctionner en mode mobile avec les mêmes fonctionnalités que sur desktop. Les tests E2E doivent valider le fonctionnement mobile. Ce changement ajoute un projet Playwright mobile, rend les tests résilients au menu mobile, et documente le travail.

## What Changes

- Ajout d'un projet Playwright `chromium-mobile` utilisant le device `Pixel 5`.
- Adaptation des specs E2E pour ouvrir le menu mobile si nécessaire.
- Ajout de la proposition et de tâches openspec.

## Impact

- Affected specs: E2E tests
- Affected code: `playwright.config.ts`, `e2e/*.spec.ts`, `openspec/changes/add-mobile-e2e-support/`
