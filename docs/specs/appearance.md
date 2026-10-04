# Appearance Specifications

## Overview

The **appearance** module is a cross-cutting concern covering the visual theme. Locapilot follows the operating system's light or dark preference (`prefers-color-scheme`): there is no in-app toggle. The dark theme is implemented by redefining the semantic design tokens in `src/assets/styles/variables.css`, so every component that paints its surfaces and text with those tokens switches theme automatically, live, without a reload.

## Data Model

None — the theme is derived from the OS preference at runtime and nothing is persisted.

## Domain Rules

- The theme follows `prefers-color-scheme`; switching the OS theme updates the open page immediately, including any open dialog.
- Surfaces and neutral text use the semantic tokens, which have a light and a dark value:

  | Token              | Light         | Dark          |
  | ------------------ | ------------- | ------------- |
  | `--bg-primary`     | `#ffffff`     | `neutral-900` |
  | `--bg-secondary`   | `neutral-50`  | `neutral-800` |
  | `--bg-tertiary`    | `neutral-100` | `neutral-700` |
  | `--text-primary`   | `neutral-900` | `neutral-50`  |
  | `--text-secondary` | `neutral-600` | `neutral-300` |
  | `--text-tertiary`  | `neutral-400` | `neutral-500` |
  | `--border-color`   | `neutral-200` | `neutral-700` |

- A background behind `--text-*` text must follow the theme as well: it must never be a hard-coded light colour (`white`, `#fff`, a fixed neutral grey), otherwise the near-white dark-mode text becomes unreadable.
- Text keeps a contrast ratio of at least **4.5:1** (WCAG AA) against its background in both themes, at rest and on hover.
- Neutral buttons (`secondary`, `default`, `ghost`, `text`) show a visible hover state in both themes.
- Coloured buttons (`primary`, `success`, `warning`, `error`/`danger`) keep white text on their saturated background in both themes.
- The light theme is the reference design: making a component follow the dark theme must not change its light-mode colours.
- Form fields (`Input`, `Select`, the native selects and text areas of the property form), cards (property, tenant, statistic, document), the search box, the rent calendar, toast notifications, the confirmation dialog, tables and pagination paint their surfaces with `--bg-primary` (`--bg-secondary` / `--bg-tertiary` for headers, footers and hovers).
- The shared view panels of `src/assets/styles/views.css` follow the theme the same way: dashboard sections (`.section-card`), view cards (`.card`, e.g. on the tenant detail page and the rent calendar), the filter bar of the list views (`.filters`) with its sort select, and the document upload progress.
- Light colours that are not on the neutral scale (the grey hex values of the confirmation dialog, toasts, tables and pagination) have no semantic token with the same light value: they keep it, and a dark-only `@media (prefers-color-scheme: dark)` block maps them to the semantic tokens.
- Coloured text that falls below 4.5:1 on a dark surface uses another shade of its palette in dark mode only:

  | Usage                                                                                                                 | Light                       | Dark                        |
  | --------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------- |
  | Outline button text, monthly rent, sorted column, section link, dashboard event and schedule dates, upload percentage | `primary-600` / `#3b82f6`   | `primary-300`               |
  | Outline button hover background, hovered current property on the tenant detail page                                   | `primary-50`                | `primary-900`               |
  | Field error message, expired diagnostic date, view error state                                                        | `error-600`                 | `error-500`                 |
  | Statistic card trend (up / down)                                                                                      | `success-700` / `error-700` | `success-500` / `error-500` |

