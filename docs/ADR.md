# Architecture Decision Records (ADR)

Documentation des décisions d'architecture majeures du projet Locapilot.

---

## ADR-001: Application PWA Offline-First

**Date**: 2025-11-27  
**Statut**: ✅ Accepté  
**Décideurs**: Équipe technique

### Contexte

L'application de gestion locative doit fonctionner de manière fiable, y compris sans connexion Internet. Les propriétaires doivent pouvoir gérer leurs biens, locataires et loyers partout, à tout moment.

### Décision

Nous développons une **Progressive Web App (PWA)** avec une stratégie **offline-first**.

#### Technologies choisies

- **Vite PWA Plugin** (`vite-plugin-pwa`) pour la configuration service worker
- **Workbox** pour la stratégie de cache avancée
- **IndexedDB** pour le stockage de données structurées

#### Stratégie de cache

```typescript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
    ],
  },
});
```

### Conséquences

**✅ Avantages**:

- Fonctionnement complet sans connexion Internet
- Performance optimale (données locales)
- Expérience utilisateur native (installable)
- Pas de dépendance à un backend
- Données privées (restent sur l'appareil)

**⚠️ Inconvénients**:

- Pas de synchronisation multi-appareils native
- Backup manuel nécessaire
- Limité par le quota du navigateur (~50% espace disque)

**📋 Actions requises**:

- Implémenter système d'export/import des données
- Documenter processus de backup
- Tester sur différents navigateurs et OS

---

## ADR-002: IndexedDB + Dexie.js pour le stockage

**Date**: 2025-11-27  
**Statut**: ✅ Accepté  
**Décideurs**: Équipe technique

### Contexte

L'application nécessite un stockage structuré et performant pour gérer:

- Propriétés (biens immobiliers)
- Locataires et candidats
- Baux et contrats
- Loyers et paiements
- Documents (fichiers uploadés)
- Paramètres utilisateur

### Décision

Utiliser **IndexedDB** via la librairie **Dexie.js** comme base de données locale.

#### Pourquoi IndexedDB ?

- ✅ Base de données NoSQL native du navigateur
- ✅ Support des transactions ACID
- ✅ Stockage de gros volumes (limité par quota navigateur)
- ✅ Support des Blobs (documents)
- ✅ API asynchrone non-bloquante
- ✅ Compatible PWA offline

#### Pourquoi Dexie.js ?

- ✅ API simplifiée (vs IndexedDB natif)
- ✅ Promesses natives (async/await)
- ✅ Système de migrations intégré
- ✅ TypeScript support excellent
- ✅ Requêtes chainables
- ✅ Active et bien maintenue

### Alternatives considérées

| Solution            | Avantages                          | Inconvénients                  | Décision      |
| ------------------- | ---------------------------------- | ------------------------------ | ------------- |
| **LocalStorage**    | Simple                             | Limité à 5MB, pas de structure | ❌ Rejeté     |
| **IndexedDB natif** | Natif, performant                  | API complexe, verbeux          | ❌ Rejeté     |
| **Dexie.js**        | API simple, migrations, TypeScript | Dépendance externe (+20KB)     | ✅ **Choisi** |
| **PouchDB**         | Sync avec CouchDB                  | Lourd (+150KB), overkill       | ❌ Rejeté     |
| **SQLite WASM**     | SQL standard                       | Lourd, complexe, récent        | ❌ Rejeté     |

### Implémentation

```typescript
// db/database.ts
import Dexie, { type Table } from 'dexie';

export const db = new Dexie('LocapilotDB') as Dexie & LocapilotDB;

db.version(1).stores({
  properties: '++id, name, type, status, createdAt',
  tenants: '++id, firstName, lastName, email, status, createdAt',
  leases: '++id, propertyId, status, startDate, createdAt',
  rents: '++id, leaseId, month, status, createdAt',
  documents: '++id, name, category, entityType, entityId, uploadDate',
  settings: 'key',
});
```

### Conséquences

**✅ Avantages**:

- Stockage structuré et performant
- Requêtes rapides avec indexes
- Transactions pour intégrité des données
- Support TypeScript natif
- Migrations facilitées pour évolutions futures

**⚠️ Inconvénients**:

- Courbe d'apprentissage Dexie.js
- Dépendance externe (~20KB gzipped)
- Pas de SQL standard (NoSQL)

**📋 Actions requises**:

- Documenter schéma de base de données ✅
- Implémenter migrations futures
- Ajouter système de backup/restore

---

## ADR-003: Vue 3 Composition API + TypeScript

**Date**: 2025-11-27  
**Statut**: ✅ Accepté  
**Décideurs**: Équipe technique

### Contexte

Choix du framework frontend pour une application maintenable et type-safe.

### Décision

Utiliser **Vue 3** avec **Composition API** (`<script setup>`) et **TypeScript strict**.

#### Pourquoi Vue 3 ?

- ✅ Réactivité performante (Proxy-based)
- ✅ API moderne (Composition API)
- ✅ TypeScript support amélioré
- ✅ Écosystème riche (Pinia, Vue Router)
- ✅ Bundle size optimisé (tree-shaking)
- ✅ Expérience développeur excellente

#### Pourquoi Composition API ?

```vue
<script setup lang="ts">
// ✅ TypeScript inference automatique
// ✅ Moins de boilerplate
// ✅ Meilleure réutilisabilité (composables)
// ✅ Performance optimale (pas de this)

import { ref, computed } from 'vue';

const count = ref(0);
const doubled = computed(() => count.value * 2);

function increment() {
  count.value++;
}
</script>
```

vs Options API (ancien style):

```vue
<script lang="ts">
// ❌ Plus verbeux
// ❌ TypeScript inference limitée
// ❌ Logique dispersée (data, computed, methods)

export default {
  data() {
    return { count: 0 };
  },
  computed: {
    doubled() {
      return this.count * 2;
    },
  },
  methods: {
    increment() {
      this.count++;
    },
  },
};
</script>
```

#### TypeScript strict mode

Configuration `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  }
}
```

### Alternatives considérées

| Framework   | Avantages                     | Inconvénients         | Décision      |
| ----------- | ----------------------------- | --------------------- | ------------- |
| **React**   | Écosystème énorme             | JSX, hooks complexes  | ❌ Rejeté     |
| **Svelte**  | Performances, simplicité      | Écosystème plus petit | ❌ Rejeté     |
| **Vue 3**   | Équilibre perf/DX, TypeScript | -                     | ✅ **Choisi** |
| **Angular** | Enterprise-ready              | Lourd, complexe       | ❌ Rejeté     |

### Conséquences

**✅ Avantages**:

- Type safety complète (TypeScript strict)
- Code concis et lisible (Composition API)
- Réutilisabilité (composables)
- Performances optimales
- Écosystème riche et actif

**⚠️ Inconvénients**:

- Courbe d'apprentissage Composition API
- Migration Options API → Composition API pour certains devs

**📋 Actions requises**:

- Documenter patterns Composition API ✅ (CONTRIBUTING.md)
- Créer composables réutilisables
- Configurer ESLint pour Vue 3 best practices ✅

---

## ADR-004: Pinia pour la gestion d'état

**Date**: 2025-11-27  
**Statut**: ✅ Accepté  
**Décideurs**: Équipe technique

### Contexte

Nécessité d'un state management centralisé pour partager l'état entre composants.

### Décision

Utiliser **Pinia** comme store management officiel.

#### Pourquoi Pinia ?

- ✅ Recommandé officiellement par Vue 3
- ✅ TypeScript support natif
- ✅ DevTools integration
- ✅ Composition API style
- ✅ Léger (~1KB)
- ✅ Hot Module Replacement (HMR)

#### Architecture des stores

```
src/
└── features/
    ├── properties/
    │   └── stores/
    │       └── propertiesStore.ts
    ├── tenants/
    │   └── stores/
    │       └── tenantsStore.ts
    ├── leases/
    │   └── stores/
    │       └── leasesStore.ts
    └── rents/
        └── stores/
            └── rentsStore.ts
```

Pattern store standard:

```typescript
import { defineStore } from 'pinia';
import { db } from '@/db/database';

export const usePropertiesStore = defineStore('properties', () => {
  // State
  const properties = ref<Property[]>([]);
  const loading = ref(false);

  // Getters
  const vacantProperties = computed(() => properties.value.filter(p => p.status === 'vacant'));

  // Actions
  async function fetchProperties() {
    loading.value = true;
    try {
      properties.value = await db.properties.toArray();
    } finally {
      loading.value = false;
    }
  }

  return { properties, loading, vacantProperties, fetchProperties };
});
```

### Alternatives considérées

| Solution        | Avantages                  | Inconvénients                     | Décision      |
| --------------- | -------------------------- | --------------------------------- | ------------- |
| **Vuex**        | Mature, officiel (ancien)  | API verbeux, TypeScript difficile | ❌ Rejeté     |
| **Pinia**       | Modern, TypeScript, simple | -                                 | ✅ **Choisi** |
| **État local**  | Simple pour petites apps   | Pas scalable                      | ❌ Rejeté     |
| **Composables** | Léger, flexible            | Pas de DevTools                   | ❌ Rejeté     |

### Conséquences

**✅ Avantages**:

- State management centralisé
- TypeScript inference automatique
- DevTools pour debugging
- Hot reload pendant développement
- Code modular et testable

**⚠️ Inconvénients**:

- Dépendance externe (~1KB)
- Nécessite apprentissage pattern store

**📋 Actions requises**:

- Documenter pattern store ✅ (CONTRIBUTING.md)
- Créer tests unitaires pour stores ✅
- Configurer Pinia DevTools ✅

---

## ADR-005: Vite comme build tool

**Date**: 2025-11-27  
**Statut**: ✅ Accepté  
**Décideurs**: Équipe technique

### Contexte

Choix de l'outil de build pour développement et production.

### Décision

Utiliser **Vite** comme bundler et dev server.

#### Pourquoi Vite ?

- ✅ Démarrage instantané (ESM natif)
- ✅ Hot Module Replacement ultra-rapide
- ✅ Build optimisé (Rollup)
- ✅ Configuration minimale
- ✅ Support TypeScript natif
- ✅ Plugins riches (PWA, compression, etc.)

#### Configuration optimisée

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      /* PWA config */
    }),
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'pinia', 'vue-router'],
          db: ['dexie'],
        },
      },
    },
  },
});
```

### Alternatives considérées

| Build Tool  | Avantages                 | Inconvénients             | Décision      |
| ----------- | ------------------------- | ------------------------- | ------------- |
| **Webpack** | Mature, écosystème énorme | Lent, complexe            | ❌ Rejeté     |
| **Vite**    | Rapide, simple, modern    | Écosystème plus récent    | ✅ **Choisi** |
| **Parcel**  | Zero-config               | Moins performant que Vite | ❌ Rejeté     |
| **Rollup**  | Excellent tree-shaking    | Config complexe           | ❌ Rejeté     |

### Conséquences

**✅ Avantages**:

- Dev server ultra-rapide (<1s démarrage)
- HMR instantané
- Build production optimisé
- Configuration simple
- Bundle size réduit (tree-shaking)

**⚠️ Inconvénients**:

- Nécessite navigateurs modernes (ESM)
- Écosystème plugins plus récent que Webpack

**📋 Actions requises**:

- Optimiser build production ✅
- Configurer code splitting ✅
- Monitorer bundle size ✅ (actuellement 456KB)

---

## ADR-006: Feature-based architecture

**Date**: 2025-11-27  
**Statut**: ✅ Accepté  
**Décideurs**: Équipe technique

### Contexte

Organisation du code pour une application scalable et maintenable.

### Décision

Adopter une **architecture basée sur les features** (domain-driven).

#### Structure des dossiers

```
src/
├── core/                    # Infrastructure globale
│   ├── components/          # Composants layout (Sidebar, AppBar)
│   ├── layouts/             # Layouts (MainLayout)
│   ├── router/              # Configuration routing
│   └── store/               # Store global (appStore)
│
├── features/                # Features métier
│   ├── properties/          # Gestion propriétés
│   │   ├── components/      # PropertyCard, PropertyForm, etc.
│   │   ├── stores/          # propertiesStore.ts
│   │   ├── types/           # Property types
│   │   └── views/           # PropertiesView.vue
│   │
│   ├── tenants/             # Gestion locataires
│   ├── leases/              # Gestion baux
│   ├── rents/               # Gestion loyers
│   ├── documents/           # Gestion documents
│   └── dashboard/           # Dashboard
│
└── shared/                  # Code partagé
    ├── components/          # Button, Input, Modal, etc.
    ├── types/               # Types communs
    └── utils/               # Utilitaires
