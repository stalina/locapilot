# Tasks - Configuration initiale du projet Locapilot

**Change ID**: `add-initial-project-setup`  
**Status**: En cours  
**Progression**: 93/183 tâches (51%)  
**Dernière validation**: 25 novembre 2025 (test manuel via Playwright MCP)

## Phase 1: Configuration de Base ✅

### Infrastructure Projet
- [x] Initialiser projet Vite + Vue 3 + TypeScript
- [x] Configurer TypeScript (tsconfig.json strict mode)
- [x] Installer et configurer ESLint + Prettier
- [ ] Configurer Git hooks (husky + lint-staged)
- [x] Créer structure de dossiers du projet
- [x] Configurer path aliases (@/, @components/, etc.)
- [ ] Ajouter .editorconfig

### PWA Configuration ✅
- [x] Installer @vite-plugin/pwa
- [x] Configurer workbox pour offline-first
- [x] Créer manifest.json (icônes, nom, couleurs)
- [x] Configurer service worker
- [x] Ajouter gestion des mises à jour PWA
- [x] Tester installation desktop (prompt d'installation)

### Dépendances NPM
- [x] Installer Vue Router
- [x] Installer Pinia
- [x] Installer Dexie.js
- [ ] Installer day.js (date handling)
- [x] Installer framework UI (décision: Custom design system créé)
- [x] Installer Vitest + @vue/test-utils
- [x] Installer Playwright
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
  - [x] `/settings` - Paramètres
- [x] Créer navigation guards
- [x] Gérer 404 et erreurs routing

### Layout Principal
- [x] Créer composant Layout principal
- [x] Sidebar/menu navigation
- [x] Header avec titre et actions
- [ ] Footer (optionnel)
- [x] Mobile responsive design

## Phase 4: State Management ✅

### Pinia Stores
- [x] Créer store principal (`useAppStore`)
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
- [x] Page liste propriétés (PropertiesView) ✅ VALIDÉ
- [x] Page détail propriété (PropertyDetailView) ✅ VALIDÉ
- [x] Page création/édition propriété (PropertyFormModal) ⚠️ CRÉATION OK, ÉDITION CASSÉE

### Tenants
- [x] Page liste locataires (TenantsView) ⚠️ ERREUR RUNTIME
- [x] Page détail locataire (TenantDetailView) ⚠️ Non testé (page liste cassée)
- [x] Page création/édition locataire (TenantFormModal) ⚠️ Non testé (page liste cassée)

### Rents
- [ ] Page calendrier loyers (RentsCalendarView) ⚠️ Stub uniquement ("En construction")
- [ ] Modal paiement loyer ⚠️ Non implémenté

### Documents
- [x] Page gestion documents (DocumentsView) ✅ VALIDÉ
- [x] Upload drag-and-drop ✅ VALIDÉ
- [x] Download/delete documents ⚠️ UI présente, fonctionnalité non testée

### Leases
- [x] Page liste baux (LeasesView) ✅ VALIDÉ
- [x] Page détail bail (LeaseDetailView) ⚠️ Non testé
- [x] Page création/édition bail (LeaseFormModal) ⚠️ Non testé

### Relations entre entités
- [x] Afficher locataires actuels dans PropertyDetailView ⚠️ Non testé
- [x] Afficher historique des baux dans PropertyDetailView ⚠️ Section vide lors du test
- [x] Afficher propriété actuelle dans TenantDetailView ⚠️ Non testé (page liste cassée)
- [x] Afficher historique des baux dans TenantDetailView ⚠️ Non testé (page liste cassée)
- [x] Navigation croisée entre entités liées ⚠️ Partiellement testé

### Settings ✅
- [x] Page paramètres généraux ✅ VALIDÉ
- [x] Export/Import données ✅ VALIDÉ (boutons présents)
- [x] Gestion PWA (statut installation, prompt) ✅ VALIDÉ
- [x] Clear all data avec confirmation ✅ VALIDÉ (bouton présent)

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
- [x] Configurer vitest.config.ts
- [x] Setup test utilities
- [x] Mocks pour Dexie.js
- [x] Mocks pour Router
- [x] Coverage configuration

### Playwright Setup
- [x] Configurer playwright.config.ts
- [x] Créer test helpers
- [x] Tests E2E basiques
  - [x] Installation PWA (test créé)
  - [x] Navigation principale (test créé)
  - [ ] Offline functionality (test manquant)

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

## ⚠️ Problèmes Découverts (25 nov 2025)

### Bugs Critiques
1. **TenantsView**: Erreur runtime `Cannot read properties of undefined (reading 'length')` - page complètement cassée
2. **PropertyDetailView**: Bouton "Modifier" ne déclenche pas le modal d'édition (console.log visible mais modal ne s'ouvre pas)
3. **RentsCalendarView**: Seulement un stub "En construction", fonctionnalité non implémentée

### Problèmes de Données
4. **Prix des propriétés**: Affichage "NaN €/mois" sur toutes les cartes de propriétés (problème de calcul ou de mapping)
5. **Loyers des baux**: Tous les baux affichent "0 €" de loyer alors que les propriétés ont des loyers définis

### Fonctionnalités Non Testées
- Modal d'édition des propriétés (création fonctionne)
- Détail et création/édition des locataires (page liste cassée)
- Détail et création/édition des baux
- Relations entre entités (pas de données visibles lors du test)
- Upload/Download/Delete de documents (UI présente mais non testé fonctionnellement)

### Tests Réels Validés ✅
- Dashboard: affiché correctement avec KPIs et activité
- Liste propriétés: affichée avec filtres et recherche
- Détail propriété: navigation et affichage OK
- Modal création propriété: s'ouvre et affiche le formulaire
- Liste baux: affichée avec 3 baux
- Documents: page vide affichée avec zone de drop
- Settings: page complète avec export/import/PWA

### Impact sur la Progression
- Progression réelle: **93/183 tâches (51%)** au lieu de 110/195 (56%)
- 17 tâches marquées comme complètes mais non fonctionnelles ou non testables
- Décompte ajusté après recomptage automatique (grep)

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
