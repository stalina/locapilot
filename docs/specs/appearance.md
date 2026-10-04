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
