# Fiscal Summary Specifications

## Overview

The **fiscal summary** ("Récapitulatif fiscal") is a yearly, read-only report that helps the
landlord fill in the French annual rental income tax return for unfurnished rentals
(**déclaration n° 2044 — revenus fonciers, régime réel**). For a selected calendar year it shows:

1. the **rent income collected** per property (excluding charges);
2. the **deductible expenses** per property, grouped by CERFA 2044 line (based on the
   [Expenses](./expenses.md) module);
3. a **2044 table**: one column per property, one row per 2044 line, with the net rental result
   (income or deficit) per property and in total.

The report can be exported as a **CSV file** (for a spreadsheet or an accountant) and **printed /
saved as PDF** from the browser.

The report is an **aid to the declaration**, not tax advice. It never writes any data: every figure
is computed on the fly from Properties, Leases, Rents and Expenses. It has no table of its own and
nothing to back up.

## Data Model

No new table. The report is derived from:

| Source     | Fields used                                                                     |
| ---------- | ------------------------------------------------------------------------------- |
| `Property` | `id`, `name`, `address`, `postalCode`, `town`                                   |
| `Lease`    | `id`, `propertyId` (to attach rents to a property; active **and** ended leases) |
| `Rent`     | `leaseId`, `status`, `amount`, `charges`, `paidAmount`, `paidDate`, `dueDate`   |
| `Expense`  | `propertyId`, `category`, `label`, `amount`, `date`                             |

### Mapping of expense categories to CERFA 2044 lines

| Expense category  | UI label (FR)          | 2044 line | 2044 label (FR)                                                  |
| ----------------- | ---------------------- | --------- | ---------------------------------------------------------------- |
| `management-fees` | Frais de gestion       | 221       | Frais d'administration et de gestion                             |
| `insurance`       | Assurance (PNO)        | 223       | Primes d'assurance                                               |
| `works`           | Travaux                | 224       | Dépenses de réparation, d'entretien et d'amélioration            |
| `maintenance`     | Entretien              | 224       | Dépenses de réparation, d'entretien et d'amélioration            |
| `property-tax`    | Taxe foncière          | 227       | Taxes foncières                                                  |
| `condo-fees`      | Charges de copropriété | 229       | Provisions pour charges de copropriété payées                    |
| `loan-interest`   | Intérêts d'emprunt     | 250       | Intérêts d'emprunt                                               |
| `other`           | Autre                  | —         | Not mapped: listed as "Dépenses non ventilées", **not deducted** |

### 2044 lines produced per property

| Line | Label (FR)                                                       | Computation                                                     |
| ---- | ---------------------------------------------------------------- | --------------------------------------------------------------- |
| 211  | Loyers bruts encaissés                                           | Collected rent income excl. charges of year Y (see rules below) |
| 212  | Dépenses mises par convention à la charge des locataires         | Not tracked → 0, flagged "À compléter manuellement"             |
| 213  | Subventions et indemnités d'assurance                            | Not tracked → 0, flagged "À compléter manuellement"             |
| 214  | Total des recettes                                               | 211 + 212 + 213                                                 |
| 221  | Frais d'administration et de gestion                             | Σ `management-fees` expenses of Y                               |
| 222  | Autres frais de gestion (forfait)                                | 20 € if line 211 > 0 for the property, else 0                   |
| 223  | Primes d'assurance                                               | Σ `insurance` expenses of Y                                     |
| 224  | Dépenses de réparation, d'entretien et d'amélioration            | Σ `works` + `maintenance` expenses of Y                         |
| 225  | Charges récupérables non récupérées au départ du locataire       | Not tracked → 0, flagged "À compléter manuellement"             |
| 226  | Indemnités d'éviction, frais de relogement                       | Not tracked → 0, flagged "À compléter manuellement"             |
| 227  | Taxes foncières                                                  | Σ `property-tax` expenses of Y                                  |
| 228  | Déductions spécifiques                                           | Not tracked → 0, flagged "À compléter manuellement"             |
| 229  | Provisions pour charges de copropriété payées                    | Σ `condo-fees` expenses of Y                                    |
| 230  | Régularisation des provisions pour charges de copropriété de N-1 | Not tracked → 0, flagged "À compléter manuellement"             |
| 240  | Total des frais et charges                                       | 221 + 222 + 223 + 224 + 225 + 226 + 227 + 228 + 229 − 230       |
| 250  | Intérêts d'emprunt                                               | Σ `loan-interest` expenses of Y                                 |
| 261  | Revenu foncier taxable (bénéfice ou déficit)                     | 214 − 240 − 250 (can be negative = déficit foncier)             |

