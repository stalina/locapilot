# Tasks for add-rejected-tenant-status

## 1. Implementation

- [ ] Update DB types to include `candidature-refusee` status
- [ ] Update tenants store to expose `refusedTenants` getter and map refused actions to the new status
- [ ] Add OpenSpec delta under `openspec/changes/add-rejected-tenant-status/specs/tenants/spec.md`

## 2. Tests

- [ ] Run unit tests related to tenants
- [ ] Add tests if necessary for new getter

## 3. Documentation

- [ ] Update UI filter labels if present
