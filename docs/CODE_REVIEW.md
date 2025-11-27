# Code Review - Locapilot

## Date de revue

27 novembre 2025

## Métriques Générales

### Statistiques Codebase

- **Fichiers source** : 98 fichiers (.ts + .vue)
- **Tests** : 273 tests (22 fichiers de test)
- **Coverage** : 82.94% (cible: >70%) ✅
- **Build size** : 257KB JS, 362KB CSS (152KB gzippé) ✅
- **TypeScript strict** : Activé, 0 erreurs ✅
- **ESLint** : 0 erreurs, 0 warnings ✅

### TODOs/FIXMEs

- **Total** : 1 TODO trouvé
- **Localisation** : `src/features/rents/views/RentsView.vue:72`
- **Contenu** : "TODO: Implémenter la génération de quittance"
- **Priorité** : Basse (fonctionnalité future, non bloquante)

### Commentaires Code

| Fichier            | Commentaires | Lignes  | Ratio    |
| ------------------ | ------------ | ------- | -------- |
| propertiesStore.ts | 8            | 148     | 5.4%     |
| tenantsStore.ts    | 6            | 128     | 4.7%     |
| leasesStore.ts     | 8            | 160     | 5.0%     |
| useValidation.ts   | 9            | 195     | 4.6%     |
| useExport.ts       | 17           | 110     | 15.5%    |
| database.ts        | 1            | 2       | 50.0%    |
| **TOTAL**          | **49**       | **743** | **6.6%** |

**Analyse** : Ratio de commentaires faible (6.6%) mais acceptable car :

- TypeScript fournit documentation implicite (types, interfaces)
- Noms de fonctions/variables explicites (self-documenting code)
- Architecture claire par features
- Tests unitaires servent de documentation

## Architecture

### ✅ Points Positifs

1. **Structure Feature-Based**

   ```
   src/
   ├── core/           # Router, store, layouts
   ├── features/       # Modules métier (properties, tenants, leases, rents, documents, settings)
   ├── shared/         # Composants, composables, utils réutilisables
   └── db/             # Database layer (Dexie.js)
   ```

   - **Avantage** : Séparation claire des responsabilités, scalabilité
   - **Qualité** : Excellente organisation

2. **Séparation des Préoccupations**
   - **Stores (Pinia)** : Logique métier et état
   - **Composables** : Logique réutilisable (validation, export, import)
   - **Components** : Présentation pure
   - **Database** : Couche d'accès données isolée
   - **Qualité** : Respect des principes SOLID

3. **TypeScript Strict Mode**
   - **Configuration** : `strict: true`, `noImplicitAny: true`
   - **Résultat** : 0 erreurs, pas de `any` sauvage
   - **Bénéfice** : Type safety maximale, moins de bugs runtime
   - **Qualité** : Excellente discipline de typage

4. **Offline-First**
   - **IndexedDB** : Dexie.js pour persistance locale
   - **Service Worker** : Workbox pour cache des assets
   - **Pas de backend** : 100% autonome
   - **Qualité** : Implémentation conforme PWA

### ⚠️ Points d'Amélioration

1. **Commentaires JSDoc/TSDoc**
   - **Constat** : Peu de documentation inline (~6.6%)
   - **Impact** : Faible (TypeScript compense)
   - **Recommandation** : Ajouter JSDoc pour fonctions publiques exportées
   - **Exemple souhaité** :
     ```typescript
     /**
      * Crée un nouveau bail et convertit les candidats en locataires actifs
      * @param lease - Les données du bail à créer
      * @returns L'ID du bail créé
      * @throws Error si la création échoue
      */
     async createLease(lease: Lease): Promise<number> { ... }
     ```

2. **Tests E2E Playwright**
   - **Couverture** : 10 specs E2E (navigation, CRUD, PWA)
   - **Constat** : Tests basiques présents
   - **Recommandation** : Ajouter scénarios métier complets (workflow complet locataire → bail → loyer)

