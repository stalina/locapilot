# Design - Configuration initiale du projet Locapilot

**Change ID**: `add-initial-project-setup`

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (PWA)                     │
├─────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────┐ │
│  │           Vue.js Application Layer             │ │
│  │  ┌──────────────┐  ┌──────────────────────┐  │ │
│  │  │  Components  │  │   Views/Pages        │  │ │
│  │  │  (UI Layer)  │  │                      │  │ │
│  │  └──────────────┘  └──────────────────────┘  │ │
│  │  ┌──────────────┐  ┌──────────────────────┐  │ │
│  │  │ Composables  │  │   Vue Router         │  │ │
│  │  │              │  │                      │  │ │
│  │  └──────────────┘  └──────────────────────┘  │ │
│  └───────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────┐ │
│  │         State Management (Pinia)              │ │
│  │  ┌─────┐  ┌─────┐  ┌─────┐  ┌──────────┐   │ │
│  │  │Props│  │Tenant│  │Lease│  │Settings │   │ │
│  │  │Store│  │Store │  │Store│  │Store    │   │ │
│  │  └─────┘  └─────┘  └─────┘  └──────────┘   │ │
│  └───────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────┐ │
│  │         Data Access Layer (Dexie.js)          │ │
│  │  ┌─────────────────────────────────────────┐ │ │
│  │  │  Database Wrapper & Composables         │ │ │
│  │  └─────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────┐ │
│  │           IndexedDB (Browser Storage)         │ │
│  │  [Properties] [Tenants] [Leases] [Docs]...   │ │
│  └───────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  Service Worker (Workbox) - Offline Strategy       │
└─────────────────────────────────────────────────────┘
```

### Data Flow

```
User Interaction
    ↓
Component Event
    ↓
Store Action
    ↓
Dexie.js Wrapper
    ↓
IndexedDB Transaction
    ↓
Store State Update
    ↓
Component Re-render
```

## Technical Decisions

### TD-001: Vue.js 3 avec Composition API

**Decision**: Utiliser Vue.js 3 avec Composition API et `<script setup>`

**Rationale**:

- Meilleure réutilisabilité avec composables
- TypeScript support de premier ordre
- Performance optimisée
- Code plus concis et lisible
- Meilleure organisation logique

**Alternatives considérées**:

- Options API: Moins moderne, moins de réutilisabilité
- React: Plus complexe, écosystème plus fragmenté
- Svelte: Moins mature, écosystème moins riche

**Impact**:

- Tous les composants utiliseront `<script setup>`
- Logique réutilisable dans des composables
- TypeScript génériques pour props et emits

### TD-002: Dexie.js pour IndexedDB

**Decision**: Utiliser Dexie.js comme wrapper IndexedDB

**Rationale**:

- API simple et intuitive
- Promises-based (async/await)
- Système de migrations robuste
- Excellent TypeScript support
- Query builder puissant
- Gestion des erreurs intégrée

**Alternatives considérées**:

- IndexedDB natif: Trop verbeux, API complexe
- LocalForage: Pas de queries complexes
- PouchDB: Overhead inutile pour notre cas

**Impact**:

- Schéma de données versionné
- Migrations automatiques
- TypeScript types pour toutes les tables

### TD-003: Vite comme Build Tool

**Decision**: Utiliser Vite pour build et dev server

**Rationale**:

- HMR ultra-rapide
- Build optimisé avec Rollup
- Plugin PWA excellent (@vite-plugin/pwa)
- Configuration simple
- Supporte TypeScript nativement
- Écosystème Vue.js officiel

**Alternatives considérées**:

- Webpack: Plus lent, configuration complexe
- Parcel: Moins de contrôle
- esbuild seul: Pas de dev server complet

**Impact**:

- Démarrage dev < 1 seconde
- HMR instantané
- Build optimisé automatique

### TD-004: PWA avec Workbox

**Decision**: Utiliser @vite-plugin/pwa avec Workbox en mode generateSW

**Rationale**:

- Configuration zero-config pour cas simples
- Stratégies de cache optimales
- Gestion des updates automatique
- Pré-caching des assets
- Support offline complet

**Alternatives considérées**:

- Service Worker manuel: Trop complexe
- InjectManifest: Overkill pour nos besoins
- Pas de PWA: Ne répond pas aux besoins

**Impact**:

- Application 100% offline après installation
- Updates automatiques avec notification
- Cache intelligent des ressources

### TD-005: Pinia pour State Management

**Decision**: Utiliser Pinia comme store

**Rationale**:

- Store officiel Vue 3
- TypeScript excellent support
- Devtools intégration
- Simple et intuitif
- Modular stores
- Pas de mutations (direct state)

**Alternatives considérées**:

- Vuex: Deprecated pour Vue 3
- Composables seuls: Pas de devtools, partage d'état complexe
- MobX: Non idiomatique Vue

**Impact**:

- Un store par domaine métier
- Actions asynchrones pour DB
- Getters computed pour queries

### TD-006: Structure de Projet Feature-Based

**Decision**: Organisation par feature plutôt que par type

**Structure**:

```
src/
├── features/
│   ├── properties/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── store/
│   │   ├── types/
│   │   └── views/
│   ├── tenants/
│   ├── leases/
│   └── ...
├── core/
│   ├── components/
│   ├── composables/
│   ├── layouts/
│   └── router/
├── db/
│   ├── schema.ts
│   ├── migrations.ts
│   └── composables/
└── shared/
    ├── components/
    ├── types/
    └── utils/
