# Project Context

## Purpose
Locapilot est une application de gestion de l'occupation d'appartements en location qui permet de suivre tout le cycle de vie d'une location de manière sécurisée et autonome, sans nécessiter de backend.

### Objectifs
- Gérer le cycle complet de location immobilière
- Fonctionner entièrement côté client de manière sécurisée
- Être installable comme application de bureau (PWA)
- Permettre un travail offline avec synchronisation des données
- Fournir une expérience utilisateur simple et intuitive

## Tech Stack
- **Frontend Framework**: Vue.js 3 (Composition API avec `<script setup>`)
- **Language**: TypeScript 100%
- **Build Tool**: Vite
- **PWA**: vite-plugin-pwa (workbox)
- **Database**: IndexedDB via Dexie.js
- **UI Components**: À définir (PrimeVue, Vuetify, ou custom)
- **Router**: Vue Router
- **State Management**: Pinia
- **Icons**: À définir
- **Date/Time**: day.js ou date-fns
- **PDF Generation**: jsPDF ou pdfmake (pour quittances, états des lieux)
- **File Upload/Storage**: API File System Access ou IndexedDB pour stockage des pièces justificatives

## Project Conventions

### Code Style
- **TypeScript strict mode** activé
- **ESLint** + **Prettier** pour le formatage
- **Naming conventions**:
  - Components: PascalCase (`PropertyCard.vue`)
  - Composables: camelCase avec préfixe `use` (`useTenants.ts`)
  - Stores: camelCase avec suffixe `Store` (`propertyStore.ts`)
  - Types/Interfaces: PascalCase (`interface Tenant {}`)
  - Constants: SCREAMING_SNAKE_CASE (`MAX_FILE_SIZE`)
  - Functions: camelCase (`calculateRent()`)
- **File organization**:
  - Un composant par fichier
  - Grouper les fichiers par fonctionnalité (feature-based)
  - Tests à côté des fichiers source (`Component.vue` + `Component.spec.ts`)
- **CSS Architecture**:
  - Styles globaux centralisés dans `src/assets/styles/`
  - `views.css`: styles communs à toutes les vues (containers, headers, grids, filters, states)
  - `global.css`: variables CSS et styles de base
  - `variables.css`: variables de design system (couleurs, espacements, typographie)
  - Styles scoped dans les composants uniquement pour styles spécifiques non réutilisables
  - Éviter la duplication de styles entre composants

### Architecture Patterns
- **Architecture**: Frontend-only, pas de backend
- **Data Layer**: 
  - Dexie.js pour accès IndexedDB
  - Stores Pinia pour état applicatif
  - Composables pour logique réutilisable
- **Component Structure**:
  - Composition API avec `<script setup>`
  - Props avec TypeScript et validation
  - Emits typés
  - Slots documentés
- **View Structure** (standardisée):
  - Toutes les vues principales suivent la même structure HTML:
    ```vue
    <div class="view-container {feature}-view">
      <header class="view-header">
        <div>
          <h1>Titre</h1>
          <div class="header-meta">Métadonnées</div>
        </div>
        <div class="header-actions">Boutons d'action</div>
      </header>
      <div class="stats-grid">StatCards (4 colonnes responsive)</div>
      <div class="filters">Filtres de recherche</div>
      <div class="{feature}-grid">Grille de contenus (3 colonnes responsive)</div>
    </div>
    ```
  - Container max-width: 1400px uniforme
  - Padding: 32px constant
  - Stats grid: 4 colonnes (auto-responsive)
  - Content grid: 3 colonnes avec minmax(320px, 1fr)
  - Gap: 24px partout
  - Classes spécifiques: `.properties-grid`, `.tenants-grid`, `.leases-grid`, etc.
- **Routing**: Vue Router avec routes typées
- **Form Handling**: Validation côté client avec règles métier
- **Error Handling**: Gestion d'erreurs centralisée
- **Security**: 
  - Pas de données sensibles en clair
  - Chiffrement optionnel des données sensibles
  - Validation stricte des entrées

### Testing Strategy
- **Unit Tests**: Vitest pour composables et utilitaires
- **Component Tests**: @vue/test-utils + Vitest
- **E2E Tests**: Playwright (disponible via MCP)
- **Coverage**: Minimum 70% pour code métier critique
- **Test Organization**: Tests à côté des fichiers source

