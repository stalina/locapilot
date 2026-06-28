# Locapilot - AI Coding Agent Instructions

## Project Overview

Locapilot is an **offline-first PWA** for rental property management built with Vue 3, TypeScript, and IndexedDB (Dexie.js). All data is stored locally - no backend required.

## Architecture Essentials

### Tech Stack

- **Frontend**: Vue 3 (Composition API with `<script setup>`), TypeScript strict mode
- **Build**: Vite 7+ with path aliases (`@/`, `@core/`, `@features/`, `@db/`, `@shared/`)
- **State**: Pinia stores per feature (e.g., `propertiesStore`, `tenantsStore`)
- **Database**: IndexedDB via Dexie.js - schema in `src/db/schema.ts`
- **Router**: Vue Router with lazy-loaded routes
- **PWA**: vite-plugin-pwa with Workbox for offline caching
- **UI**: PrimeVue components with custom design system

### Directory Structure

```
src/
├── core/           # Global infrastructure (layouts, router, appStore)
├── db/             # Database schema, types, migrations, seed data
├── features/       # Feature modules (properties, tenants, leases, rents, documents)
│   └── [feature]/  # Each has: views/, components/, stores/, types/
└── shared/         # Reusable code (components, composables, utils, styles)
```

## Critical Development Patterns

### 1. Database Access

- Import db instance: `import { db } from '@/db/database'`
- All database operations are async: `await db.properties.toArray()`
- Use transactions for atomic multi-table operations
- Relations: `propertyId`, `tenantIds[]`, `leaseId` - manually join with `bulkGet()`
- Example store pattern in `src/features/properties/stores/propertiesStore.ts`

### 2. Feature Module Structure

Each feature follows this pattern (see `src/features/properties/`):

- **views/** - Main pages using standardized view structure (see below)
- **components/** - Feature-specific components
- **stores/** - Pinia store with state/getters/actions pattern
- **types/** - TypeScript interfaces extending db types

### 3. Standardized View Layout

ALL main views use this HTML structure (enforced by `src/shared/styles/views.css`):

```vue
<div class="view-container {feature}-view">
  <header class="view-header">
    <div>
      <h1>Title</h1>
      <div class="header-meta">Metadata</div>
    </div>
    <div class="header-actions">Action buttons</div>
  </header>
  <div class="stats-grid">StatCards (4 columns responsive)</div>
  <div class="filters">Search/filter controls</div>
  <div class="{feature}-grid">Content grid (3 columns, 320px min)</div>
</div>
```

- Container: max-width 1400px, padding 32px
- Stats grid: 4 columns auto-responsive
- Content grid: 3 columns with `minmax(320px, 1fr)`, gap 24px

### 4. Composables Pattern

Shared logic in `src/shared/composables/`:

- `useNotification()` - Toast notifications (type, message, duration)
- `useConfirm()` - Confirmation dialogs
- `useFormatter()` - Format dates, currency, numbers
- `useValidation()` - Form validation with Zod
- `useDataTransfer()` - Import/export JSON/CSV

### 5. Store Pattern

See `src/features/properties/stores/propertiesStore.ts`:

```typescript
export const usePropertiesStore = defineStore('properties', () => {
  // State
  const properties = ref<Property[]>([])
  const isLoading = ref(false)

  // Getters (computed)
  const occupiedProperties = computed(() => ...)

  // Actions (async functions)
  async function fetchProperties() { ... }

  return { properties, isLoading, occupiedProperties, fetchProperties }
})
```

## Essential Commands

```bash
# Development
npm run dev              # Start dev server (port 5173)
npm run build            # Production build
npm run preview          # Preview production build

# Testing
npm test                 # Unit tests (Vitest)
npm run test:coverage    # Coverage report
npm run test:e2e         # E2E tests (Playwright)

# Quality
npm run lint             # ESLint check
npm run format           # Prettier format
npm run type-check       # TypeScript check
```

## Testing Strategy

- **Unit tests**: Vitest with happy-dom (setup in `src/test/setup.ts`)
- **E2E tests**: Playwright (config in `playwright.config.ts`)
- Tests use fake-indexeddb for database mocking
- Coverage target: 70%+ for business logic
- Test files: `*.spec.ts` next to source files

## Code Conventions

### TypeScript

- Strict mode enabled - NO `any` types
- Interfaces for data structures (PascalCase)
- Type imports: `import type { Property } from '@/db/types'`

### Naming

- Components: PascalCase (`PropertyCard.vue`)
- Composables: camelCase + `use` prefix (`useNotification.ts`)
- Stores: camelCase + `Store` suffix (`propertiesStore.ts`)
- Constants: SCREAMING_SNAKE_CASE

### Vue Components

- Use `<script setup lang="ts">` exclusively
- Props with `defineProps<{ ... }>()`
- Emits with `defineEmits<{ ... }>()`
- Scoped styles ONLY for component-specific CSS
- Reuse global styles from `src/shared/styles/`

### CSS Architecture

- **Global styles**: `src/shared/styles/` (variables.css, views.css, global.css)
- **Component styles**: Scoped, only when unique to component
- **DO NOT** duplicate layout styles - extend views.css instead
- Use CSS variables from `variables.css` for colors, spacing, etc.

## Critical Business Logic

### Rental Lifecycle Flow

1. **Property** created with status: `vacant`
2. **Tenant** added with status: `candidate` or `active`
3. **Lease** links property + tenant(s), auto-converts candidates to `active`
4. **Rents** auto-generated monthly based on lease `startDate` and `paymentDay`
5. On lease end: property → `vacant`, tenants → `former`

### Database Relations

```
Property (1) ←─── (N) Lease (N) ───→ (N) Tenant
                      ↓
                   Rent (N)
```

- No foreign key constraints (IndexedDB limitation)
- Manual joins required: `await db.properties.get(lease.propertyId)`

### Validation Rules

- Bail date de fin MUST be after date de début
- Loyer MUST be > 0
- Email tenant MUST be unique
- Document blobs stored with metadata in `documents` table

## Functional Specifications

Functional specs are in `specs/` — one file per domain (properties, tenants, leases, rents, documents, inventories, dashboard, settings, data-transfer). Each spec contains a data model, business rules, Mermaid diagrams, and exhaustive Gherkin user stories.

**Use the `/specs` slash command in Claude Code to navigate specs efficiently:**

```
/specs list
/specs show leases
/specs search "charges adjustment"
/specs stories tenants
```

**Index:** `specs/_index.md`

**Maintenance rule:** Every functional change or bug fix must update the relevant spec. See `CLAUDE.md` for the full protocol.
