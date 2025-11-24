# Tasks - Configuration initiale du projet Locapilot

**Change ID**: `add-initial-project-setup`  
**Status**: Proposition

## Phase 1: Configuration de Base

### Infrastructure Projet
- [ ] Initialiser projet Vite + Vue 3 + TypeScript
- [ ] Configurer TypeScript (tsconfig.json strict mode)
- [ ] Installer et configurer ESLint + Prettier
- [ ] Configurer Git hooks (husky + lint-staged)
- [ ] Créer structure de dossiers du projet
- [ ] Configurer path aliases (@/, @components/, etc.)
- [ ] Ajouter .editorconfig

### PWA Configuration
- [ ] Installer @vite-plugin/pwa
- [ ] Configurer workbox pour offline-first
- [ ] Créer manifest.json (icônes, nom, couleurs)
- [ ] Configurer service worker
- [ ] Ajouter gestion des mises à jour PWA
- [ ] Tester installation desktop

### Dépendances NPM
- [ ] Installer Vue Router
- [ ] Installer Pinia
- [ ] Installer Dexie.js
- [ ] Installer day.js (date handling)
- [ ] Installer framework UI (décision: PrimeVue recommandé)
- [ ] Installer Vitest + @vue/test-utils
- [ ] Installer Playwright
- [ ] Installer utilitaires (zod pour validation, etc.)

## Phase 2: Database Layer

### Dexie.js Setup
- [ ] Créer fichier de schéma database (`src/db/schema.ts`)
- [ ] Définir version 1 du schéma avec toutes les tables
- [ ] Créer indexes pour queries fréquentes
- [ ] Implémenter système de migrations
- [ ] Créer wrapper/composable pour accès DB (`useDatabase.ts`)
- [ ] Ajouter error handling et logging

### Tables Initiales
- [ ] Table `properties` (propriétés)
- [ ] Table `tenants` (locataires)
- [ ] Table `applicants` (candidats)
- [ ] Table `leases` (baux)
- [ ] Table `rents` (loyers)
- [ ] Table `expenses` (charges)
- [ ] Table `documents` (documents)
- [ ] Table `inventories` (états des lieux)
- [ ] Table `communications` (échanges)
- [ ] Table `visits` (visites)
- [ ] Table `settings` (paramètres app)

### Tests Database
- [ ] Tests unitaires pour schéma
- [ ] Tests de migrations
- [ ] Tests CRUD pour chaque table
- [ ] Tests de relations entre tables

## Phase 3: Routing & Navigation

### Router Setup
- [ ] Configurer Vue Router avec TypeScript
- [ ] Créer routes principales
  - [ ] `/` - Dashboard
  - [ ] `/properties` - Liste propriétés
  - [ ] `/properties/:id` - Détail propriété
  - [ ] `/tenants` - Liste locataires
  - [ ] `/tenants/:id` - Détail locataire
  - [ ] `/leases` - Liste baux
  - [ ] `/leases/:id` - Détail bail
  - [ ] `/documents` - Gestion documents
  - [ ] `/settings` - Paramètres
- [ ] Créer navigation guards
- [ ] Gérer 404 et erreurs routing

### Layout Principal
- [ ] Créer composant Layout principal
- [ ] Sidebar/menu navigation
- [ ] Header avec titre et actions
- [ ] Footer (optionnel)
- [ ] Mobile responsive design

## Phase 4: State Management

### Pinia Stores
- [ ] Créer store principal (`useAppStore`)
- [ ] Store propriétés (`usePropertyStore`)
- [ ] Store locataires (`useTenantStore`)
- [ ] Store baux (`useLeaseStore`)
- [ ] Store loyers (`useRentStore`)
- [ ] Store documents (`useDocumentStore`)
- [ ] Store settings (`useSettingsStore`)

### Store Features
- [ ] Actions CRUD pour chaque store
- [ ] Getters computed
- [ ] Persistance sélective (settings)
- [ ] Intégration avec Dexie.js

### Tests Stores
- [ ] Tests unitaires pour chaque store
- [ ] Tests des actions
- [ ] Tests des getters

## Phase 5: UI Foundation

### Design System
- [ ] Configurer thème (couleurs, typography)
- [ ] Créer variables CSS/SCSS globales
- [ ] Design tokens (spacing, breakpoints, etc.)
- [ ] Mode sombre (optionnel pour phase 1)

### Composants de Base
- [ ] `BaseButton.vue`
- [ ] `BaseInput.vue`
- [ ] `BaseSelect.vue`
- [ ] `BaseCard.vue`
- [ ] `BaseModal.vue`
- [ ] `BaseTable.vue`
- [ ] `BasePagination.vue`
- [ ] `BaseSpinner.vue`
- [ ] `BaseAlert.vue`
- [ ] `EmptyState.vue`

### Composants Métier (Placeholder)
- [ ] `PropertyCard.vue`
- [ ] `TenantCard.vue`
- [ ] `LeaseCard.vue`
- [ ] `DocumentUpload.vue`
- [ ] `DatePicker.vue` (wrapper framework UI)

