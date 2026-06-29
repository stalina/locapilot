# ADR 0004 — PWA installable avec Service Worker (Workbox)

- **Statut** : Accepté
- **Date** : 2026-06-29

## Contexte

Locapilot doit être utilisable **hors ligne** et offrir une expérience proche
d'une application native (installation sur l'écran d'accueil, lancement en
plein écran), tout en restant une application web déployée statiquement
([ADR 0001](./0001-offline-first-indexeddb.md)). Les données sont déjà locales
(IndexedDB) ; il reste à garantir que **l'application elle-même** (assets JS/CSS,
icônes, polices) soit disponible sans réseau.

## Décision

Faire de Locapilot une **Progressive Web App** à l'aide de
**`vite-plugin-pwa`** (qui s'appuie sur **Workbox**), configuré dans
[`vite.config.ts`](../../vite.config.ts) :

- `registerType: 'autoUpdate'` — le Service Worker se met à jour automatiquement
  quand un nouveau build est déployé ;
- **pré-cache** des assets via
  `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']`, avec
  `cleanupOutdatedCaches: true` et `clientsClaim: true` ;
- un **manifest** (`display: standalone`, `start_url: /locapilot/`, thème,
  icônes) rendant l'app installable ;
- un composant [`PWAUpdatePrompt.vue`](../../src/shared/components/PWAUpdatePrompt.vue)
  branché sur `virtual:pwa-register/vue` qui invite l'utilisateur à recharger
  lorsqu'une nouvelle version est prête (`onNeedRefresh`).

En développement, le Service Worker est désactivé par défaut et activable via
`ENABLE_PWA_IN_DEV=1`. Le `base path` est `/locapilot/` en production.

## Alternatives envisagées

- **Service Worker écrit à la main** — rejeté : gestion manuelle du cache,
  versionnement et invalidation sont coûteux et sources de bugs ; Workbox les
  industrialise.
- **`registerType: 'prompt'`** — écarté au profit de `autoUpdate` pour
  simplifier le cycle de mise à jour, tout en gardant une invitation explicite à
  recharger via `PWAUpdatePrompt`.
- **Application native / wrapper (Capacitor, Electron)** — rejeté : surcoût de
  build et de distribution disproportionné par rapport au besoin ; la PWA couvre
  desktop et mobile.

## Conséquences

### Positives

- Application **installable** et **lançable hors ligne** sur desktop et mobile.
- Mises à jour automatiques avec invitation utilisateur à recharger.
- Configuration concise, déléguée à Workbox.

### Négatives / compromis

- Le pré-cache `autoUpdate` peut servir une version légèrement obsolète jusqu'au
  prochain rechargement ; atténué par le prompt de mise à jour.
- Le débogage en environnement de dev nécessite d'activer explicitement le SW
  (`ENABLE_PWA_IN_DEV`), ce qui peut surprendre.
- Le `base path` `/locapilot/` doit rester cohérent entre manifest, `scope` et
  routing.

## Références

- [`vite.config.ts`](../../vite.config.ts) — configuration `VitePWA` / Workbox
- [`src/shared/components/PWAUpdatePrompt.vue`](../../src/shared/components/PWAUpdatePrompt.vue)
- [`src/main.ts`](../../src/main.ts) — initialisation de l'app
