## ADDED Requirements

### Requirement: Strict MVC Layering

Le système MUST appliquer une séparation stricte des couches adaptée à Vue/Pinia:

- Les vues MUST se limiter à l’affichage, la gestion de l’état d’écran et la navigation.
- Les vues MUST NOT contenir de règles métiers et MUST NOT accéder directement à la base Dexie/IndexedDB.
- Les stores Pinia MUST orchestrer les cas d’usage (actions, état, erreurs) et déléguer les règles métiers à des services.
- Les services métier MUST encapsuler les règles métiers et être testés.
- L’accès à Dexie MUST être encapsulé dans des repositories (ou services d’accès données) testés.

#### Scenario: View triggers business action

- **WHEN** une vue déclenche une action métier (ex: export, calcul dashboard, refus candidature)
- **THEN** elle appelle une action de store
- **AND THEN** le store délègue la logique métier à un service
- **AND THEN** l’accès données est effectué via un repository (pas depuis la vue)

### Requirement: No Regression Through Tests

Le système MUST préserver le comportement fonctionnel existant pendant la refactorisation.

#### Scenario: Refactor changes internal structure only

- **WHEN** la logique métier est déplacée depuis une vue vers un service
- **THEN** les tests unitaires et E2E existants MUST rester verts
- **AND THEN** toute modification de comportement MUST être détectée et corrigée avant merge