```

**Rationale**:

- Meilleure scalabilité
- Code colocalisé par fonctionnalité
- Facilite la maintenance
- Import paths clairs

**Impact**:

- Path aliases configurés
- Import restrictions par feature
- Tests colocalisés

### TD-007: TypeScript Strict Mode

**Decision**: TypeScript strict mode activé

**Configuration**:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Rationale**:

- Catch errors à compile time
- Meilleure autocomplétion
- Documentation vivante
- Refactoring sûr

**Impact**:

- Tous les types explicites
- Pas de `any` (sauf justifié)
- Validation à la compilation

### TD-008: Validation avec Zod

**Decision**: Utiliser Zod pour validation runtime

**Rationale**:

- TypeScript-first
- Type inference automatique
- Validation runtime + compile time
- Messages d'erreur personnalisables
- Parse + validate en une étape

**Alternatives considérées**:

- Yup: Pas de type inference native
- Joi: Pas optimisé TypeScript
- Validation manuelle: Trop verbeux

**Impact**:

- Schémas Zod pour tous les formulaires
- Validation avant insertion DB
- Types TypeScript dérivés des schémas

### TD-009: UI Framework - PrimeVue (Recommandé)

**Decision**: PrimeVue comme framework UI (à confirmer)

**Rationale**:

- Composants riches et complets
- Thémable (PrimeFlex)
- Accessibilité (WCAG AA)
- TypeScript support
- Documentation excellente
- Vue 3 native
- Templates premium disponibles

**Alternatives considérées**:

- Vuetify: Material Design imposé, plus lourd
- Element Plus: Moins de composants, design chinois
- Quasar: Trop orienté mobile-first
- Tailwind + Headless UI: Plus de travail custom

**Impact**:

- Import composants à la demande
- Thème personnalisé Locapilot
- Composants accessibles out-of-the-box

**Note**: Décision finale à prendre avant implémentation

### TD-010: Day.js pour Dates

**Decision**: Utiliser day.js pour manipulation dates

**Rationale**:

- Lightweight (2KB)
- API compatible Moment.js
- Immutable
- Chainable
- Plugin system
- i18n support

**Alternatives considérées**:

- date-fns: Plus gros, moins chaînable
- Moment.js: Deprecated, trop lourd
- Luxon: Plus complexe
- Native Date: API limitée

**Impact**:

- Plugin locale FR
- Plugin calendar
- Plugin relativeTime
- Format standardisé partout

### TD-011: Testing Strategy

**Decision**: Vitest + Vue Test Utils + Playwright

**Stack**:

- **Unit**: Vitest (composables, utils, stores)
- **Component**: Vitest + @vue/test-utils
- **E2E**: Playwright

**Rationale**:

- Vitest: Compatible Vite, rapide, ESM natif
- Vue Test Utils: Officiel, complet
- Playwright: Multi-browser, fiable, rapide

**Coverage Targets**:

- Core logic: 90%
- Stores: 80%
- Composables: 80%
- Components: 70%
- Overall: > 70%

**Impact**:

- Tests colocalisés avec code
- Test utilities partagés
- CI/CD avec tests automatiques

## Database Schema Design

### Version 1 Schema

```typescript
import Dexie, { Table } from 'dexie';

