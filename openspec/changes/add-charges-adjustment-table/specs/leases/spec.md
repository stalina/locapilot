## ADDED Requirements

### Requirement: Charges Adjustment Table

La vue détail d'un bail SHALL afficher un tableau de régularisation des charges sous les informations financières.

#### Scenario: Display default yearly rows

- **WHEN** l'utilisateur ouvre la vue détail d'un bail
- **THEN** le tableau affiche une ligne par année pour laquelle des données existent (ou permet d'en créer une)

#### Scenario: Add custom charge column

- **WHEN** l'utilisateur clique sur l'icône + dans l'entête du tableau
- **THEN** une popin s'ouvre et demande le libellé de la colonne
- **AND** la colonne est ajoutée pour toutes les lignes et persistée en base

#### Scenario: Edit charges and compute totals

- **WHEN** l'utilisateur saisit des montants dans les colonnes de charges
- **THEN** la colonne "Total charges" est recalculée comme la somme des colonnes custom
- **AND** la colonne "Régulation" est calculée comme `provision de charges payés - total charges`

#### Scenario: Persist changes

- **WHEN** l'utilisateur modifie une valeur
- **THEN** la modification est sauvegardée en base via `chargesAdjustments` table
