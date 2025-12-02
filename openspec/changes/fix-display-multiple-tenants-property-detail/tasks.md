## 1. Implementation

- [ ] 1.1 Update `PropertyDetailView.vue` to compute all active leases for the property and aggregate `tenantIds`.
- [ ] 1.2 Ensure `tenantsStore.fetchTenants()` called before resolving tenant data.
- [ ] 1.3 Adjust template to render multiple tenants (pluralization, list layout, click navigation).
- [ ] 1.4 Add unit test for component-level logic (or store) verifying multiple tenants rendered.

## 2. Validation

- [ ] 2.1 Run `openspec validate fix-display-multiple-tenants-property-detail --strict` after adding spec.
- [ ] 2.2 Run unit tests: `npm test`.