export interface Property {
  id?: number;
  name: string;
  address: string;
  type: 'apartment' | 'house' | 'studio';
  surface: number; // m²
  rooms: number;
  rent: number; // base rent amount
  charges: number;
  description?: string;
  features?: string[];
  status: 'available' | 'rented' | 'maintenance';
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate?: Date;
  currentAddress?: string;
  occupation?: string;
  employer?: string;
  income?: number;
  status: 'active' | 'former';
  createdAt: Date;
  updatedAt: Date;
}

export interface Lease {
  id?: number;
  propertyId: number;
  tenantIds: number[]; // Multiple tenants possible
  startDate: Date;
  endDate?: Date;
  rent: number;
  charges: number;
  deposit: number;
  paymentDay: number; // Day of month (1-31)
  status: 'active' | 'ended' | 'pending';
  documentId?: number; // PDF of lease contract
  createdAt: Date;
  updatedAt: Date;
}

export interface Rent {
  id?: number;
  leaseId: number;
  dueDate: Date;
  amount: number;
  charges: number;
  paidDate?: Date;
  paidAmount?: number;
  paymentMethod?: 'cash' | 'check' | 'transfer' | 'card';
  status: 'pending' | 'paid' | 'late' | 'partial';
  receiptId?: number; // Link to generated receipt
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id?: number;
  name: string;
  type: 'lease' | 'receipt' | 'inventory' | 'id' | 'payslip' | 'other';
  relatedEntityType: 'property' | 'tenant' | 'lease' | 'rent' | 'applicant';
  relatedEntityId: number;
  mimeType: string;
  size: number;
  data: Blob; // File content
  createdAt: Date;
  updatedAt: Date;
}

export interface Inventory {
  id?: number;
  leaseId: number;
  type: 'entry' | 'exit';
  date: Date;
  items: InventoryItem[];
  generalCondition?: string;
  signatures?: {
    tenant: boolean;
    landlord: boolean;
  };
  documentId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  room: string;
  item: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  notes?: string;
  photos?: number[]; // Document IDs
}

export interface Communication {
  id?: number;
  relatedEntityType: 'property' | 'tenant' | 'lease' | 'applicant';
  relatedEntityId: number;
  type: 'email' | 'phone' | 'sms' | 'meeting' | 'letter';
  direction: 'inbound' | 'outbound';
  subject?: string;
  content: string;
  date: Date;
  attachments?: number[]; // Document IDs
  createdAt: Date;
}

export interface Settings {
  id?: number;
  key: string; // Unique key
  value: any;
  updatedAt: Date;
}

export class LocapilotDB extends Dexie {
  properties!: Table<Property, number>;
  tenants!: Table<Tenant, number>;
  leases!: Table<Lease, number>;
  rents!: Table<Rent, number>;
  documents!: Table<Document, number>;
  inventories!: Table<Inventory, number>;
  communications!: Table<Communication, number>;
  settings!: Table<Settings, number>;

  constructor() {
    super('locapilot');

    this.version(1).stores({
      properties: '++id, name, status, createdAt',
      tenants: '++id, email, status, lastName, createdAt',
      leases: '++id, propertyId, status, startDate, endDate',
      rents: '++id, leaseId, dueDate, status, paidDate',
      documents: '++id, type, relatedEntityType, relatedEntityId, createdAt',
      inventories: '++id, leaseId, type, date',
      communications: '++id, relatedEntityType, relatedEntityId, date, type',
      settings: '++id, &key',
    });
  }
}