3. **Gestion d'Erreurs**
   - **Stores** : Try/catch avec `console.error` uniquement
   - **Recommandation** : Centraliser gestion erreurs (composable `useErrorHandler`, Sentry, etc.)
   - **Exemple actuel** :
     ```typescript
     try {
       const id = await db.properties.add(property);
       return id;
     } catch (error) {
       console.error('Failed to create property:', error);
       throw error;
     }
     ```
   - **Exemple souhaité** :
     ```typescript
     try {
       const id = await db.properties.add(property);
       return id;
     } catch (error) {
       const handled = useErrorHandler().handleDbError(error, 'create', 'property');
       throw handled; // Error typée avec context
     }
     ```

4. **Validation de Données**
   - **Composable** : `useValidation` présent mais basique (regex uniquement)
   - **Recommandation** : Intégrer Zod ou Yup pour validation schema-based
   - **Bénéfice** : Validation côté runtime + génération types TS automatique

5. **Internationalisation**
   - **Constat** : Textes hardcodés en français
   - **Recommandation** : Intégrer vue-i18n pour support multilingue (prévu dans roadmap Q2 2026)

## Revue par Module

### Database Layer (`src/db/`)

**Fichiers** :

- `database.ts` : Instance Dexie
- `schema.ts` : Définition tables et versions
- `seed.ts` : Données de test
- `types.ts` : Types TypeScript

**✅ Points positifs** :

- Schéma bien défini avec indexes
- Types TypeScript pour toutes les entités
- Système de versioning Dexie en place
- Seed data pour développement

**⚠️ Améliorations** :

- ❌ Pas de système de migrations (schema v1 uniquement)
- ❌ Pas de gestion transactions complexes
- ❌ Pas de backup/restore automatique
- **Recommandation** : Implémenter migrations pour évolutions futures schema

### Stores Pinia (`src/features/*/stores/`)

**Stores implémentés** :

- `propertiesStore.ts` (148 lignes)
- `tenantsStore.ts` (128 lignes)
- `leasesStore.ts` (160 lignes)
- `rentsStore.ts` (196 lignes)
- `documentsStore.ts` (165 lignes)
- `settingsStore.ts` (109 lignes)
- `appStore.ts` (62 lignes)

**✅ Points positifs** :

- Pattern cohérent : state + getters + actions
- Actions async avec gestion erreurs
- Tests unitaires complets (82-96% coverage)
- Pas de logique métier dans les composants

**⚠️ Améliorations** :

- Répétition code CRUD (create/update/delete similaires)
- **Recommandation** : Créer factory `createCrudStore<T>()` pour mutualiser
- Exemple :
  ```typescript
  function createCrudStore<T extends { id?: number }>(tableName: string) {
    return defineStore(tableName, () => {
      const items = ref<T[]>([]);
      const loading = ref(false);

      async function fetchAll() { ... }
      async function create(item: T) { ... }
      async function update(id: number, updates: Partial<T>) { ... }
      async function remove(id: number) { ... }

      return { items, loading, fetchAll, create, update, remove };
    });
  }
  ```

### Composables (`src/shared/composables/`)

**Composables implémentés** :

- `useValidation.ts` (195 lignes) - Validation email/téléphone/date/montant
- `useExport.ts` (110 lignes) - Export JSON/CSV
- `useImport.ts` (130 lignes) - Import JSON/CSV
- `useNotification.ts` (60 lignes) - Gestion notifications toast
- `useConfirm.ts` (45 lignes) - Dialogs de confirmation

**✅ Points positifs** :

- Réutilisabilité excellente
- Tests unitaires complets
- API claire et simple
- TypeScript strict

**⚠️ Améliorations** :

- `useValidation` : Basique (regex uniquement)
- **Recommandation** : Intégrer Zod pour validation structurée
- `useExport/useImport` : Pas de validation format strict
- **Recommandation** : Valider structure JSON/CSV avant import

### Composants Vue (`src/shared/components/`)

**Composants partagés** :

