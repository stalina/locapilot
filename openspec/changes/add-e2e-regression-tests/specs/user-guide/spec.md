## ADDED Requirements

### Requirement: User Guide - E2E Regression Scenarios

L'application DOIT fournir un guide utilisateur décrivant les scénarios E2E critiques à vérifier pour prévenir les régressions.

#### Scenario: Properties CRUD

- **WHEN** a user crée, édite et supprime une propriété
- **THEN** les opérations doivent réussir et l'interface doit refléter les changements

#### Scenario: Tenants CRUD + Search/Filters

- **WHEN** un locataire est créé, édité et supprimé
- **THEN** les résultats doivent apparaître dans la liste, les filtres et la recherche doivent fonctionner

#### Scenario: Lease lifecycle

- **WHEN** un bail est créé liant un bien et un locataire
- **THEN** le bail apparait dans la fiche du bien et génère les loyers attendus

#### Scenario: Rents generation and payment

- **WHEN** un bail est actif
- **THEN** des loyers mensuels sont créés et l'enregistrement d'un paiement doit mettre à jour le statut

#### Scenario: Documents upload and preview

- **WHEN** un document est ajouté à un locataire ou un bien
- **THEN** le document est listé, téléchargeable et previewable

#### Scenario: Inventories photos and notes

- **WHEN** un inventaire est créé avec photos et notes
- **THEN** les photos sont visibles et les notes sont persistées

#### Scenario: Settings persistence

- **WHEN** un utilisateur modifie un paramètre (ex: devise, langue)
- **THEN** le paramètre est conservé et appliqué sur les vues
