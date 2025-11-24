# Proposition: Configuration initiale du projet Locapilot

**Change ID**: `add-initial-project-setup`  
**Date**: 24 novembre 2025  
**Status**: Proposition  
**Auteur**: Assistant IA

## Résumé

Initialisation complète du projet Locapilot, une application PWA de gestion locative fonctionnant entièrement côté client avec Vue.js 3, TypeScript, et IndexedDB. Cette proposition établit l'architecture de base, la structure du projet, et les capacités fondamentales nécessaires pour démarrer le développement.

## Contexte et Motivation

### Problème
Actuellement, le projet Locapilot n'existe que comme structure OpenSpec vide. Il n'y a pas de code source, pas de configuration, et pas d'architecture définie.

### Besoin
Nous avons besoin d'initialiser un projet complet qui permette de gérer le cycle de vie d'une location immobilière de manière autonome, sécurisée et offline-first.

### Objectifs
1. Mettre en place une architecture PWA moderne avec Vue.js 3 + TypeScript
2. Configurer la base de données locale avec IndexedDB/Dexie.js
3. Établir les fondations pour toutes les fonctionnalités de gestion locative
4. Garantir une expérience utilisateur fluide et installable sur desktop
5. Assurer le fonctionnement offline complet de l'application

## Solution Proposée

### Approche Technique
- **Stack**: Vue 3 + Vite + TypeScript + Dexie.js + PWA
- **Architecture**: Frontend-only, sans backend
- **Storage**: IndexedDB pour données structurées, File System Access API pour documents
- **Build**: Vite avec optimisations PWA
- **Déploiement**: Application statique installable (PWA)

### Capabilities à créer
Cette proposition initialise les capacités suivantes (voir specs détaillées dans `/specs`):

1. **core-infrastructure** - Infrastructure de base du projet
2. **database-layer** - Couche de données avec Dexie.js
3. **property-management** - Gestion des propriétés/appartements
4. **tenant-management** - Gestion des locataires et candidats
5. **lease-management** - Gestion des baux
6. **rent-management** - Gestion des loyers et paiements
7. **document-management** - Gestion des documents et pièces justificatives
8. **inventory-management** - États des lieux entrée/sortie
9. **communication-tracking** - Traçage des échanges
10. **dashboard** - Tableau de bord récapitulatif
11. **pwa-features** - Fonctionnalités PWA (offline, install, notifications)

### Phasage
**Phase 1 - Fondations (cette proposition)**:
- Infrastructure de base (Vite, TypeScript, ESLint, Prettier)
- Configuration PWA
- Base de données Dexie.js avec schéma initial
- Router et navigation de base
- Store Pinia setup
- Design system de base

**Phases futures** (propositions séparées):
- Phase 2: Gestion des propriétés et référencement
- Phase 3: Candidatures et processus de sélection
- Phase 4: Baux et états des lieux
- Phase 5: Gestion financière (loyers, charges, quittances)
- Phase 6: Dashboard et reporting
- Phase 7: Améliorations UX et optimisations

## Impact

### Composants Affectés
- **Nouveaux**: Tous (projet vierge)
- **Modifiés**: Aucun
- **Supprimés**: Aucun

### APIs
**Nouvelles APIs**:
- Database API (Dexie.js wrapper)
- Router configuration
- Store modules (Pinia)
- Composables de base

### Data Model
Schéma de base de données initial (voir `database-layer/spec.md` pour détails):
- Properties (propriétés)
- Tenants (locataires)
- Applicants (candidats)
- Leases (baux)
- Rents (loyers)
- Documents (documents)
- Inventories (états des lieux)
- Communications (échanges)
- Settings (paramètres)

### Breaking Changes
Aucun (projet initial)

### Compatibilité
- **Navigateurs cibles**: Chrome, Firefox, Safari, Edge (2 dernières versions)
- **OS**: macOS, Windows, Linux (via PWA)
- **Mobile**: Support navigateur mobile (iOS Safari, Chrome Android)

## Alternatives Considérées

### Alternative 1: Backend + API REST
**Rejeté**: Complexité accrue, nécessite hébergement, ne fonctionne pas offline

### Alternative 2: Electron au lieu de PWA
**Rejeté**: Plus lourd, déploiement complexe, updates difficiles, PWA suffit

### Alternative 3: React au lieu de Vue
**Rejeté**: Vue.js est plus simple, meilleure DX, écosystème riche

### Alternative 4: LocalStorage au lieu d'IndexedDB
**Rejeté**: Limites de taille, pas de queries complexes, pas de transactions

## Risques et Mitigation

### Risque 1: Limites d'IndexedDB
- **Impact**: Moyen
- **Probabilité**: Faible
- **Mitigation**: Dexie.js abstraction, export/backup régulier, gestion d'erreurs

### Risque 2: Compatibilité PWA sur tous OS
- **Impact**: Moyen
- **Probabilité**: Moyen
- **Mitigation**: Tests cross-platform, fallback gracieux, documentation

### Risque 3: Perte de données locales
- **Impact**: Élevé
- **Probabilité**: Faible
- **Mitigation**: Export/import, backup cloud optionnel (future), validation

### Risque 4: Performance avec gros volumes
- **Impact**: Moyen
- **Probabilité**: Faible
- **Mitigation**: Pagination, lazy loading, indexation optimale, archivage

## Critères de Succès

### Mesurables
- ✅ Application démarre en < 2 secondes
- ✅ Fonctionne 100% offline après installation
- ✅ Score Lighthouse PWA > 90
- ✅ Bundle size < 500KB (gzipped)
- ✅ Tests passent avec coverage > 70%
- ✅ Installable sur macOS, Windows, Linux

### Qualitatifs
- ✅ Code TypeScript 100% typé
- ✅ Interface responsive et accessible (WCAG AA)
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
