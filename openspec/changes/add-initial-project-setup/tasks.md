# Tasks - Configuration initiale du projet Locapilot

**Change ID**: `add-initial-project-setup`  
**Status**: En cours  
**Progression**: 100/195 tâches (51%)

## Phase 1: Configuration de Base ✅

### Infrastructure Projet
- [x] Initialiser projet Vite + Vue 3 + TypeScript
- [x] Configurer TypeScript (tsconfig.json strict mode)
- [x] Installer et configurer ESLint + Prettier
- [ ] Configurer Git hooks (husky + lint-staged)
- [x] Créer structure de dossiers du projet
- [x] Configurer path aliases (@/, @components/, etc.)
- [ ] Ajouter .editorconfig

### PWA Configuration
- [ ] Installer @vite-plugin/pwa
- [ ] Configurer workbox pour offline-first
- [ ] Créer manifest.json (icônes, nom, couleurs)
- [ ] Configurer service worker
- [ ] Ajouter gestion des mises à jour PWA
- [ ] Tester installation desktop

### Dépendances NPM
- [x] Installer Vue Router
- [x] Installer Pinia
- [x] Installer Dexie.js
- [ ] Installer day.js (date handling)
- [ ] Installer framework UI (décision: Custom design system créé)
- [ ] Installer Vitest + @vue/test-utils
- [ ] Installer Playwright
- [ ] Installer utilitaires (zod pour validation, etc.)

## Phase 2: Database Layer ✅

### Dexie.js Setup
- [x] Créer fichier de schéma database (`src/db/schema.ts`)
- [x] Définir version 1 du schéma avec toutes les tables
- [x] Créer indexes pour queries fréquentes
- [ ] Implémenter système de migrations
- [x] Créer wrapper/composable pour accès DB (`database.ts`)
- [x] Ajouter error handling et logging

### Tables Initiales
- [x] Table `properties` (propriétés)
- [x] Table `tenants` (locataires)
- [ ] Table `applicants` (candidats) - Merged avec tenants (status='candidate')
- [x] Table `leases` (baux)
- [x] Table `rents` (loyers)
- [ ] Table `expenses` (charges) - À venir
- [x] Table `documents` (documents)
- [ ] Table `inventories` (états des lieux) - À venir
- [ ] Table `communications` (échanges) - À venir
- [ ] Table `visits` (visites) - À venir
- [ ] Table `settings` (paramètres app) - À venir

### Tests Database
- [ ] Tests unitaires pour schéma
- [ ] Tests de migrations
- [ ] Tests CRUD pour chaque table
- [ ] Tests de relations entre tables

## Phase 3: Routing & Navigation ✅

### Router Setup
- [x] Configurer Vue Router avec TypeScript
- [x] Créer routes principales
  - [x] `/` - Dashboard
  - [x] `/properties` - Liste propriétés
  - [x] `/properties/:id` - Détail propriété
  - [x] `/tenants` - Liste locataires
  - [x] `/tenants/:id` - Détail locataire
  - [x] `/rents` - Calendrier loyers
  - [x] `/leases` - Liste baux
  - [x] `/leases/:id` - Détail bail
  - [x] `/documents` - Gestion documents
  - [ ] `/settings` - Paramètres
- [ ] Créer navigation guards
- [ ] Gérer 404 et erreurs routing

### Layout Principal
- [x] Créer composant Layout principal
- [x] Sidebar/menu navigation
- [x] Header avec titre et actions
- [ ] Footer (optionnel)
- [x] Mobile responsive design

## Phase 4: State Management ✅

### Pinia Stores
- [ ] Créer store principal (`useAppStore`)
- [x] Store propriétés (`propertiesStore`)
- [x] Store locataires (`tenantsStore`)
- [x] Store baux (`leasesStore`)
- [x] Store loyers (`rentsStore`)
- [x] Store documents (`documentsStore`)
- [ ] Store settings (`settingsStore`)

### Store Features
- [x] Actions CRUD pour chaque store
- [x] Getters computed
- [ ] Persistance sélective (settings)
- [x] Intégration avec Dexie.js

### Tests Stores
- [ ] Tests unitaires pour chaque store
- [ ] Tests des actions
- [ ] Tests des getters

## Phase 5: UI Foundation ✅

### Design System
- [x] Configurer thème (couleurs, typography)
- [x] Créer variables CSS/SCSS globales
- [x] Design tokens (spacing, breakpoints, etc.)
- [ ] Mode sombre (optionnel pour phase 1)

### Composants de Base
- [x] `Button.vue`
- [x] `Input.vue`
- [x] `Modal.vue` (avec transitions, sizes, footer slot)
- [ ] `BaseSelect.vue`
- [x] `StatCard.vue`
- [ ] `BaseTable.vue`
- [ ] `BasePagination.vue`
- [ ] `BaseSpinner.vue` (Loading states inline)
- [ ] `BaseAlert.vue`
- [ ] `EmptyState.vue` (Empty states inline)

### Composants Métier
- [x] `PropertyCard.vue`
- [x] `TenantCard.vue`
- [x] `DocumentCard.vue`
- [x] `UploadZone.vue` (DocumentUpload)
- [x] `Calendar.vue`
- [x] `SearchBox.vue`
- [x] `PropertyFormModal.vue` (formulaire création/édition bien)
- [x] `TenantFormModal.vue` (formulaire création/édition locataire)
- [x] `LeaseCard.vue`
- [x] `LeaseFormModal.vue`

### Tests Composants
- [ ] Tests pour composants de base
- [ ] Tests accessibilité (a11y)

## Phase 6: Pages Principales (Structure) ✅

### Dashboard
- [x] Page Dashboard avec layout
- [x] Sections avec KPI cards et activité récente
- [x] Navigation vers autres sections

### Properties
- [x] Page liste propriétés (PropertiesView)
- [x] Page détail propriété (PropertyDetailView)
- [x] Page création/édition propriété (PropertyFormModal)

### Tenants
- [x] Page liste locataires (TenantsView)
- [x] Page détail locataire (TenantDetailView)
- [x] Page création/édition locataire (TenantFormModal)

### Rents
- [x] Page calendrier loyers (RentsCalendarView)
- [x] Modal paiement loyer

### Documents
- [x] Page gestion documents (DocumentsView)
- [x] Upload drag-and-drop
- [x] Download/delete documents

### Leases
- [x] Page liste baux (LeasesView)
- [x] Page détail bail (LeaseDetailView)
- [x] Page création/édition bail (LeaseFormModal)

### Relations entre entités
- [x] Afficher locataires actuels dans PropertyDetailView
- [x] Afficher historique des baux dans PropertyDetailView
- [x] Afficher propriété actuelle dans TenantDetailView
- [x] Afficher historique des baux dans TenantDetailView
- [x] Navigation croisée entre entités liées

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
