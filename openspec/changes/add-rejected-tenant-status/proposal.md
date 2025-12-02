# Change: Add 'Candidature refusée' tenant status

## Why

Currently tenant statuses are `active`, `candidate`, and `former`. When a candidate is explicitly refused, the UI and filters should be able to surface that state separately from generic `candidate` items. This change adds a dedicated status to improve clarity and reporting.

## What Changes

- Add a new tenant status value `candidature-refusee` (internally) with display label "Candidature refusée".
- Update database types and schema to accept the new status.
- Update tenants store to provide a computed getter for refused candidates and allow filtering by this status.
- Add OpenSpec deltas for the `tenants` capability.

## Impact

- Affected specs: `specs/tenants/spec.md` (delta)
- Affected code: `src/db/schema.ts`, `src/db/types.ts`, `src/features/tenants/stores/tenantsStore.ts`, UI filter components that read tenant statuses.