```

#### Principe d'organisation

Chaque feature est **auto-suffisante** et contient:

- `components/` - Composants spécifiques
- `stores/` - État Pinia
- `types/` - Interfaces TypeScript
- `views/` - Pages/vues
- `utils/` (optionnel) - Utilitaires feature

### Alternatives considérées

| Architecture                                  | Avantages           | Inconvénients           | Décision      |
| --------------------------------------------- | ------------------- | ----------------------- | ------------- |
| **Type-based** (components/, stores/, types/) | Simple petit projet | Pas scalable            | ❌ Rejeté     |
| **Feature-based**                             | Scalable, modular   | Plus de dossiers        | ✅ **Choisi** |
| **Monorepo**                                  | Isolation maximale  | Overkill pour ce projet | ❌ Rejeté     |

### Conséquences

**✅ Avantages**:

- Code organisé par domaine métier
- Facilite ajout nouvelles features
- Meilleure scalabilité
- Isolation des responsabilités
- Tests plus simples (par feature)

**⚠️ Inconvénients**:

- Plus de dossiers (apparemment complexe)
- Nécessite discipline équipe

**📋 Actions requises**:

- Documenter structure ✅ (CONTRIBUTING.md)
- Créer template feature pour nouveaux développeurs
- Refactoriser features existantes si incohérences

---

## ADR-007: Tailwind CSS pour le styling

**Date**: 2025-11-27  
**Statut**: ✅ Accepté  
**Décideurs**: Équipe technique

### Contexte

Choix du système de styling pour interface utilisateur.

### Décision

Utiliser **Tailwind CSS** avec configuration personnalisée.

#### Pourquoi Tailwind CSS ?

- ✅ Utility-first (rapide à développer)
- ✅ Design system cohérent (spacing, colors, etc.)
- ✅ Purge CSS automatique (bundle optimisé)
- ✅ Responsive design facile
- ✅ Dark mode intégré
- ✅ Composable avec Vue

#### Configuration

```typescript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          // ... custom palette
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
};
```

#### Exemple d'utilisation

```vue
<template>
  <button
    class="px-4 py-2 bg-primary-600 text-white rounded-lg 
           hover:bg-primary-700 transition-colors
           disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Enregistrer
  </button>