## Business Rules

### Access

- The report is reachable from a sidebar entry **"Fiscalité"** (route `/fiscal`, view title
  "Récapitulatif fiscal").
- The report is read-only: no field of any entity can be modified from it.

### Year selection

- The landlord selects a calendar year `Y`. It **defaults to the previous calendar year** (the
  return filed in spring covers the previous year).
- The year selector lists every year that has at least one collected rent (`paid` / `partial`) or
  one expense on any existing property, plus the current year and the previous year, sorted
  descending.

### Properties included

- The report lists every **existing** property having, in year `Y`, at least one collected rent or
  one expense. Properties with neither are not listed.
- Each listed property has an **"Inclure dans la 2044"** checkbox, checked by default. Unchecking
  it removes the property from the 2044 table, from the totals and from the exports; the property
  stays visible in the income recap with the badge "Exclu".
- The inclusion choice is not persisted: it is reset when the page is reloaded or the year changes.
- Rents attached to a lease whose property no longer exists, and orphan rents whose lease no longer
  exists, are ignored without error.
- A permanent information banner states: "La déclaration 2044 concerne les locations nues. Les
  locations meublées (LMNP) relèvent des BIC : décochez les biens concernés."

### Income (line 211)

Same rules as the [profitability income](./expenses.md) — the implementation must **reuse**
`collectedRentShare` / `computeIncome` of `expensesService`:

- every rent of every lease (active or ended) of the property, with status `paid` or `partial`,
  whose `paidDate` (falling back to `dueDate`) falls in year `Y`;
- `paid` → `amount`; `partial` → `paidAmount × amount / (amount + charges)` rounded to the cent
  (0 when `amount + charges` is 0); `pending` / `late` → 0;
- charges provisions are **excluded** from line 211.

The income recap also shows, per property and for information only, the **charges collected**
(`charges` for a `paid` rent, `paidAmount − rent share` for a `partial` rent) and the **number of
rents collected** (paid or partial) in year `Y`.

### Expenses

- An expense counts in year `Y` when its `date` falls in `Y` (same rule as the Expenses module).
- Each expense is attributed to its 2044 line according to the mapping table above.
- Expenses of category `other` are **never deducted**: they are listed in a "Dépenses non
  ventilées" block with their total and the hint "Reclassez ces dépenses dans une catégorie
  déductible si elles le sont".
- The expense detail lists, per property, every expense of `Y` (date, category, label, amount,
  2044 line), sorted by date ascending.
- Line 227 shows the hint "Hors taxe d'enlèvement des ordures ménagères (TEOM), récupérable auprès
  du locataire".
- Line 224 shows the hint "Les travaux de construction ou d'agrandissement ne sont pas
  déductibles".

### Amounts and rounding

- All intermediate sums are computed to the cent.
- The **2044 table** displays amounts **rounded to the nearest euro** (x,50 rounds up), as required
  by the form. Each detail line (211, 212, 213, 221 to 230, 250) is rounded **per property**; the
  totals (214, 240, 261) are computed **from the rounded lines** so that the table adds up exactly.
  The "Total" column is the sum of the property columns.
- The income recap and the expense detail display amounts to the cent ("1 250,49 €").
- A negative line 261 is displayed with the danger color and the label "Déficit foncier".
- When the total of line 211 for the included properties is **≤ 15 000 €**, an informative hint is
  shown: "Vos revenus bruts sont inférieurs ou égaux à 15 000 € : vous pouvez relever du régime
  micro-foncier (case 4BE de la déclaration 2042) au lieu de la 2044."
- A disclaimer is always shown (screen, print and CSV): "Document d'aide à la déclaration —
  vérifiez les montants avant de les reporter. Locapilot ne fournit pas de conseil fiscal."

### Exports

