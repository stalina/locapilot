## 1. Préparation (zéro régression)

- [x] 1.1 Établir un baseline: exécuter `npm test` + `npm run test:e2e` et archiver les résultats
- [x] 1.2 Identifier les vues accédant à `db` et les points de logique métier (inventaire)
- [x] 1.3 Définir un “contrat” de layering (vues → stores → services → repositories → db)

## 2. Infrastructure: services & repositories

- [x] 2.1 Créer un pattern standard de services (naming, inputs/outputs, erreurs)
- [x] 2.2 Créer un pattern standard de repositories Dexie (interfaces + impl Dexie)
- [x] 2.3 Ajouter une convention de tests (happy path + edge cases) pour services/repositories

## 3. Refacto incrémentale par feature

- [x] 3.1 Dashboard
  - extraire stats/activities/events dans `dashboardService`
  - créer `dashboardRepository` (lecture DB)
  - ajouter tests unitaires sur le calcul de stats/activities
  - vue: ne garde que chargement via store + affichage

- [x] 3.2 Settings (export/import + Peer Sync)
  - extraire sérialisation documents (Blob/base64) dans `exportImportService`
  - extraire import transactionnel (clear + bulkAdd) dans `importService` + `settingsRepository`
  - tests: export payload, round-trip import/export, cas documents corrompus
  - vue: orchestration UI uniquement

- [x] 3.3 Tenants
  - extraire `computeAge`, mapping `tenantStatus`→config UI
  - extraire lecture `tenantAudits` dans `tenantAuditRepository`
  - tests unitaires sur règles d’âge et récupération “dernier refus”

- [x] 3.4 Autres features (properties, leases, rents, documents, inventories)
  - déplacer les filtres/tri/mappings répétés vers des services dédiés
  - harmoniser formatage dates via `useFormatter` / utilitaire unique

## 4. Déduplication & suppression code mort

- [x] 4.1 Détecter duplications (formatage dates, mapping tenants, filtres) et centraliser
- [x] 4.2 Supprimer le code mort uniquement après couverture tests suffisante

## 5. Validation finale

- [x] 5.1 `npm run type-check`
- [x] 5.2 `npm run lint`
- [x] 5.3 `npm test`
- [x] 5.4 `npm run test:e2e`
- [x] 5.5 Revue manuelle rapide: Dashboard / Settings export-import / Tenant refusal
