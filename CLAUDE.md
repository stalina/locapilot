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

---

## Mandatory TypeScript Strictness Rule

> **NEVER use the `any` type, and NEVER use `@ts-ignore` or `@ts-expect-error` to silence the type-checker.**

This rule applies without exception. TypeScript runs in strict mode — escaping it defeats the purpose.

- **No `any`.** Type things properly instead: use `unknown` with narrowing, generics, discriminated unions, or precise interfaces/`type` aliases.
- **No `@ts-ignore` / `@ts-expect-error`.** If the compiler complains, fix the underlying type — don't suppress the error.
- **Third-party gaps:** when an external library ships wrong or missing types, add or augment a `.d.ts` declaration rather than casting through `any`.
- If you genuinely believe a suppression is unavoidable, stop and ask the user before adding it — do not add it silently.

---

## Mandatory Test Coverage Rule

> **Every functional change MUST be covered by tests.**

This rule applies without exception alongside the spec maintenance rule.

### Unit tests (Vitest)

- **Where:** Place the `.spec.ts` file next to the source file it tests (e.g. `myService.spec.ts` beside `myService.ts`).
- **What to cover:** All new functions, class methods, and branches introduced. Mock external dependencies with `vi.mock()`.
- **Pattern:** `describe` → `it` with explicit assertions. See `src/features/rents/services/rentsService.spec.ts` for a reference.

### E2E tests (Playwright)

- **Where:** `e2e/` directory. Add a new `test.describe` block to the relevant spec file (e.g. `e2e/settings.spec.ts`).
- **What to cover:** The main happy-path scenario only — verify that the feature works end-to-end in the real browser.
- **Pattern:** `resetApp` in `beforeEach`, navigate via `navigateFromSidebar`, use `data-testid` or role-based locators. See `e2e/settings.spec.ts` for a reference.
- **Scope:** One test per feature covering the golden path. Edge-case coverage belongs in unit tests, not E2E.

---

## Mandatory Commit, Push and PR Rule

> **Once `type-check` and all tests pass, always commit on a new branch, push to origin, and open a pull request.**

This rule applies without exception at the end of every implementation task.

### Steps to follow

1. `npm run type-check && npm test` — must be green before committing
2. `git checkout -b <branch>` — branch name: `feat/`, `fix/`, or `chore/` prefix + kebab-case description
3. `git add <files>` — stage only the files changed for this task (never `git add .` blindly)
4. `git commit -m "<message>"` — conventional commit format: `type(scope): description`
5. `git push -u origin <branch>`
6. Create the PR via GitHub API (curl) — title mirrors the commit, body includes Summary, Test plan, and `Closes #<issue>` if applicable

### Commit message format

```
feat(scope): short description in imperative mood

- bullet 1
- bullet 2

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

### PR body format

```markdown
## Summary

- bullet points

## Test plan

- [ ] type-check passes
- [ ] unit tests pass
- [ ] E2E tests pass
- [ ] manual verification steps

Closes #<issue>
```

## Functional Specifications

All functional specs live in `docs/specs/` — one Markdown file per domain with data models, business rules, Mermaid diagrams, and Gherkin user stories.

**Use the `/specs` slash command to navigate specs without loading all files:**

```
/specs list                       # List all domains with summaries
/specs show leases                # Full spec for leases
/specs search "charges"           # Search across all specs
/specs stories tenants            # List user stories for tenants
/specs scenarios rents            # All scenarios for rents, grouped by story
/specs scenario properties "delete"  # Full story+scenarios matching "delete"
```

**Index and relationships:** `docs/specs/_index.md`

---

## Mandatory Spec Maintenance Rule

> **Every functional change or bug fix MUST be reflected in the specs.**

This rule applies without exception. Before closing any task:

### When adding a feature or new behavior

1. Identify the domain(s) in `docs/specs/` — use `/specs search <keyword>` to check if it already exists
2. If a new User Story is needed: add it to the relevant `docs/specs/<domain>.md` following the existing format
3. Write exhaustive Gherkin scenarios: happy path + error cases + edge cases
4. If new fields were added to the database: update the Data Model table in the spec
5. If entity relationships changed: update the Mermaid `erDiagram`

### When fixing a bug

1. Ask: does this bug reveal a missing or incorrect Gherkin scenario?
2. If yes: add or correct the scenario in `docs/specs/<domain>.md`
3. A bug that had no scenario covering it = an implicit spec gap — fill it

### When modifying the database schema

1. Update the Data Model table in the relevant spec file(s)
2. Update Mermaid diagrams if relationships changed
3. Update `docs/specs/_index.md` entity relationship diagram if needed

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