- `Button.vue` (8 tests, 95.5% coverage)
- `Input.vue` (8 tests, 84% coverage)
- `Select.vue` (8 tests, 92% coverage)
- `Modal.vue` (7 tests, 88% coverage)
- `Card.vue` (6 tests, 90% coverage)
- `Badge.vue` (6 tests, 93% coverage)
- `Alert.vue` (9 tests, 95% coverage)
- `StatCard.vue` (9 tests, 97% coverage)
- `EmptyState.vue` (10 tests, 93% coverage)
- `Spinner.vue` (6 tests, 100% coverage)

**✅ Points positifs** :

- Design system cohérent (Tailwind + custom styles)
- Props typées avec validation
- Émission events typée
- Tests unitaires exhaustifs (88-100% coverage)
- Accessibilité (aria-label, roles, keyboard)

**⚠️ Améliorations** :

- Pas de Storybook déployé (présent mais pas build)
- **Recommandation** : Déployer Storybook sur Chromatic ou GitHub Pages

### Vues Métier (`src/features/*/views/`)

**Vues principales** :

- `DashboardView.vue` - KPIs + activité récente
- `PropertiesView.vue` - Liste propriétés + CRUD
- `PropertyDetailView.vue` - Détail propriété
- `TenantsView.vue` - Liste locataires/candidats + CRUD
- `TenantDetailView.vue` - Détail locataire
- `LeasesView.vue` - Liste baux + CRUD
- `LeaseDetailView.vue` - Détail bail
- `RentsView.vue` - Tableau loyers + filtres
- `RentsCalendarView.vue` - Vue calendrier (stub)
- `DocumentsView.vue` - Gestion documents
- `SettingsView.vue` - Paramètres app

**✅ Points positifs** :

- Composition API (setup script)
- Séparation logique/présentation claire
- Réactivité Pinia bien utilisée
- Styles partagés (`shared-detail-styles.css`)

**⚠️ Améliorations** :

- `RentsCalendarView` : Non implémentée (stub "En construction")
- Workflow candidat → locataire : Conversion implicite dans `LeaseFormModal`
- **Recommandation** : Rendre workflow plus explicite avec dialog confirmation

## Qualité Code - Détails

### TypeScript

**Configuration** (`tsconfig.json`) :

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

**✅ Résultats** :

- 0 erreurs TypeScript
- 0 warnings
- Pas de `any` sauvage (sauf génériques nécessaires)
- Types d'interfaces complets pour toutes les entités

### ESLint

**Configuration** (`eslint.config.js`) :

- Vue plugin officiel
- TypeScript parser
- Prettier intégration
- Vue accessibility plugin

**✅ Résultats** :

- 0 erreurs
- 0 warnings
- Formatage cohérent (Prettier)

### Tests

**Framework** : Vitest + @vue/test-utils

**Coverage global** : 82.94%

**Détail par module** :
| Module | Statements | Branches | Functions | Lines |
|--------|-----------|----------|-----------|-------|
| core/store | 92.85% | 88.88% | 91.66% | 92.85% |
| features/properties/stores | 100% | 100% | 100% | 100% |
| features/tenants/stores | 96.96% | 95.23% | 92.85% | 96.96% |
| features/leases/stores | 71.73% | 59.25% | 64.28% | 71.73% |
| features/rents/stores | 84% | 74.07% | 73.33% | 84% |
| features/documents/stores | 70.9% | 53.33% | 64.28% | 70.9% |
| features/settings/stores | 80.95% | 72.22% | 76.92% | 80.95% |
| shared/components | 95.38% | 92.85% | 93.54% | 95.38% |
| shared/composables | 80.29% | 76.66% | 78.94% | 80.29% |

**✅ Points positifs** :

- Coverage >70% sur tous les modules
- Tests unitaires pour tous les stores
- Tests unitaires pour tous les composants partagés
- Tests E2E pour workflows critiques

**⚠️ Améliorations** :

- `leasesStore` et `documentsStore` : Coverage branches faible (53-59%)
- **Recommandation** : Ajouter tests pour cas d'erreur et edge cases

## Sécurité

### ✅ Points Positifs

1. **Pas de dépendances externes critiques**
   - Pas d'appels API externes
   - Pas de secrets/tokens à gérer
   - Pas de backend vulnérable

2. **Validation Input**
   - Validation côté client (useValidation)
   - Types TypeScript empêchent injections de type