### Git Workflow
- **Branching**: GitFlow simplifié
  - `main`: production-ready
  - `develop`: intégration
  - `feature/*`: nouvelles fonctionnalités
  - `fix/*`: corrections de bugs
- **Commits**: Conventional Commits
  - `feat:` nouvelles fonctionnalités
  - `fix:` corrections de bugs
  - `docs:` documentation
  - `style:` formatage
  - `refactor:` refactoring
  - `test:` tests
  - `chore:` maintenance

## Domain Context

### Gestion Locative - Concepts Métier

**Cycle de vie d'une location**:
1. **Référencement**: Création de la fiche appartement avec caractéristiques
2. **Publication**: Annonces sur différentes plateformes
3. **Candidatures**: Gestion des candidats, pièces justificatives, visites
4. **Sélection**: Aide à la décision, acceptation/refus
5. **Bail**: Création et gestion du contrat de location
6. **États des lieux**: Entrée et sortie avec photos et descriptions
7. **Remise des clés**: Tracking de la remise
8. **Gestion courante**: Loyers, charges, quittances, avis d'échéance
9. **Fin de bail**: État des lieux de sortie, régularisation

**Entités principales**:
- **Propriété (Property)**: L'appartement ou la maison
- **Locataire (Tenant)**: La personne qui loue
- **Candidat (Applicant)**: Candidat potentiel à la location
- **Bail (Lease)**: Contrat de location
- **Loyer (Rent)**: Paiement mensuel
- **Charge (Expense)**: Charges locatives
- **État des lieux (Inventory)**: Document d'entrée/sortie
- **Quittance (Receipt)**: Reçu de paiement de loyer
- **Document**: Pièce justificative, contrat, photo, etc.
- **Visite (Visit)**: Rendez-vous de visite
- **Échange (Communication)**: Messages, emails, appels tracés

**Règles métier**:
- Un bail est lié à une propriété et un ou plusieurs locataires
- Les loyers sont générés automatiquement selon le bail
- Les charges sont provisionnées puis régularisées annuellement
- Les états des lieux doivent être contradictoires (signés)
- Les quittances ne peuvent être éditées qu'après paiement
- Les documents sont versionnés et horodatés

## Important Constraints

### Techniques
- **Pas de backend**: Toute la logique est côté client
- **Offline-first**: L'application doit fonctionner sans connexion
- **Sécurité**: Données utilisateur stockées localement, confidentialité garantie
- **Performance**: Démarrage rapide, interactions fluides
- **Multi-plateforme**: Installable sur macOS, Windows, Linux (PWA)
- **Taille**: Bundle optimisé, lazy loading des modules
- **Compatibilité**: Navigateurs modernes (Chrome, Firefox, Safari, Edge - 2 dernières versions)

### Fonctionnelles
- **RGPD**: Données personnelles, droit à l'oubli, export
- **Accessibilité**: Niveau WCAG AA minimum
- **i18n**: Support français par défaut, extensible
- **Backup**: Export/import des données pour sauvegarde
- **Intégrité**: Validation des données, prévention de la corruption

### Business
- **Usage personnel**: Pas de gestion multi-utilisateurs
- **Mono-tenant**: Un utilisateur = ses propriétés
- **Pas de SaaS**: Application autonome, pas d'abonnement

## External Dependencies

### Services potentiels (optionnels)
- **Sync cloud** (future): Dropbox, Google Drive pour backup
- **Email** (future): Envoi de quittances via service externe
- **Signature électronique** (future): Pour baux et états des lieux
- **Calendrier** (future): Synchronisation avec Google Calendar

### APIs utilisées
- **File System Access API**: Pour import/export de fichiers
- **Notification API**: Pour rappels d'échéances
- **Print API**: Pour impression de documents
- **Web Share API**: Pour partage de documents

### Dépendances NPM principales
- vue@^3.4.0
- vue-router@^4.3.0
- pinia@^2.1.0
- dexie@^4.0.0
- vite@^5.0.0
- @vite-plugin/pwa@^0.20.0
- typescript@^5.4.0
- vitest@^1.0.0
- playwright@^1.43.0
