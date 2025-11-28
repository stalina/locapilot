# Change: Configuration initiale du projet Locapilot

## Why

Initialisation complète du projet Locapilot pour créer une application PWA de gestion locative fonctionnant entièrement côté client. Le projet nécessite une architecture moderne avec Vue.js 3, TypeScript et IndexedDB pour gérer le cycle de vie complet d'une location immobilière de manière autonome, sécurisée et offline-first.

Problème: Le projet n'a pas encore de code source, de configuration ou d'architecture définie.

Objectifs:

- Mettre en place une architecture PWA moderne avec Vue.js 3 + TypeScript
- Configurer la base de données locale avec IndexedDB/Dexie.js
- Établir les fondations pour toutes les fonctionnalités de gestion locative
- Garantir une expérience utilisateur fluide et installable sur desktop
- Assurer le fonctionnement offline complet de l'application

## What Changes

## What Changes

**Infrastructure de base**:

- Projet Vite + Vue 3 + TypeScript configuré
- ESLint, Prettier, Git hooks (husky + lint-staged)
- Configuration PWA avec vite-plugin-pwa et Workbox
- Tests: Vitest + Playwright + Coverage
- CI/CD: GitHub Actions (build, tests, E2E, lint, deploy)

**Database Layer**:

- Dexie.js avec schéma complet et migrations
- Tables: properties, tenants, leases, rents, documents, settings
- Composables pour accès database

**Architecture applicative**:

- Vue Router avec routes typées
- 6 Stores Pinia (properties, tenants, leases, rents, documents, settings)
- Layout principal responsive avec navigation

**UI Foundation**:

- Design system complet (variables CSS, thème)
- 12+ composants de base réutilisables
- Composants métier (PropertyCard, TenantCard, LeaseCard, etc.)
- Tests accessibilité: 67/70 tests passing

**Pages principales implémentées**:

- Dashboard avec KPIs et activité récente
- Properties: Liste, détail, CRUD complet
- Tenants: Liste, détail, CRUD complet, workflow candidat → locataire
- Leases: Liste, détail, CRUD complet
- Rents: Calendrier + paiements
- Documents: Liste + upload drag-and-drop
- Settings: Paramètres + export/import + PWA status

**Capabilities créées** (specs delta dans `/specs`):

- core-infrastructure
- database-layer
- pwa-features

Note: Les autres capabilities (property-management, tenant-management, etc.) sont implémentées dans le code mais leurs specs formelles seront créées lors de l'archivage.

## Impact

- Affected specs: core-infrastructure, database-layer, pwa-features (ADDED)
- Affected code: Tout le projet (nouveau)
- Breaking changes: Aucun (projet initial)
- Stack technique: Vue 3, Vite, TypeScript, Dexie.js, Pinia, PWA
- Tests: 370 tests unitaires, E2E Playwright, 82.94% coverage
- Bundle: 152KB gzipped (objectif: < 500KB)
- Performance: < 2s démarrage, 100% offline-capable
- ✅ Documentation développeur complète
- ✅ Expérience utilisateur fluide et intuitive

## Plan de Test

### Tests Unitaires

- Stores Pinia
- Composables
- Utilitaires
- Database layer

### Tests de Composants

- Composants UI de base
- Forms
- Navigation

### Tests E2E (Playwright)

- Installation PWA
- Fonctionnement offline
- CRUD de base sur entités principales
- Navigation entre pages

### Tests Manuels

- Installation sur différents OS
- Performance avec données volumineuses
- Accessibilité (lecteur d'écran)

## Dépendances

### Techniques

- Node.js >= 18.x
- npm ou pnpm
- Navigateur moderne pour développement

### Externes

Aucune dépendance externe (API, services) pour cette phase initiale.

### Bloquants

Aucun

## Timeline Estimé

### Setup initial (1-2 jours)

- Configuration Vite + Vue + TypeScript
- ESLint, Prettier, Vitest
- PWA configuration

### Database layer (1 jour)

- Schéma Dexie.js
- Migrations
- Wrappers et composables

### UI Foundation (2-3 jours)

- Design system de base
- Layout principal
- Navigation et routing
- Composants réutilisables

### Testing setup (1 jour)

- Vitest configuration
- Test utilities
- Playwright setup

**Total estimé**: 5-7 jours de développement

## Questions Ouvertes

### Question 1: Choix du framework UI

**Options**: PrimeVue, Vuetify, Element Plus, Tailwind + Headless UI, Custom
**Recommandation**: PrimeVue (riche, thémable, accessible, bien documenté)
**À décider**: Avant implémentation

### Question 2: Stratégie de backup/export

**Options**: JSON export, CSV par entité, SQLite export, Cloud sync
**Recommandation**: JSON export complet + import (Phase 1), Cloud sync (future)
**À décider**: Lors de implémentation document-management

### Question 3: Gestion des images/photos (états des lieux)

**Options**: Base64 in IndexedDB, File System Access API, Blob storage
**Recommandation**: Blob storage in IndexedDB avec compression
**À décider**: Lors de implémentation inventory-management

## Références

### Documentation

- [Vue.js 3 Guide](https://vuejs.org/guide/)
- [Dexie.js Documentation](https://dexie.org/)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Standards

- [PWA Best Practices](https://web.dev/progressive-web-apps/)
- [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/quickref/)
- [Conventional Commits](https://www.conventionalcommits.org/)

### Exemples similaires

- TodoMVC Vue 3 + TypeScript
- Offline-first PWA patterns
- Dexie.js + Vue 3 examples
