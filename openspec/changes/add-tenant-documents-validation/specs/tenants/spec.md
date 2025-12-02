## ADDED Requirements

### Requirement: Tenant Document Attachments

The system SHALL allow attaching one or more documents to a tenant's profile. Documents SHALL include metadata: `id`, `tenantId`, `name`, `type`, `size`, `uploadedAt`, `mimeType`, and optional `notes`.

#### Scenario: Uploading a document

- **WHEN** a user uploads a document from the tenant profile
- **THEN** the document metadata is saved in the database and the file blob is stored in the documents table
- **AND** the UI shows the uploaded document in the tenant's documents list

#### Scenario: Listing documents

- **WHEN** a tenant profile is opened
- **THEN** all documents attached to the tenant are listed sorted by `uploadedAt` descending

#### Scenario: Removing a document

- **WHEN** a user removes a document from the tenant profile
- **THEN** the document metadata and blob are deleted from the database

### Requirement: Tenant Application Validation Workflow

The system SHALL provide actions to validate or refuse a tenant's application. Validation state values SHALL include `candidate` (default), `validated`, and `refused`.

#### Scenario: Validate an application

- **WHEN** a user marks a tenant application as `validated`
- **THEN** the tenant's status changes to `validated`
- **AND** an audit entry is stored with the acting user id, timestamp, optional notes and references to attached documents used as evidence

#### Scenario: Refuse an application with evidence

- **WHEN** a user marks a tenant application as `refused` and attaches one or more documents as evidence
- **THEN** the tenant's status changes to `refused`
- **AND** an audit entry is stored with reason, acting user id, timestamp and linked document ids