export const db = new LocapilotDB();
```

### Design Decisions

**Normalization**:

- Tables séparées par entité
- Relations via IDs
- Pas de duplication de données

**Indexes**:

- Indexes sur clés primaires (auto)
- Indexes sur foreign keys (propertyId, leaseId, etc.)
- Indexes sur champs de filtrage fréquents (status, date, type)
- Compound indexes si nécessaire (future optimisation)

**Blobs**:

- Documents stockés comme Blob in IndexedDB
- Pas de base64 (économie mémoire)
- Compression optionnelle (future)

**Dates**:

- Toutes les dates en objets Date JavaScript
- Dexie gère la sérialisation
- Formatage avec day.js dans UI

## Security Considerations

### Data Privacy

- **Local-only storage**: Aucune donnée envoyée à un serveur
- **Browser security**: Protection native du browser (same-origin policy)
- **Encryption optionnelle**: Future feature pour données sensibles (SubtleCrypto API)

### Input Validation

- **Frontend validation**: Zod schemas pour toutes les entrées
- **Sanitization**: XSS protection pour contenu affiché
- **File uploads**: Validation MIME types, taille max

### Access Control

- **No authentication**: Application mono-utilisateur locale
- **Browser profile**: Isolation par profil navigateur
- **Export encryption**: Optionnel pour exports

## Performance Considerations

### Bundle Size

- **Target**: < 500KB gzipped
- **Strategies**:
  - Code splitting par route
  - Lazy loading composants
  - Tree shaking
  - Component library imports optimisés

### Runtime Performance

- **Virtual scrolling**: Pour listes longues (properties, tenants)
- **Pagination**: Queries DB limitées
- **Memoization**: Computed properties, useMemo
- **Debouncing**: Search inputs

### Database Performance

- **Indexes**: Sur champs de query fréquents
- **Batch operations**: Pour imports/exports
- **Transactions**: Pour opérations multi-tables
- **Query optimization**: Where clauses optimisés

### PWA Performance

- **Pre-caching**: Core app shell
- **Runtime caching**: API calls, images
- **Update strategy**: Background sync
- **Cache invalidation**: Version-based

## Accessibility

### WCAG 2.1 AA Compliance

- **Keyboard navigation**: Tous les éléments accessibles au clavier
- **Screen readers**: ARIA labels appropriés
- **Color contrast**: Ratio minimum 4.5:1
- **Focus indicators**: Visibles et clairs
- **Form labels**: Associés correctement
- **Error messages**: Descriptifs et accessibles

### Tools

- **axe-core**: Tests automatisés
- **Lighthouse**: Audit accessibilité
- **Screen reader testing**: VoiceOver (macOS), NVDA (Windows)

## Internationalization (i18n)

### Phase 1

- **Français uniquement**: Hardcoded
- **Format**: Date/nombre locale FR
- **Currency**: EUR

### Future

- **Vue I18n**: Si besoin multi-langue
- **Locale switching**: Settings
- **RTL support**: Si nécessaire

## Error Handling

### Strategy

- **Global error handler**: Vue errorHandler
- **Try-catch**: Toutes les async operations
- **User-friendly messages**: Pas de stack traces
- **Logging**: Console en dev, optional service en prod
- **Fallbacks**: Graceful degradation

### Error Types

- **Network errors**: Offline mode, retry
- **Database errors**: Transaction rollback, user notification
- **Validation errors**: Form-level feedback
- **Runtime errors**: Error boundary, reset state

## Build & Deploy

### Build Process

1. Type check (tsc)
2. Lint (ESLint)
3. Tests (Vitest)
4. Build (Vite)
5. PWA manifest generation
6. Service worker generation
7. Asset optimization

### Deployment

- **Static hosting**: Netlify, Vercel, ou GitHub Pages
- **Auto-deploy**: Sur push main
- **Preview deploys**: Sur PR
- **Cache headers**: Optimaux pour PWA

### Environment Variables

- `VITE_APP_VERSION`: Version de l'app
- `VITE_APP_NAME`: Nom de l'app
- Pas de secrets (frontend-only)

## Monitoring & Analytics

### Phase 1

- **Console logging**: Dev mode
- **Error reporting**: Console uniquement
- **Analytics**: Aucun (privacy-first)

### Future (Optionnel)

- **Plausible/Simple Analytics**: Privacy-friendly
- **Error tracking**: Sentry (opt-in)
- **Usage metrics**: Anonymes

## Backup & Data Portability

### Export

- **Format**: JSON
- **Content**: Toutes les tables
- **Blobs**: Base64 encoded in JSON
- **Trigger**: Manuel via settings

### Import

- **Validation**: Schema validation avant import
- **Merge strategy**: Replace ou merge
- **Backup before import**: Automatic

### Cloud Sync (Future)

- **Dropbox/Google Drive**: Automatic backup
- **Conflict resolution**: Latest wins ou manual
- **Encryption**: Client-side avant upload