- In dark mode, form fields and the list views' sort select use `color-scheme: dark`, so their native parts (date picker icon, option list, resize grip) are drawn for a dark background.
- Self-contained tinted pills (status and document-type badges, statistic icons, calendar rent events, the calendar's "Aujourd'hui" button) keep their light tint in both themes: their text is readable on their own background.
- The PDF thumbnail of a document card keeps a white backdrop in both themes, as it shows a paper page.
- `--text-tertiary` (placeholders, icons, secondary metadata) is outside the 4.5:1 rule: 2.5:1 in the light reference design, 3.8:1 in dark mode. Pairs the light reference design already places below 4.5:1 (hovered and sorted table headers) keep their light value.

---

## User Stories

### Story: Use the application in dark mode

**As a** landlord whose device is set to dark mode
**I want to** have dialogs and buttons follow the dark theme
**So that** I can read and use every form without switching my device back to light mode

#### Scenario: A dialog follows the dark theme

```gherkin
Given my device is set to dark mode
When I open the "Nouveau bien" dialog from the properties list
Then the dialog surface is dark (neutral-900)
And its title, section headings and field labels are light and readable
And the header and footer separators use the dark border colour
```

#### Scenario: The cancel button of a form stays readable in dark mode

```gherkin
Given my device is set to dark mode
And the "Nouveau bien" dialog is open
Then the "Annuler" button has a dark neutral background with light text
When I click "Annuler"
Then the dialog closes without creating a property
```

#### Scenario: Secondary buttons stay readable in dark mode

```gherkin
Given my device is set to dark mode
When I open the settings page
Then the "Exporter", "Importer", "Héberger" and "Se connecter" buttons have a dark neutral background with light text
```

#### Scenario: Hovering a neutral button in dark mode

```gherkin
Given my device is set to dark mode
When I hover the "Annuler" button of the "Nouveau bien" dialog
Then its background becomes a lighter dark grey (neutral-600)
And its text stays light and readable
```

#### Scenario: Hovering a ghost button in a dark-mode dialog

```gherkin
Given my device is set to dark mode
And the "Refuser la candidature" dialog is open for a candidate tenant
When I hover the "Annuler" button
Then its background becomes dark grey (neutral-700)
And its text stays light and readable
When I click "Annuler"
Then the dialog closes and the tenant remains a candidate
```

#### Scenario: Light mode is unchanged

```gherkin
Given my device is set to light mode
When I open the "Nouveau bien" dialog
Then the dialog surface is white with dark text
And the "Annuler" button keeps its light grey background (neutral-200, neutral-300 on hover)
And the settings "Exporter" button keeps its light grey background (neutral-100, neutral-200 on hover)
```

#### Scenario: Switching the device theme while a dialog is open

```gherkin
Given my device is set to light mode
And the "Nouveau bien" dialog is open
When I switch my device to dark mode
Then the dialog surface and its buttons switch to the dark theme immediately
And the form content I already typed is kept
```

#### Scenario: Dialogs on a mobile screen follow the theme

```gherkin
Given my device is a phone set to dark mode
When I open the "Nouveau bien" dialog
Then the dialog fills the screen with a dark surface
And its title and the "Annuler" button are readable
```

### Story: Fill in a form in dark mode

**As a** landlord whose device is set to dark mode
**I want to** read what I type in form fields
**So that** I can enter a property, a tenant or a lease without mistakes

#### Scenario: Typed values stay readable in the property form

```gherkin
Given my device is set to dark mode
And the "Nouveau bien" dialog is open
When I type "Appartement Lumière" in "Nom du bien", "75011" in "Code postal" and "42" in "Surface (m²)"
Then each field has a dark surface (neutral-900)
And the typed text is light and readable
```

#### Scenario: The selected property type stays readable

```gherkin
Given my device is set to dark mode
And the "Nouveau bien" dialog is open
When I choose "Maison" in "Type de bien"
Then the field shows "Maison" in light text on a dark surface
And its option list opens with dark native styling
```

#### Scenario: A field error stays readable in dark mode

```gherkin
Given my device is set to dark mode
And the "Nouveau locataire" dialog is open
When I submit the form without a first name
Then the error message under "Prénom" is red (error-500) and readable on the dark dialog surface
```

#### Scenario: The date picker of a date field is visible in dark mode

```gherkin
Given my device is set to dark mode
When I open the lease creation dialog
Then the "Date de début" and "Date de fin" fields have a dark surface
And their calendar icon is light and visible
```

#### Scenario: A created property stays readable in dark mode

```gherkin
Given my device is set to dark mode
And I filled in the "Nouveau bien" form
When I click "Créer"
Then the property card appears in the list with a dark surface
And its name and its monthly rent are readable
```

#### Scenario: Form fields keep their light look in light mode

```gherkin
Given my device is set to light mode
When I open the "Nouveau bien" dialog
Then the fields, including "Type de bien", are white with dark text
And a field error message is red (error-600)
```

### Story: Browse lists and cards in dark mode

**As a** landlord whose device is set to dark mode
**I want to** have cards, lists and the calendar follow the dark theme
**So that** I can read my properties, tenants, documents and rents at a glance

#### Scenario: Property and tenant cards follow the dark theme

```gherkin
Given my device is set to dark mode
When I open the properties list
Then each property card has a dark surface with a light name and address
And its monthly rent is light indigo (primary-300)
When I open the tenants list
Then each tenant card has a dark surface with a light name, email and phone
```

#### Scenario: Statistic cards follow the dark theme

```gherkin
Given my device is set to dark mode
When I open the dashboard
Then the statistic cards have a dark surface with light values and labels
And an upward trend is green (success-500), a downward trend red (error-500)
```

#### Scenario: The search box follows the dark theme

```gherkin
Given my device is set to dark mode
When I type "Lumi" in the search box of the properties list
Then the search box has a dark surface and the typed text is readable
```

#### Scenario: Document cards follow the dark theme

```gherkin
Given my device is set to dark mode
When I open the documents list
Then each document card has a dark surface with a light name and description
And an expired diagnostic shows "Expiré le" in red (error-500), readable
And a PDF thumbnail keeps a white page
```

#### Scenario: The rent calendar follows the dark theme

```gherkin
Given my device is set to dark mode
When I open the rent calendar
Then the calendar has a dark surface with a light month name and weekday headings
And the rent events keep their coloured tints
And the "Prochaines échéances" and "Légende" cards have a dark surface with light titles
```

#### Scenario: Dashboard sections follow the dark theme

```gherkin
Given my device is set to dark mode
When I open the dashboard
Then the "Activité récente", "À venir", "Échéancier" and "Analyse" sections have a dark surface
And their titles, activity titles and descriptions are light and readable
And the event and schedule dates are light indigo (primary-300)
```

#### Scenario: The filter bar of a list follows the dark theme

```gherkin
Given my device is set to dark mode
When I open the properties list
Then the filter bar has a dark surface with readable "Type", "Statut" and "Trier par" labels
And the "Trier par" select has a dark surface with light text and a dark option list
When I choose the "Maisons" filter
Then the active filter keeps its light indigo tint and the list shows only houses
```

#### Scenario: The tenant detail cards follow the dark theme

```gherkin
Given my device is set to dark mode
And a tenant has an active lease
When I open the tenant's detail page
Then the "Informations générales", "Bien occupé" and "Historique des baux" cards have a dark surface with light titles and values
And the lease's monthly rent is light indigo (primary-300)
When I hover the occupied property
Then its background becomes dark indigo (primary-900) and its address stays readable
```

#### Scenario: A list view error stays readable in dark mode

```gherkin
Given my device is set to dark mode
When a list view fails to load its data
Then the error message is red (error-500) and readable on the dark page
```

#### Scenario: Cards keep their light look in light mode

```gherkin
Given my device is set to light mode
When I open the properties list
Then the property cards, statistic cards, search box and filter bar are white
And the monthly rent is indigo (primary-600)
When I open the dashboard
Then its sections are white and the schedule dates are indigo (primary-600)
```

### Story: Read notifications and confirmations in dark mode

**As a** landlord whose device is set to dark mode
**I want to** read toasts and confirmation dialogs
**So that** I understand what happened and what I am about to confirm

#### Scenario: A confirmation dialog follows the dark theme

```gherkin
Given my device is set to dark mode
And I am on a lease detail page
When I click "Supprimer"
Then the "Supprimer le bail" dialog has a dark surface with a light title and message
And its footer is dark grey (neutral-800)
And its "Annuler" button has light text and turns neutral-700 on hover
When I click "Annuler"
Then the dialog closes and the lease is kept
```

#### Scenario: A toast notification follows the dark theme

```gherkin
Given my device is set to dark mode
And I am on a property detail page
When I copy the listing text
Then the "Annonce copiée dans le presse-papier" toast has a dark surface with light text
And its close button is light grey and turns lighter on hover
```

#### Scenario: Confirmation dialogs keep their light look in light mode

```gherkin
Given my device is set to light mode
When the "Supprimer le bail" dialog opens
Then it is white with a dark title, a light grey footer and a white "Annuler" button
```

### Story: Use outline buttons in dark mode

**As a** landlord whose device is set to dark mode
**I want to** read outline buttons
**So that** I can find secondary actions such as "Retour" or "Nouvelle propriété"

#### Scenario: An outline button stays readable in dark mode

```gherkin
Given my device is set to dark mode
When I open the dashboard
Then the "Nouvelle propriété" quick action has light indigo text (primary-300) and an indigo border on the dark section
When I hover the button
Then its background becomes dark indigo (primary-900)
And its text stays readable
When I click it
Then the "Nouveau bien" dialog opens
```

#### Scenario: Outline buttons keep their light look in light mode

```gherkin
Given my device is set to light mode
When I hover an outline button
Then its text stays indigo (primary-600) and its background becomes primary-50
```