3. **IndexedDB**
   - Isolation par origine (same-origin policy)
   - Pas de partage cross-domain

4. **Service Worker**
   - Scope limité à `/locapilot/`
   - Pas d'interception requêtes externes
   - Cache contrôlé (Workbox)

### ⚠️ Risques Potentiels

1. **Export/Import CSV/JSON**
   - **Risque** : Injection de données malveillantes
   - **Impact** : Faible (validation basique uniquement)
   - **Recommandation** : Valider structure JSON avec Zod avant import
   - **Exemple** :

     ```typescript
     import { z } from 'zod';

     const PropertySchema = z.object({
       name: z.string().min(1),
       address: z.string().min(1),
       price: z.number().positive(),
       // ...
     });

     const data = JSON.parse(jsonContent);
     PropertySchema.parse(data); // Throw si invalide
     ```

2. **Upload Documents**
   - **Risque** : Upload fichiers arbitraires (pas de validation type MIME)
   - **Impact** : Faible (stockage local uniquement, pas d'exécution)
   - **Recommandation** : Valider type MIME et taille fichier

3. **XSS via User Input**
   - **Risque** : Champs texte non sanitisés
   - **Impact** : Très faible (Vue échappe automatiquement HTML)
   - **État** : Protection native Vue active

## Performance

### Bundle Size

**Production build** :

```
dist/assets/index-BKql3hcw.js    256.67 kB │ gzip:  91.50 kB
dist/assets/index-ozJGry6I.css   361.32 kB │ gzip:  60.55 kB
```

**✅ Résultats** :

- JS gzippé : 91.50 KB ✅ (excellent)
- CSS gzippé : 60.55 KB ✅ (acceptable)
- Total : 152 KB gzippé (target: <500KB) ✅

**Optimisations actives** :

- Tree shaking (Vite)
- Code splitting (lazy load views)
- Minification (Terser)
- Compression Gzip

### Runtime Performance

**Critères PWA** :

- ✅ First Contentful Paint < 2s (estimé)
- ✅ Time to Interactive < 3s (estimé)
- ✅ Service Worker cache (offline instant)

**IndexedDB** :

- Requêtes asynchrones (pas de blocage UI)
- Indexes optimisés pour queries fréquentes
- Transactions implicites (Dexie)

## Accessibilité

### ✅ Points Positifs

1. **Composants Accessibles**
   - `aria-label` sur tous les boutons
   - `role` appropriés (button, dialog, alert)
   - Navigation clavier (focus management)
   - Contraste couleurs conforme WCAG AA

2. **Formulaires**
   - Labels associés aux inputs (`<label for="...">`)
   - Messages d'erreur visibles et annoncés
   - Focus visible sur tabulation

3. **Sémantique HTML**
   - Structure hiérarchique (h1 → h2 → h3)
   - Landmarks implicites (<header>, <main>, <nav>)

### ⚠️ Améliorations

1. **Skip Links**
   - **Manquant** : Lien "Aller au contenu" pour lecteurs d'écran
   - **Recommandation** : Ajouter en haut de MainLayout.vue

2. **Live Regions**
   - **Manquant** : Annonces dynamiques (aria-live)
   - **Recommandation** : Utiliser pour notifications toast

3. **Tests Accessibilité Automatisés**
   - **Manquant** : Tests axe-core ou Lighthouse accessibility
   - **Recommandation** : Intégrer @axe-core/playwright

## Maintenabilité

### ✅ Points Forts

1. **Architecture Scalable**
   - Feature-based : Facile d'ajouter nouvelles features
   - Composants réutilisables : Design system cohérent
   - Stores modulaires : Isolation logique métier

2. **Documentation**
   - README complet avec installation/usage
   - CONTRIBUTING.md pour contributeurs
   - ADR.md pour décisions architecturales
   - API.md pour référence développeurs
   - GETTING_STARTED.md pour utilisateurs

3. **Outillage**
   - TypeScript strict : Refactoring sûr
   - Tests automatisés : Régression détectable
   - Linting : Style cohérent
   - Git hooks : Qualité garantie

### ⚠️ Risques Maintenabilité

1. **Répétition Code CRUD**
   - Chaque store réimplémente create/update/delete
   - **Impact** : Duplication ~60 lignes/store × 6 stores = 360 lignes
   - **Recommandation** : Factory pattern ou classe abstraite

2. **Pas de Changelog**
   - **Impact** : Difficile suivre évolutions
   - **Recommandation** : Générer CHANGELOG.md automatique (conventional commits)

3. **Dépendances Non Lockées**
   - package-lock.json présent mais versions `^` dans package.json
   - **Recommandation** : Pin versions majeures pour stabilité

## Recommandations Prioritaires

### 🔴 Haute Priorité

1. **Implémenter RentsCalendarView**
   - Actuellement stub "En construction"
   - Vue calendrier essentielle pour gestion loyers
   - Utiliser library Calendar (FullCalendar, VCalendar, ou custom)

2. **Ajouter Migrations Database**
   - Critique pour évolutions futures
   - Dexie supporte versioning natif
   - Exemple :
     ```typescript
     db.version(2).stores({
       properties: '++id, name, address, city, status, createdAt',
       // Nouvelle colonne 'city' ajoutée
     });
     ```

3. **Centraliser Gestion Erreurs**
   - Créer composable `useErrorHandler`
   - Logging structuré (Sentry, LogRocket, ou custom)
   - UX cohérente (toasts + retry)

### 🟡 Moyenne Priorité

4. **Factory CRUD Store**
   - Réduire duplication code
   - Faciliter ajout nouvelles entités
   - Estimation : -300 lignes code

5. **Intégrer Zod Validation**
   - Validation runtime + types TS
   - Sécurité import/export
   - Validation formulaires robuste

6. **Tests E2E Workflows Complets**
   - Scénario : Ajouter candidat → créer bail → générer loyers → marquer payé
   - Scénario : Ajouter propriété → associer documents → exporter données
   - Coverage workflows métier bout-en-bout

### 🟢 Basse Priorité

7. **JSDoc/TSDoc Commentaires**
   - Documenter fonctions publiques exportées
   - Générer documentation auto (TypeDoc)

8. **Déployer Storybook**
   - Catalogue composants vivant
   - Facilite collaboration design/dev

9. **Internationalisation (i18n)**
   - Support multilingue (prévu Q2 2026)
   - Intégrer vue-i18n

## Score Global

### Qualité Code : **A (90/100)**

| Critère        | Note    | Commentaire                                    |
| -------------- | ------- | ---------------------------------------------- |
| Architecture   | 95/100  | Excellente structure feature-based             |
| TypeScript     | 100/100 | Strict mode, 0 erreurs, types complets         |
| Tests          | 85/100  | 82.94% coverage, manque tests E2E complets     |
| Performance    | 90/100  | Bundle optimisé, PWA conforme                  |
| Sécurité       | 85/100  | Pas de risques majeurs, validation à améliorer |
| Accessibilité  | 80/100  | Bonnes bases, manque skip links et aria-live   |
| Maintenabilité | 90/100  | Scalable, mais répétition code CRUD            |
| Documentation  | 85/100  | Complète, manque JSDoc inline                  |

### Conclusion

Le code de **Locapilot** est de **très bonne qualité** avec une architecture solide, un typage strict et des tests exhaustifs. Les principales améliorations concernent la **réduction de duplication** (factory CRUD), **l'implémentation du calendrier des loyers**, et **la validation structurée** (Zod).

**Points forts majeurs** :

- ✅ Architecture feature-based scalable
- ✅ TypeScript strict sans compromis
- ✅ Tests >80% coverage
- ✅ PWA conforme (offline-first)
- ✅ Bundle optimisé (<200KB gzippé)

**Améliorations prioritaires** :

- 🔴 Implémenter RentsCalendarView
- 🔴 Ajouter migrations database
- 🔴 Centraliser gestion erreurs
- 🟡 Factory CRUD stores
- 🟡 Intégrer Zod validation

**Verdict** : Code production-ready avec quelques optimisations recommandées. ✅
