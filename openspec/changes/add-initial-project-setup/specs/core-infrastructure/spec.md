# Capability: Core Infrastructure

**Domain**: Infrastructure  
**Owner**: Platform Team  
**Status**: Active

## Overview

Infrastructure de base du projet Locapilot incluant la configuration du build tool (Vite), le framework frontend (Vue.js 3), TypeScript, le routing, le state management, et les outils de qualité code (linting, formatting, testing).

## ADDED Requirements

### Requirement: REQ-CORE-001: Configuration Vite + Vue 3 + TypeScript

**Priority**: Critical  
**Status**: Active

The application MUST être configurée avec Vite comme build tool, Vue.js 3 comme framework frontend, et TypeScript en mode strict pour garantir la sécurité des types.

**Details**:
- Vite ^5.0.0 comme dev server et bundler
- Vue.js ^3.4.0 avec Composition API
- TypeScript ^5.4.0 en mode strict
- Support HMR (Hot Module Replacement)
- Path aliases configurés (@/, @components/, @features/, etc.)
- Build optimisé avec code splitting et tree shaking

**Acceptance Criteria**:
- Application démarre avec `npm run dev` en < 2 secondes
- HMR fonctionne sans rafraîchissement complet
- Build production optimisé < 500KB gzipped
- TypeScript strict mode activé sans erreurs
- Tous les path aliases résolus correctement

#### Scenario: Démarrage de l'application en développement

**Given**: Le projet est cloné et les dépendances installées  
**When**: L'utilisateur exécute `npm run dev`  
**Then**: 
- L'application démarre en moins de 2 secondes
- Le dev server est accessible sur http://localhost:5173
- Les modifications de code déclenchent le HMR
- Aucune erreur TypeScript n'est affichée

#### Scenario: Build de production

**Given**: Le code de l'application est prêt  
**When**: L'utilisateur exécute `npm run build`  
**Then**:
- Le build se termine sans erreurs
- Les assets sont générés dans le dossier `dist/`
- Le bundle JavaScript principal est < 500KB gzipped
- Les assets sont optimisés (minifiés, hashed)

---

### Requirement: REQ-CORE-002: Vue Router Configuration

**Priority**: Critical  
**Status**: Active

The application MUST utiliser Vue Router pour la navigation entre les différentes pages de l'application avec support du routing typé et lazy loading.

**Details**:
- Vue Router ^4.3.0
- Routes typées avec TypeScript
- Lazy loading des composants de page
- Navigation guards pour validation
- Support du mode history
- 404 handling

