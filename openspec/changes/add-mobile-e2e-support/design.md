# Design: Mobile E2E Support Fixes

## Context

Le but est d'ajouter un projet Playwright mobile et d'assurer que les flux critiques restent utilisables en petit écran sans casser le comportement desktop.

## Changes

- Ajustements CSS/HTML pour corriger les overlay/sidebar qui interceptent les clics sur mobile.
  - `AppLayout.vue`: overlay z-index augmenté; fermer la sidebar met `pointer-events: none` ; lorsque `.sidebar.open` -> `pointer-events: auto`.
- Styles mobiles pour conserver les actions principales visibles et accessibles (quick-actions sticky / fixed bottom bar) dans `src/assets/styles/views.css`.
- Tests E2E: `e2e/properties.spec.ts` et `e2e/tenants.spec.ts` rendus robustes pour mobile (ouvre menu si nécessaire, `scrollIntoViewIfNeeded`, fallback DOM click, selecteurs tag-agnostiques).

## Rationale

- Les éléments hors viewport (sidebar, overlays) peuvent encore intercepter les événements pointer; `pointer-events` protège contre ce comportement sur mobile.
- Garder l'UX identique entre desktop et mobile sans dupliquer la logique côté JS.

## Risks

- Changement CSS minimal, ciblé. Impact limité au layout du `AppLayout` et aux règles `.quick-actions`.
- Aucun changement de logique métier (les loyers virtuels restent non persistés tant qu'un utilisateur ne convertit pas via le flux "Payer").

## Migration

- Aucune migration de données nécessaire.

## Open Questions

- Souhaitez-vous que les loyers virtuels soient automatiquement persistés par un job périodique (changement de comportement) ou rester à la demande ? (actuellement: à la demande)