### Tests Composants
- [ ] Tests pour composants de base
- [ ] Tests accessibilité (a11y)

## Phase 6: Pages Principales (Structure)

### Dashboard
- [ ] Page Dashboard avec layout
- [ ] Sections placeholder pour widgets
- [ ] Navigation vers autres sections

### Properties
- [ ] Page liste propriétés
- [ ] Page création propriété (formulaire vide)
- [ ] Page détail propriété

### Tenants
- [ ] Page liste locataires
- [ ] Page création locataire (formulaire vide)
- [ ] Page détail locataire

### Settings
- [ ] Page paramètres généraux
- [ ] Export/Import données (placeholder)
- [ ] Gestion thème

## Phase 7: Utilitaires & Composables

### Composables
- [ ] `useDatabase.ts` - Accès DB
- [ ] `useNotification.ts` - Notifications toast
- [ ] `useConfirm.ts` - Dialogues confirmation
- [ ] `useFormatter.ts` - Formatage dates, nombres, devises
- [ ] `useValidation.ts` - Validation formulaires
- [ ] `useExport.ts` - Export données
- [ ] `useImport.ts` - Import données

### Utilitaires
- [ ] `dateUtils.ts` - Fonctions dates
- [ ] `fileUtils.ts` - Gestion fichiers
- [ ] `validationRules.ts` - Règles validation
- [ ] `formatters.ts` - Formatage valeurs
- [ ] `constants.ts` - Constantes app

### Tests Utilitaires
- [ ] Tests pour tous les utilitaires
- [ ] Tests pour composables

## Phase 8: Configuration Tests

### Vitest Setup
- [ ] Configurer vitest.config.ts
- [ ] Setup test utilities
- [ ] Mocks pour Dexie.js
- [ ] Mocks pour Router
- [ ] Coverage configuration

### Playwright Setup
- [ ] Configurer playwright.config.ts
- [ ] Créer test helpers
- [ ] Tests E2E basiques
  - [ ] Installation PWA
  - [ ] Navigation principale
  - [ ] Offline functionality

## Phase 9: Documentation

### README
- [ ] Description projet
- [ ] Instructions installation
- [ ] Instructions développement
- [ ] Architecture overview
- [ ] Stack technique

### Documentation Développeur
- [ ] Guide contribution
- [ ] Architecture decisions (ADR)
- [ ] Database schema documentation
- [ ] Component documentation (Storybook optionnel)
- [ ] API documentation (JSDoc/TSDoc)

### Documentation Utilisateur (Basique)
- [ ] Guide installation (PWA)
- [ ] Guide démarrage
- [ ] FAQ basique

## Phase 10: CI/CD & Qualité

### GitHub Actions
- [ ] Workflow build
- [ ] Workflow tests (unit + component)
- [ ] Workflow E2E (Playwright)
- [ ] Workflow lint
- [ ] Workflow type-check

### Quality Gates
- [ ] Pre-commit hooks (lint, format)
- [ ] Pre-push hooks (tests)
- [ ] Coverage thresholds
- [ ] Build size checks

### Déploiement
- [ ] Configuration pour static hosting (Netlify/Vercel/GitHub Pages)
- [ ] Auto-deploy sur main
- [ ] Preview deploys pour PRs

## Phase 11: Validation Finale

### Tests Fonctionnels
- [ ] Tester installation PWA sur macOS
- [ ] Tester installation PWA sur Windows
- [ ] Tester installation PWA sur Linux
- [ ] Tester mode offline complet
- [ ] Tester performance (Lighthouse)

### Qualité Code
- [ ] Review code complet
- [ ] Vérifier coverage tests > 70%
- [ ] Vérifier pas de TypeScript any
- [ ] Vérifier pas d'erreurs ESLint
- [ ] Vérifier bundle size < 500KB

### Documentation
- [ ] Vérifier README complet
- [ ] Vérifier specs OpenSpec à jour
- [ ] Vérifier commentaires code

### Critères Acceptance
- [ ] ✅ Application démarre en < 2 secondes
- [ ] ✅ Fonctionne 100% offline après install
- [ ] ✅ Score Lighthouse PWA > 90
- [ ] ✅ Bundle size < 500KB gzipped
- [ ] ✅ Tests coverage > 70%
- [ ] ✅ Installable sur 3 OS

## Notes d'Implémentation

### Ordre Recommandé
1. Infrastructure projet + dependencies
2. Database layer (fondation)
3. Routing basique
4. Pinia stores
5. UI foundation
6. Pages structure
7. Tests
8. Documentation
9. CI/CD
10. Validation

### Points d'Attention
- Toujours typer avec TypeScript (pas de `any`)
- Tester au fur et à mesure
- Documenter les décisions importantes
- Garder les composants petits et réutilisables
- Penser offline-first dès le début
- Valider l'accessibilité

### Décisions à Prendre Avant Implémentation
1. Framework UI: PrimeVue vs Vuetify vs autre ?
2. Gestion des icônes: Heroicons vs Material Icons vs autre ?
3. Hébergement: Netlify vs Vercel vs GitHub Pages ?
4. Storybook: Oui/Non pour cette phase ?
