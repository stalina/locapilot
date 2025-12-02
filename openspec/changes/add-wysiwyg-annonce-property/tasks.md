## 1. Implementation

- [x] 1.1 Update DB schema: added `annonce?: string` to `Property` in `src/db/schema.ts` and introduced schema version 4.
- [x] 1.2 Update types: `src/db/types.ts` re-exports `Property` from `schema.ts` (which includes `annonce`).
- [x] 1.3 Reuse WYSIWYG component: added inline editor in `PropertyDetailView.vue` using `RichTextEditor` and `RichTextDisplay`.
- [x] 1.4 Default template: new properties are initialized with a default template via `defaultAnnonceTemplate()` in `PropertyFormModal.vue`.
- [x] 1.5 Placeholder formatting helper: added `src/shared/utils/annonceTemplate.ts` with `formatAnnoncePlaceholders()` and `defaultAnnonceTemplate()`.
- [x] 1.6 Tests: added unit tests for the helper and a component test for the modal (`annonceTemplate.spec.ts`, `PropertyFormModal.spec.ts`).

## 2. Migration

- Added migration entry (version 4) in `src/db/migrations.ts`. Behavior: backward compatible — existing properties keep their data; `annonce` remains empty for existing records. If desired, a follow-up migration can populate existing records with the default template.

## 3. Docs

- `openspec/changes/add-wysiwyg-annonce-property/specs/properties/spec.md` updated with the new requirement and scenarios.