**Acceptance Criteria**:
- Routes principales configurées (dashboard, properties, tenants, etc.)
- Navigation fonctionne sans rechargement de page
- Routes lazy-loadées (code splitting automatique)
- URLs sont propres (pas de #)
- Page 404 pour routes invalides

#### Scenario: Navigation entre pages

**Given**: L'application est démarrée  
**When**: L'utilisateur clique sur un lien de navigation  
**Then**:
- La nouvelle page s'affiche sans rechargement complet
- L'URL du navigateur est mise à jour
- Le titre de la page est mis à jour
- La navigation précédente/suivante du navigateur fonctionne

#### Scenario: Accès à une route invalide

**Given**: L'application est démarrée  
**When**: L'utilisateur accède à `/route-qui-nexiste-pas`  
**Then**:
- Une page 404 personnalisée s'affiche
- Un lien permet de retourner à l'accueil
- Aucune erreur console n'est générée

---

### Requirement: REQ-CORE-003: Pinia State Management

**Priority**: Critical  
**Status**: Active

The application MUST utiliser Pinia comme solution de state management avec stores typés et intégration Devtools.

**Details**:
- Pinia ^2.1.0
- Stores modulaires par domaine (properties, tenants, leases, etc.)
- TypeScript types pour tous les stores
- Devtools integration
- Actions asynchrones pour DB operations
- Getters computed pour queries dérivées

**Acceptance Criteria**:
- Au moins un store fonctionnel (app store)
- Actions et getters typés
- State réactif dans les composants
- Devtools affichent l'état et les actions
- Tests unitaires pour stores disponibles

#### Scenario: Utilisation d'un store dans un composant

**Given**: Un store `usePropertyStore` est défini  
**When**: Un composant utilise le store via `const propertyStore = usePropertyStore()`  
**Then**:
- Le state du store est accessible et réactif
- Les actions du store peuvent être appelées
- Les getters retournent des valeurs computed
- Les changements de state déclenchent le re-render du composant

#### Scenario: Inspection du state avec Vue Devtools

**Given**: L'application est en mode développement  
**When**: L'utilisateur ouvre Vue Devtools  
**Then**:
- Tous les stores sont visibles dans l'onglet Pinia
- Le state actuel de chaque store est affiché
- L'historique des actions est visible
- Le state peut être modifié directement pour debug

---

### Requirement: REQ-CORE-004: ESLint et Prettier Configuration

**Priority**: High  
**Status**: Active

The project MUST avoir ESLint et Prettier configurés pour assurer la qualité et la consistance du code.

**Details**:
- ESLint avec règles Vue.js et TypeScript
- Prettier pour formatage automatique
- Integration avec VS Code
- Pre-commit hooks avec Husky et lint-staged
- Scripts npm pour linting et formatting

**Acceptance Criteria**:
- ESLint détecte les erreurs de code
- Prettier formate automatiquement à la sauvegarde
- Pre-commit hook empêche commit de code non conforme
- Tous les fichiers passent le lint sans erreurs
- Configuration partagée et versionée

#### Scenario: Sauvegarde d'un fichier avec erreurs de format

**Given**: Un fichier TypeScript avec formatage incorrect  
**When**: L'utilisateur sauvegarde le fichier dans VS Code  
**Then**:
- Prettier reformate automatiquement le fichier
- Les indentations sont corrigées
- Les espaces et sauts de ligne sont normalisés
- Le fichier est conforme au style guide

#### Scenario: Tentative de commit avec code non conforme

**Given**: Des fichiers modifiés contiennent des erreurs ESLint  
**When**: L'utilisateur tente de commit avec `git commit`  
**Then**:
- Le pre-commit hook s'exécute
- ESLint détecte les erreurs
- Le commit est bloqué
- Un message indique les erreurs à corriger

---

### Requirement: REQ-CORE-005: Structure de Dossiers

**Priority**: High  
**Status**: Active

The project MUST avoir une structure de dossiers claire, scalable et organisée par feature.

**Details**:
```
src/
├── features/           # Features métier
│   ├── properties/
│   ├── tenants/
│   ├── leases/
│   └── ...
├── core/              # Core app (router, layouts, etc.)
├── db/                # Database layer
├── shared/            # Shared utilities, components, types
├── assets/            # Static assets
└── App.vue
```

**Acceptance Criteria**:
- Structure respecte les conventions documentées
- Imports utilisent les path aliases
- Pas de dépendances circulaires
- Tests colocalisés avec le code source
- README documente la structure

#### Scenario: Ajout d'une nouvelle feature

**Given**: Une nouvelle fonctionnalité doit être ajoutée  
**When**: Le développeur crée un nouveau dossier dans `features/`  
**Then**:
- Le dossier contient components/, composables/, store/, types/, views/
- Les imports utilisent @features/nom-feature/...
- Les tests sont dans le même dossier
- La structure est cohérente avec les autres features

---

### Requirement: REQ-CORE-006: Vitest Test Infrastructure

**Priority**: High  
**Status**: Active

The project MUST avoir Vitest configuré pour les tests unitaires et de composants avec bonne couverture de code.

**Details**:
- Vitest ^1.0.0 comme test runner
- @vue/test-utils pour tests de composants
- Coverage avec c8/istanbul
- Test utilities réutilisables
- Mocks pour Router, Stores, Database

**Acceptance Criteria**:
- Tests s'exécutent avec `npm test`
- Coverage report généré
- Tests unitaires pour utils et composables
- Tests de composants pour UI
- Minimum 70% de coverage

#### Scenario: Exécution des tests

**Given**: Des tests sont écrits pour le code  
**When**: L'utilisateur exécute `npm test`  
**Then**:
- Tous les tests s'exécutent
- Les résultats sont affichés (passed/failed)
- Le rapport de coverage est généré
- Les tests échouent si coverage < 70%

#### Scenario: Test d'un composant Vue

**Given**: Un composant `PropertyCard.vue` existe  
**When**: Un test monte le composant avec des props  
**Then**:
- Le composant se rend correctement
- Les props sont affichées
- Les événements peuvent être testés
- Le snapshot peut être comparé

---

### Requirement: REQ-CORE-007: TypeScript Configuration Stricte

**Priority**: Critical  
**Status**: Active

TypeScript MUST be configured in strict mode to maximize type safety and code quality.

**Details**:
- `strict: true` dans tsconfig.json
- `noImplicitAny: true`
- `strictNullChecks: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- Types pour tous les modules tiers

**Acceptance Criteria**:
- Aucune erreur TypeScript à la compilation
- Pas de `any` non justifié
- Tous les fichiers `.ts` et `.vue` sont typés
- Autocomplétion fonctionne partout
- Types pour Dexie, Router, Pinia, etc.

#### Scenario: Développement avec autocomplétion

**Given**: Un développeur écrit du code TypeScript  
**When**: Il tape un nom de variable ou fonction  
**Then**:
- L'IDE propose l'autocomplétion
- Les types des paramètres sont affichés
- Les erreurs de type sont soulignées en temps réel
- La documentation JSDoc est accessible

---

### Requirement: REQ-CORE-008: Scripts NPM

**Priority**: Medium  
**Status**: Active

The project MUST avoir des scripts NPM clairs et documentés pour toutes les tâches courantes.

**Details**:
Scripts requis:
- `dev`: Démarrer dev server
- `build`: Build production
- `preview`: Preview build production
- `test`: Run tests
- `test:coverage`: Tests avec coverage
- `lint`: Lint code
- `format`: Format code avec Prettier
- `type-check`: Vérification TypeScript

**Acceptance Criteria**:
- Tous les scripts fonctionnent
- Scripts documentés dans README
- Pas d'erreurs à l'exécution
- Output clair et informatif

#### Scenario: Exécution du script de build

**Given**: Le projet est prêt pour production  
**When**: L'utilisateur exécute `npm run build`  
**Then**:
- Le build se termine avec succès
- Les fichiers sont dans `dist/`
- Un message indique la taille des bundles
- Le temps de build est affiché

---

## Dependencies

**Internal**:
- Aucune (première capability)

**External**:
- Node.js >= 18.x
- npm ou pnpm

## Risks

- **Migration Vue 2 → Vue 3**: N/A (nouveau projet)
- **Breaking changes Vite**: Suivre les releases, locked versions
- **TypeScript overhead**: Formation équipe, documentation

## Performance Targets

- Dev server start: < 2s
- HMR update: < 100ms
- Build time: < 30s
- Bundle size: < 500KB gzipped

## Security

- Dependabot activé pour dépendances
- Audit npm régulier
- Pas de dépendances avec vulnérabilités critiques

## Accessibility

- N/A pour infrastructure (applicable aux features UI)

## Observability

- Console logging en développement
- Build time reporting
- Bundle size monitoring
