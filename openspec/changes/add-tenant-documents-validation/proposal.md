# Change: allow attaching documents to tenant and validate/refuse applications

## Why

Currently tenants cannot have arbitrary documents attached to their profile. Adding document attachments allows the application process to collect identity or supporting documents and enables an explicit validation/refusal workflow for tenant applications.

## What Changes

- **ADDED**: New tenant documents capability in specs and implementation tasks.
- **ADDED**: UI screens/components to upload and list documents on tenant profile.
- **ADDED**: Database schema additions to store document metadata and link to tenant.
- **ADDED**: Actions to mark tenant application as `validated` or `refused` with optional reasons and attached documents as evidence.

## Impact

- Affected specs: `specs/tenants/spec.md`
- Affected code: `src/features/tenants/*`, `src/db/schema.ts`, `src/shared/composables/useDataTransfer.ts`
