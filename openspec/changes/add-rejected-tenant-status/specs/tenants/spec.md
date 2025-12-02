## ADDED Requirements

### Requirement: Refused Candidate Status

The system SHALL provide a distinct tenant status representing a refused application.

#### Scenario: Refused status exists

- **WHEN** a tenant application is refused in the UI or via API
- **THEN** the tenant record SHALL have the status `candidature-refusee`
- **AND** the UI SHALL be able to filter by "Candidature refusée" to show refused applicants only
