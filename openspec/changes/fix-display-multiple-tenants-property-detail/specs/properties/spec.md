## ADDED Requirements

### Requirement: Property detail shows all current tenants

The Property detail view SHALL display all tenants linked to the property via any active lease(s). If multiple leases reference different tenant IDs (or a single lease references multiple tenantIds), the view SHALL list every distinct tenant.

#### Scenario: Multiple tenants displayed

- **GIVEN** a property with multiple active leases or leases that include multiple `tenantIds`
- **WHEN** the user opens the Property detail view
- **THEN** the view SHALL display a list of all distinct tenants (name + email) and allow navigation to each tenant's detail page.
