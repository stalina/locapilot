# Settings Specifications

## Overview

The **settings** module allows the landlord to configure application-wide preferences. Settings are stored as key-value pairs in IndexedDB and persist across sessions. Currently the primary setting is the owner name, which is used in generated documents such as rent receipts. The settings page also serves as the entry point for data management (import/export — see [Data Transfer spec](./data-transfer.md)).

## Data Model

### Settings (key-value store)

| Field       | Type    | Description                                     |
| ----------- | ------- | ----------------------------------------------- |
| `id`        | number  | Auto-generated primary key                      |
| `key`       | string  | Unique setting identifier (e.g. `ownerName`)    |
| `value`     | unknown | Setting value (string, number, boolean, object) |
| `updatedAt` | Date    | Last update timestamp                           |

### Known Settings Keys

| Key         | Type   | Description                                  |
| ----------- | ------ | -------------------------------------------- |
| `ownerName` | string | Landlord's full name — used in rent receipts |

## Domain Rules

- Each `key` is unique — there cannot be two settings with the same key
- `value` can be any serializable type
- Settings persist across browser sessions (stored in IndexedDB)
- Changing a setting takes effect immediately for new operations (e.g. receipt generation uses the new owner name)

---

## User Stories

### Story: Configure owner name

**As a** landlord  
**I want to** set my name in the application settings  
**So that** it appears correctly on rent receipts and other documents

#### Scenario: Set owner name for the first time

```gherkin
Given I open the Settings page
And the "Owner name" field is empty
When I type "Jean-Pierre Martin"
And I click "Save"
Then the value is persisted in the settings store under key "ownerName"
And a success notification appears: "Setting saved"
And if I reload the page, the field still shows "Jean-Pierre Martin"
```

#### Scenario: Update an existing owner name

```gherkin
Given the owner name is currently "Jean Martin"
When I change it to "Jean-Pierre Martin"
And I click "Save"
Then the updated value is stored
And updatedAt is refreshed
And the new name will appear on all subsequently generated receipts
```

#### Scenario: Clear owner name

```gherkin
Given the owner name is "Jean-Pierre Martin"
When I clear the field and click "Save"
Then ownerName is stored as an empty string
And future receipts will have no owner name printed
```

#### Scenario: Setting persists after page reload

```gherkin
Given I have saved owner name "Jean-Pierre Martin"
When I reload the application
And I navigate to Settings
Then the owner name field still shows "Jean-Pierre Martin"
```

---

### Story: Navigate to data management

**As a** landlord  
**I want to** access data export and import from the Settings page  
**So that** I can back up or restore my data

#### Scenario: Access export functionality

```gherkin
Given I am on the Settings page
When I click on the "Export data" section or button
Then I am presented with the data export interface
(See data-transfer.md for export scenarios)
```

#### Scenario: Access import functionality

```gherkin
Given I am on the Settings page
When I click on the "Import data" section or button
Then I am presented with the data import interface with an appropriate warning
(See data-transfer.md for import scenarios)
```
