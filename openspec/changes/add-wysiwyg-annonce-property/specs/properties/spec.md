## ADDED Requirements

### Requirement: Property Announcement WYSIWYG

The system SHALL provide an editable rich-text field `annonce` on the Property detail view.

#### Scenario: Editor available on PropertyDetailView

- **GIVEN** a user opens a property's detail view
- **WHEN** the view is rendered
- **THEN** an editable WYSIWYG editor is visible, pre-populated with the property's `annonce` value or the default template for new properties

#### Scenario: Default template for new properties

- **GIVEN** a new property is created
- **THEN** its `annonce` field SHALL be initialized with the default template:

```
Particulier loue propriété

Montant du loyer : {LOYER} € / mois.
Montant des charges : {CHARGES} € / mois (provisions sur charges mensuelles et donnant lieu à une régularisation annuelle).
Dépôt de garantie : {GARANTIE} € (1 mois de loyer).
Les premiers contacts seront réalisés par email


Cordialement,

```

#### Scenario: Placeholders formatting

- **GIVEN** a property with numeric values for `rent`, `charges`, `guarantee`
- **WHEN** the `annonce` is previewed or exported
- **THEN** placeholders `{LOYER}`, `{CHARGES}`, `{GARANTIE}` SHALL be replaced with formatted currency values (two decimal places and the euro symbol), derived from the property's amounts

#### Scenario: Persistence and migration

- **GIVEN** existing properties without an `annonce` field in the DB (older version)
- **WHEN** the migration runs
- **THEN** existing properties SHALL keep their data and new `annonce` field SHALL be left empty (or populated with default only for newly created properties).

#### Scenario: Editor parity with description

- **GIVEN** the description editor exists
- **WHEN** a user interacts with the `annonce` editor
- **THEN** the toolbar, allowed formatting and behaviour SHALL match the `description` WYSIWYG to ensure parity and reuse.
