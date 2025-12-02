# Implementation Summary - add-wysiwyg-annonce-property

## Overview

This change adds an editable "annonce" (rich-text) field to properties. It includes:

- DB schema update (optional field `annonce`)
- WYSIWYG editor in the property's detail view
- Default template for new properties
- Placeholder formatting helper and plain-text copy functionality
- Unit tests for the helper and a component-level test for the modal

## Files changed

- `src/db/schema.ts` (added `annonce?: string`, version 4)
- `src/db/migrations.ts` (migration entry for version 4)
- `src/features/properties/components/PropertyFormModal.vue` (initialize `annonce` on create)
- `src/features/properties/views/PropertyDetailView.vue` (editor + preview + copy button)
- `src/shared/utils/annonceTemplate.ts` (default template + placeholder formatter)
- `src/shared/utils/annonceTemplate.spec.ts` (unit tests)
- `src/features/properties/components/PropertyFormModal.spec.ts` (component test)
- `openspec/changes/add-wysiwyg-annonce-property/*` (proposal, tasks, spec delta)

## Notes

- Migration is backward compatible: existing properties are not modified automatically.
- The copy-to-clipboard functionality copies plain text (HTML stripped and line breaks preserved) and uses `navigator.clipboard`.
