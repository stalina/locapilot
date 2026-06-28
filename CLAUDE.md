# Locapilot — Claude Code Project Instructions

## Project Overview

**Locapilot** is an offline-first PWA for rental property management. It runs entirely in the browser with no backend — all data is stored in IndexedDB via Dexie.js. Built with Vue 3 (Composition API, `<script setup>`), TypeScript strict mode, Pinia, and Vite.

For the full architecture reference (patterns, component conventions, store structure, CSS architecture, database access), read `.github/copilot-instructions.md`.

## Essential Commands

```bash
npm run dev            # Dev server on :5173
npm run type-check     # TypeScript check (run before committing)
npm test               # Vitest unit tests
npm run test:coverage  # Coverage report (target: 70%)
npm run test:e2e       # Playwright E2E tests
npm run lint           # ESLint
npm run format         # Prettier
npm run build          # Production build
```

**After any code change, always run:**

```bash
npm run type-check && npm test
```

## Functional Specifications

All functional specs live in `specs/` — one Markdown file per domain with data models, business rules, Mermaid diagrams, and Gherkin user stories.

**Use the `/specs` slash command to navigate specs without loading all files:**

```
/specs list                       # List all domains with summaries
/specs show leases                # Full spec for leases
/specs search "charges"           # Search across all specs
/specs stories tenants            # List user stories for tenants
/specs scenarios rents            # All scenarios for rents, grouped by story
/specs scenario properties "delete"  # Full story+scenarios matching "delete"
```

**Index and relationships:** `specs/_index.md`

---

## Mandatory Spec Maintenance Rule

> **Every functional change or bug fix MUST be reflected in the specs.**

This rule applies without exception. Before closing any task:

### When adding a feature or new behavior

1. Identify the domain(s) in `specs/` — use `/specs search <keyword>` to check if it already exists
2. If a new User Story is needed: add it to the relevant `specs/<domain>.md` following the existing format
3. Write exhaustive Gherkin scenarios: happy path + error cases + edge cases
4. If new fields were added to the database: update the Data Model table in the spec
5. If entity relationships changed: update the Mermaid `erDiagram`

### When fixing a bug

1. Ask: does this bug reveal a missing or incorrect Gherkin scenario?
2. If yes: add or correct the scenario in `specs/<domain>.md`
3. A bug that had no scenario covering it = an implicit spec gap — fill it

### When modifying the database schema

1. Update the Data Model table in the relevant spec file(s)
2. Update Mermaid diagrams if relationships changed
3. Update `specs/_index.md` entity relationship diagram if needed

### Format to follow

```markdown
### Story: [Verb + noun describing the user goal]

**As a** landlord
**I want to** [action]
**So that** [value/outcome]

#### Scenario: [Concise description of the case]

\`\`\`gherkin
Given [initial context]
When [action taken]
Then [expected outcome]
And [additional assertion]
\`\`\`
```

**Story titles** must start with a verb (e.g. "Create a lease", "Filter tenants by status").  
**Scenario titles** must describe the specific case (e.g. "Successful creation", "Attempt with duplicate email").

---

## Key Business Logic (quick reference)

For full details, use `/specs show <domain>`.

- **Property statuses:** `vacant` → `occupied` (when lease activates) → `vacant` (when lease ends) / `maintenance` (manual)
- **Tenant statuses:** `candidate` → `active` (validated or lease created) → `former` (lease ended) / `candidature-refusee` (refused)
- **Lease statuses:** `pending` → `active` → `ended` (terminated)
- **Rent statuses:** `pending` → `paid` / `partial` / `late` (auto-detected when past due date)
- **Email uniqueness:** tenant emails must be unique across the entire database
- **Rent auto-generation:** rents are generated from active leases using `paymentDay` — no duplicates per month/lease
- **No foreign key constraints** in IndexedDB — manual joins with `bulkGet()` required
- **Lease termination cascade:** property → `vacant`, all tenants → `former`, no further rents generated

## Database Access Pattern

```typescript
import { db } from '@/db/database';

// Always async
const properties = await db.properties.toArray();
const lease = await db.leases.get(leaseId);

// Multi-table atomic operations
await db.transaction('rw', [db.leases, db.properties], async () => {
  await db.leases.update(id, { status: 'ended' });
  await db.properties.update(propertyId, { status: 'vacant' });
});
```