</template>
```

### Alternatives considérées

| Solution         | Avantages                  | Inconvénients                 | Décision      |
| ---------------- | -------------------------- | ----------------------------- | ------------- |
| **CSS Modules**  | Scoped, standard           | Verbeux, pas de design system | ❌ Rejeté     |
| **Tailwind CSS** | Rapide, cohérent, optimisé | Markup verbeux                | ✅ **Choisi** |
| **Vuetify**      | Components prêts           | Lourd, complexe               | ❌ Rejeté     |
| **Custom CSS**   | Contrôle total             | Difficile à maintenir         | ❌ Rejeté     |

### Conséquences

**✅ Avantages**:

- Développement rapide
- Design system cohérent
- Bundle CSS optimisé (purge)
- Responsive facile
- Dark mode natif

**⚠️ Inconvénients**:

- Markup HTML verbeux
- Courbe apprentissage classes utility

**📋 Actions requises**:

- Créer composants base (Button, Input, etc.) ✅
- Documenter design system ✅ (mockups/)
- Configurer VSCode IntelliSense Tailwind ✅

---

## ADR-008: Vitest + Playwright pour les tests

**Date**: 2025-11-27  
**Statut**: ✅ Accepté  
**Décideurs**: Équipe technique

### Contexte

Stratégie de test pour garantir qualité et fiabilité.

### Décision

Utiliser **Vitest** pour tests unitaires et **Playwright** pour tests E2E.

#### Vitest (Unit & Integration)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['**/*.d.ts', '**/*.spec.ts', '**/types/**'],
    },
  },
});
```