- **CSV export** ("Exporter en CSV"): downloads `recapitulatif-fiscal-<Y>.csv`, UTF-8 with BOM,
  `;` as separator, amounts written as whole euros (the rounded values of the 2044 table) with no
  thousands separator and a leading `-` when negative (e.g. `1250`, `-5920`). Cells containing `;`,
  `"` or a line break are wrapped in double quotes (inner quotes doubled). Content: one row per 2044 line with the columns `Ligne`, `Libellé`, one
  column per included property (property name), `Total`, `Remarque` (the "À compléter
  manuellement" flag or the hint of the line), followed by an empty row and the disclaimer row.
- **Print / PDF** ("Imprimer / PDF"): calls the browser print dialog. A print stylesheet hides the
  sidebar, the year selector, the checkboxes and the buttons. The printed document contains a header
  (title, year, generation date), the income recap, the 2044 table, the expense detail per property,
  the "Dépenses non ventilées" block and the disclaimer.
- Both export buttons are disabled when no property is included for year `Y`.

### Empty states

- No collected rent and no expense on any property in `Y`: the page shows "Aucun revenu ni dépense
  enregistré pour <Y>" and the export buttons are disabled.
- All listed properties unchecked: the 2044 table shows "Aucun bien inclus dans la déclaration" and
  the export buttons are disabled.

### Implementation constraints

- All computations are **pure functions** in a service (`src/features/fiscal/services/`), independent
  of the UI and of the current time except for the default selected year.
- The CSV is generated by a pure function returning the file content (testable without DOM); the
  download goes through the shared `useExport` composable (extended with a delimiter option if
  needed).

---

## User Stories

### Story: Open the yearly fiscal summary

**As a** landlord
**I want to** open a yearly summary of my rental income and deductible expenses
**So that** I can prepare my "revenus fonciers" tax return

#### Scenario: Open the fiscal summary from the sidebar

```gherkin
Given today is 2026-04-15
And properties have collected rents in 2025
When I click "Fiscalité" in the sidebar
Then the "Récapitulatif fiscal" page opens on route "/fiscal"
And the selected year is 2025
And the income recap, the 2044 table and the expense detail of 2025 are displayed
And the disclaimer "Document d'aide à la déclaration — vérifiez les montants avant de les reporter. Locapilot ne fournit pas de conseil fiscal." is displayed
```

#### Scenario: Year selector lists relevant years

```gherkin
Given today is 2026-04-15
And there are collected rents in 2023 and 2025 and an expense dated 2024-06-01
When I open the fiscal summary
Then the year selector offers 2026, 2025, 2024 and 2023 in that order
When I select 2024
Then all figures are recomputed for 2024
```

#### Scenario: Year without any income nor expense

```gherkin
Given no property has a collected rent nor an expense in 2025
When I open the fiscal summary for 2025
Then the message "Aucun revenu ni dépense enregistré pour 2025" is displayed
And the "Exporter en CSV" and "Imprimer / PDF" buttons are disabled
```

#### Scenario: The fiscal summary never modifies data

```gherkin
Given I am on the fiscal summary page
When I change the year, uncheck properties and export the CSV
Then no Property, Lease, Rent or Expense record is created, updated or deleted
```

---

### Story: Review the rent income collected per property

**As a** landlord
**I want to** see the rent income I collected on each property during the year
**So that** I know the gross income to declare on line 211

#### Scenario: Income recap per property

```gherkin
Given "Appart Gambetta T2" has 12 rents of 800 € rent + 50 € charges paid in 2025
And "Maison Lilas" has 12 rents of 500 € rent + 0 € charges paid in 2025
When I view the 2025 fiscal summary
Then the income recap shows for "Appart Gambetta T2": rent income 9 600,00 €, charges collected 600,00 €, 12 rents collected
And it shows for "Maison Lilas": rent income 6 000,00 €, charges collected 0,00 €, 12 rents collected
And the total rent income is 15 600,00 €
```

#### Scenario: Partial payment is split between rent and charges

```gherkin
Given a rent of amount 800 and charges 200 has status "partial" with paidAmount 500 and paidDate 2025-03-08
When I view the 2025 fiscal summary
Then that rent contributes 400,00 € to the rent income
And 100,00 € to the charges collected
```

#### Scenario: Income is attributed to the year of payment

```gherkin
Given the rent due on 2024-12-05 was paid on 2025-01-08
When I view the fiscal summaries of 2024 and 2025
Then the rent is counted in 2025 and not in 2024
```

#### Scenario: Rent without paid date falls back to its due date

```gherkin
Given a rent with status "paid", no paidDate and dueDate 2025-03-05
When I view the 2025 fiscal summary
Then the rent is counted in 2025
```

#### Scenario: Unpaid rents are not declared

```gherkin
Given a property has a rent "late" and a rent "pending" due in 2025
When I view the 2025 fiscal summary
Then neither rent contributes to line 211
```

#### Scenario: Rents of ended leases are included

```gherkin
Given a property had a lease ended on 2025-06-30 and a new lease started on 2025-08-01
And rents were paid under both leases in 2025
When I view the 2025 fiscal summary
Then line 211 of the property includes the rents of both leases
```

#### Scenario: Orphan rents are ignored

```gherkin
Given a rent references a lease that no longer exists
And another rent references a lease whose property no longer exists
When I view the fiscal summary of the year of these rents
Then neither rent is counted
And no error is thrown
```

#### Scenario: Properties without activity in the year are not listed

```gherkin
Given "Studio Nation" has neither collected rent nor expense in 2025
When I view the 2025 fiscal summary
Then "Studio Nation" is not listed
```

---

### Story: Review the deductible expenses per property

**As a** landlord
**I want to** see my expenses of the year grouped by CERFA 2044 line
**So that** I know what I can deduct from my rental income

#### Scenario: Expenses are attributed to their 2044 line

```gherkin
Given "Appart Gambetta T2" has the following expenses in 2025:
  | category        | amount |
  | management-fees | 480    |
  | insurance       | 180    |
  | works           | 2000   |
  | maintenance     | 150    |
  | property-tax    | 1250   |
  | condo-fees      | 600    |
  | loan-interest   | 2100   |
When I view the 2025 fiscal summary
Then for "Appart Gambetta T2" line 221 shows 480, line 223 shows 180, line 224 shows 2 150, line 227 shows 1 250, line 229 shows 600 and line 250 shows 2 100
```

#### Scenario: Expenses of category "Autre" are not deducted

```gherkin
Given "Appart Gambetta T2" has an expense "Frais divers" of category "other" and amount 75 dated 2025-05-02
When I view the 2025 fiscal summary
Then the expense is listed in the "Dépenses non ventilées" block with a total of 75,00 €
And the hint "Reclassez ces dépenses dans une catégorie déductible si elles le sont" is displayed
And it is not included in any 2044 line
```

#### Scenario: Expense detail per property

```gherkin
Given "Appart Gambetta T2" has expenses dated 2025-09-15, 2025-02-01 and 2024-12-20
When I view the 2025 fiscal summary
Then the expense detail of "Appart Gambetta T2" lists the 2 expenses of 2025, the 2025-02-01 one first
And each row shows the date, category, label, amount and 2044 line
And the 2024 expense is not listed
```

#### Scenario: Expenses of the other years are ignored

```gherkin
Given an expense of 500 € dated 2024-12-28 and an expense of 300 € dated 2026-01-03 on the same property
When I view the 2025 fiscal summary
Then neither expense is counted
```

#### Scenario: Hints on property tax and works lines

```gherkin
Given I view the 2044 table
Then line 227 shows the hint "Hors taxe d'enlèvement des ordures ménagères (TEOM), récupérable auprès du locataire"
And line 224 shows the hint "Les travaux de construction ou d'agrandissement ne sont pas déductibles"
```

---

### Story: Compute the CERFA 2044 table

**As a** landlord
**I want to** get the amounts of each 2044 line per property and in total
**So that** I can copy them into my tax return

#### Scenario: Full 2044 computation for two properties

```gherkin
Given in 2025 "Appart Gambetta T2" has rent income 9 600 € and expenses management-fees 480, insurance 180, works 2 000, maintenance 150, property-tax 1 250, condo-fees 600, loan-interest 2 100
And in 2025 "Maison Lilas" has rent income 6 000 € and expenses property-tax 900, works 8 000, loan-interest 3 000
When I view the 2025 2044 table
Then the column "Appart Gambetta T2" shows 211 = 9 600, 214 = 9 600, 221 = 480, 222 = 20, 223 = 180, 224 = 2 150, 227 = 1 250, 229 = 600, 240 = 4 680, 250 = 2 100, 261 = 2 820
And the column "Maison Lilas" shows 211 = 6 000, 214 = 6 000, 222 = 20, 224 = 8 000, 227 = 900, 240 = 8 920, 250 = 3 000, 261 = -5 920
And the column "Total" shows 211 = 15 600, 240 = 13 600, 250 = 5 100, 261 = -3 100
And line 261 of "Maison Lilas" and of the total are displayed in the danger color with the label "Déficit foncier"
```

#### Scenario: Flat management fee only for properties with income

```gherkin
Given "Parking Voltaire" has no collected rent in 2025 but a property-tax expense of 120 €
When I view the 2025 2044 table
Then line 222 of "Parking Voltaire" shows 0
And line 261 of "Parking Voltaire" shows -120
```

#### Scenario: Lines not tracked by Locapilot

```gherkin
When I view the 2044 table
Then lines 212, 213, 225, 226, 228 and 230 show 0
And each of them is flagged "À compléter manuellement"
```

#### Scenario: Amounts are rounded to the euro and totals add up

```gherkin
Given in 2025 a property has rent income 7 200,50 €, an insurance expense of 89,49 € and a property-tax expense of 1 250,50 €
When I view the 2025 2044 table
Then line 211 shows 7 201
And line 223 shows 89
And line 227 shows 1 251
And line 240 shows 1 360 (89 + 20 + 1 251, computed from the rounded lines)
And line 261 shows 5 841
```

#### Scenario: Micro-foncier hint when gross income is at most 15 000 €

```gherkin
Given the included properties total a line 211 of 12 000 € in 2025
When I view the 2025 2044 table
Then the hint "Vos revenus bruts sont inférieurs ou égaux à 15 000 € : vous pouvez relever du régime micro-foncier (case 4BE de la déclaration 2042) au lieu de la 2044." is displayed
```

#### Scenario: No micro-foncier hint above 15 000 €

```gherkin
Given the included properties total a line 211 of 15 600 € in 2025
When I view the 2025 2044 table
Then the micro-foncier hint is not displayed
```

---

### Story: Exclude a property from the declaration

**As a** landlord
**I want to** exclude some properties from the 2044 table
**So that** furnished rentals (LMNP, declared as BIC) are not mixed with my unfurnished rentals

#### Scenario: Furnished rental information banner

```gherkin
When I open the fiscal summary
Then the banner "La déclaration 2044 concerne les locations nues. Les locations meublées (LMNP) relèvent des BIC : décochez les biens concernés." is displayed
```

#### Scenario: Uncheck a property

```gherkin
Given "Appart Gambetta T2" and "Maison Lilas" are listed in the 2025 fiscal summary
When I uncheck "Inclure dans la 2044" for "Maison Lilas"
Then the 2044 table no longer has a "Maison Lilas" column
And the totals only include "Appart Gambetta T2"
And "Maison Lilas" stays in the income recap with the badge "Exclu"
And the CSV export no longer contains "Maison Lilas"
```

#### Scenario: Excluding a property re-evaluates the micro-foncier hint

```gherkin
Given "Appart Gambetta T2" (line 211 = 9 600) and "Maison Lilas" (line 211 = 6 000) are included in 2025
And the micro-foncier hint is not displayed
When I exclude "Maison Lilas"
Then the micro-foncier hint is displayed
```

#### Scenario: All properties excluded

```gherkin
Given every listed property is unchecked
When I view the 2044 table
Then the message "Aucun bien inclus dans la déclaration" is displayed
And the "Exporter en CSV" and "Imprimer / PDF" buttons are disabled
```

#### Scenario: Inclusion choice is reset when the year changes

```gherkin
Given I unchecked "Maison Lilas" for 2025
When I select 2024 and then 2025 again
Then "Maison Lilas" is checked again
```

---

### Story: Export the fiscal summary

**As a** landlord
**I want to** export the fiscal summary as a CSV file or print it as a PDF
**So that** I can keep it with my tax documents or send it to my accountant

#### Scenario: Export the 2044 table as CSV

```gherkin
Given the 2025 fiscal summary includes "Appart Gambetta T2" and "Maison Lilas"
When I click "Exporter en CSV"
Then a file "recapitulatif-fiscal-2025.csv" is downloaded
And it is UTF-8 encoded with a BOM and uses ";" as separator
And its header row is "Ligne;Libellé;Appart Gambetta T2;Maison Lilas;Total;Remarque"
And it contains one row per 2044 line from 211 to 261 with the rounded amounts of the table
And line 212 has the remark "À compléter manuellement"
And the last row contains the disclaimer
And a success notification appears
```

#### Scenario: CSV values containing the separator are escaped

```gherkin
Given a property is named "Appart; Gambetta"
When I export the CSV
Then its header cell is wrapped in double quotes
And the columns of the following cells are not shifted
```

#### Scenario: Negative amounts in the CSV

```gherkin
Given line 261 of "Maison Lilas" is -5 920
When I export the CSV
Then the corresponding cell contains "-5920"
```

#### Scenario: Print or save as PDF

```gherkin
Given I am on the 2025 fiscal summary
When I click "Imprimer / PDF"
Then the browser print dialog opens
And the printed page shows the title "Récapitulatif fiscal 2025", the generation date, the income recap, the 2044 table, the expense detail per property, the "Dépenses non ventilées" block and the disclaimer
And the sidebar, the year selector, the checkboxes and the buttons are hidden
```