**Pourquoi Vitest ?**

- ✅ Rapide (Vite-powered)
- ✅ API compatible Jest
- ✅ Coverage intégré
- ✅ TypeScript natif
- ✅ Watch mode performant

#### Playwright (E2E)

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

**Pourquoi Playwright ?**

- ✅ Multi-browsers (Chromium, Firefox, WebKit)
- ✅ Rapide et stable
- ✅ Auto-wait intelligent
- ✅ Screenshots/traces debugging
- ✅ Mobile testing

#### Pyramide de tests

```
        /\
       /  \
      / E2E \         ← Playwright (flows critiques)
     /────────\
    /          \
   / Integration \    ← Vitest (stores, composables)
  /──────────────\
 /                \
/   Unit Tests     \  ← Vitest (utils, helpers)
\__________________/
```

### Alternatives considérées

| Testing Tool   | Avantages                 | Inconvénients            | Décision             |
| -------------- | ------------------------- | ------------------------ | -------------------- |
| **Jest**       | Mature, écosystème énorme | Lent vs Vitest           | ❌ Rejeté (unit)     |
| **Vitest**     | Rapide, Vite-native       | Plus récent              | ✅ **Choisi (unit)** |
| **Cypress**    | Bon DX, visual testing    | Plus lent que Playwright | ❌ Rejeté (E2E)      |
| **Playwright** | Rapide, multi-browser     | -                        | ✅ **Choisi (E2E)**  |

### Conséquences

**✅ Avantages**:

- Tests rapides (Vitest + Playwright)
- Coverage automatique
- Multi-browser testing (E2E)
- Debugging facile (traces, screenshots)
- CI/CD friendly

**⚠️ Inconvénients**:

- Deux outils à maintenir
- Courbe apprentissage Playwright

**📋 Actions requises**:

- Écrire tests unitaires stores ✅
- Écrire tests E2E flows critiques ✅
- Configurer CI pour run tests ✅
- Target coverage >70% ⏳

---

## ADR-009: GitHub Actions pour CI/CD

**Date**: 2025-11-27  
**Statut**: ✅ Accepté  
**Décideurs**: Équipe technique

### Contexte

Automatisation des tests, linting, build et déploiement.

### Décision

Utiliser **GitHub Actions** pour CI/CD complet.

#### Workflows configurés

##### 1. CI (`ci.yml`)

Exécuté sur chaque push et PR:

```yaml
- Checkout code
- Setup Node.js 20
- Install dependencies (pnpm)
- Run ESLint
- Run TypeScript check
- Run Vitest tests + coverage
- Upload coverage to Codecov
```

##### 2. E2E Tests (`e2e.yml`)

Tests end-to-end sur 3 navigateurs:

```yaml
- Install dependencies
- Build application
- Run Playwright tests (Chromium, Firefox, WebKit)
- Upload test reports
```

##### 3. Deploy (`deploy.yml`)

Déploiement automatique sur main:

```yaml
- Build production
- Deploy to Netlify
- Deploy to GitHub Pages
```

### Alternatives considérées

| CI/CD Platform     | Avantages               | Inconvénients            | Décision      |
| ------------------ | ----------------------- | ------------------------ | ------------- |
| **GitHub Actions** | Intégré GitHub, gratuit | -                        | ✅ **Choisi** |
| **GitLab CI**      | Puissant                | Nécessite GitLab         | ❌ Rejeté     |
| **CircleCI**       | Performant              | Payant au-delà free tier | ❌ Rejeté     |
| **Travis CI**      | Historique              | Moins maintenu           | ❌ Rejeté     |

### Conséquences

**✅ Avantages**:

- Intégration GitHub native
- Gratuit pour projets publics
- Workflows personnalisables
- Matrix testing (multi-OS, multi-version)
- Cache dependencies

**⚠️ Inconvénients**:

- Limité aux projets GitHub
- Minutes gratuites limitées (2000/mois free tier)

**📋 Actions requises**:

- Configurer workflows CI/CD ✅
- Ajouter badges status README ✅
- Optimiser cache dependencies ✅
- Configurer branch protection rules ⏳

---

## ADR-010: Déploiement Netlify + GitHub Pages

**Date**: 2025-11-27  
**Statut**: ✅ Accepté  
**Décideurs**: Équipe technique

### Contexte

Hébergement de l'application PWA pour démo et production.

### Décision

Déployer sur **Netlify** (production) et **GitHub Pages** (backup/preview).

#### Netlify (production)

**Avantages**:

- ✅ CDN global
- ✅ HTTPS automatique
- ✅ Deploy previews pour PR
- ✅ Rollback facile
- ✅ Analytics intégré
- ✅ Headers personnalisés (PWA)

Configuration `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Service-Worker-Allowed = "/"
```

#### GitHub Pages (backup)

Configuration simple:

```yaml
- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dist
```

### Alternatives considérées

| Platform             | Avantages         | Inconvénients          | Décision               |
| -------------------- | ----------------- | ---------------------- | ---------------------- |
| **Netlify**          | Excellent DX, CDN | -                      | ✅ **Choisi (prod)**   |
| **Vercel**           | Similaire Netlify | Plus orienté Next.js   | ❌ Rejeté              |
| **GitHub Pages**     | Gratuit, simple   | Pas de deploy previews | ✅ **Choisi (backup)** |
| **Firebase Hosting** | Google, CDN       | Config plus complexe   | ❌ Rejeté              |

### Conséquences

**✅ Avantages**:

- Déploiement automatique sur push
- HTTPS gratuit
- CDN global (performance)
- Deploy previews (review apps)
- Deux plateformes (redondance)

**⚠️ Inconvénients**:

- Dépendance plateformes tierces
- Free tier limité (Netlify 100GB bandwidth/mois)

**📋 Actions requises**:

- Configurer Netlify projet ✅
- Ajouter custom domain ⏳
- Configurer GitHub Pages ✅
- Tester deploy previews ⏳

---

## Synthèse des décisions

| #   | Décision           | Technologie                  | Statut | Impact       |
| --- | ------------------ | ---------------------------- | ------ | ------------ |
| 001 | Architecture app   | PWA Offline-First            | ✅     | 🔴 Critique  |
| 002 | Base de données    | IndexedDB + Dexie.js         | ✅     | 🔴 Critique  |
| 003 | Framework frontend | Vue 3 + Composition API + TS | ✅     | 🔴 Critique  |
| 004 | State management   | Pinia                        | ✅     | 🟡 Important |
| 005 | Build tool         | Vite                         | ✅     | 🟡 Important |
| 006 | Architecture code  | Feature-based                | ✅     | 🟡 Important |
| 007 | Styling            | Tailwind CSS                 | ✅     | 🟢 Utile     |
| 008 | Testing            | Vitest + Playwright          | ✅     | 🟡 Important |
| 009 | CI/CD              | GitHub Actions               | ✅     | 🟡 Important |
| 010 | Déploiement        | Netlify + GitHub Pages       | ✅     | 🟢 Utile     |

---

## Process de proposition d'ADR

Pour proposer une nouvelle décision d'architecture:

1. **Créer un document** `docs/ADR-XXX-titre.md`
2. **Suivre le template**:

   ```markdown
   ## ADR-XXX: Titre de la décision

   **Date**: YYYY-MM-DD
   **Statut**: 🔄 Proposition / ✅ Accepté / ❌ Rejeté
   **Décideurs**: Nom(s)

   ### Contexte

   Pourquoi cette décision est nécessaire ?

   ### Décision

   Quelle est la décision prise ?

   ### Alternatives considérées

   Tableau comparatif des options

   ### Conséquences

   Avantages, inconvénients, actions requises
   ```

3. **Ouvrir une PR** pour discussion
4. **Valider** avec l'équipe
5. **Merger** et ajouter à ce document

---

Cette documentation sera mise à jour à chaque décision d'architecture majeure.
