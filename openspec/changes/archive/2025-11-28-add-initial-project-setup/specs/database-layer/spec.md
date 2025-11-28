# Capability: Database Layer

**Domain**: Data  
**Owner**: Platform Team  
**Status**: Active

## Overview

Couche de données basée sur IndexedDB et Dexie.js permettant le stockage local sécurisé et performant de toutes les données de l'application (propriétés, locataires, baux, documents, etc.) avec support des migrations, transactions et queries complexes.

## ADDED Requirements

### Requirement: REQ-DB-001: Schéma de Base de Données Initial

**Priority**: Critical  
**Status**: Active

The database MUST have a complete schema covering all Locapilot business entities with TypeScript types and optimized indexes.

**Details**:

- Database name: `locapilot`
- Version 1 avec 8 tables principales:
  - `properties`: Appartements/maisons
  - `tenants`: Locataires
  - `leases`: Baux de location
  - `rents`: Loyers et paiements
  - `documents`: Fichiers et pièces justificatives
  - `inventories`: États des lieux
  - `communications`: Traçage des échanges
  - `settings`: Paramètres application
- Tous les champs typés avec TypeScript interfaces
- Indexes sur clés primaires et étrangères
- Indexes sur champs de filtrage (status, dates, type)

**Acceptance Criteria**:

- Schéma défini dans `src/db/schema.ts`
- Toutes les tables créées au premier démarrage
- Types TypeScript exportés et utilisables
- Indexes créés automatiquement
- Database accessible via singleton

#### Scenario: Premier démarrage de l'application

**Given**: L'utilisateur lance l'application pour la première fois  
**When**: L'application initialise IndexedDB  
**Then**:

- La base de données `locapilot` est créée
- Toutes les 8 tables sont créées
- Les indexes sont créés
- La version de DB est définie à 1
- Aucune erreur n'est générée

#### Scenario: Accès à une table avec TypeScript

**Given**: Un composant veut accéder à la table `properties`  
**When**: Le code utilise `db.properties.toArray()`  
**Then**:

- TypeScript infère le type `Property[]`
- L'autocomplétion fonctionne sur les champs
- Aucune erreur de type à la compilation
- Les données retournées correspondent au type

---

### Requirement: REQ-DB-002: CRUD Operations sur Toutes les Tables

**Priority**: Critical  
**Status**: Active

The application MUST provide typed and tested CRUD operations (Create, Read, Update, Delete) for all database tables.

**Details**:

- Create: Ajout d'une nouvelle entité avec validation
- Read: Queries avec filtres, tri, pagination
- Update: Modification partielle ou complète
- Delete: Suppression avec vérification dépendances
- Bulk operations pour imports
- Transactions pour opérations multi-tables

**Acceptance Criteria**:

- CRUD fonctionne pour toutes les 8 tables
- Validation avant insertion/update
- Gestion d'erreurs appropriée
- Tests unitaires pour chaque opération
- Composables réutilisables (`usePropertyDB`, etc.)

#### Scenario: Création d'une propriété

**Given**: L'utilisateur remplit le formulaire d'ajout de propriété  
**When**: Il soumet le formulaire  
**Then**:

- Les données sont validées
- La propriété est insérée dans `properties`
- Un ID auto-incrémenté est retourné
- Les timestamps `createdAt` et `updatedAt` sont définis
- Une notification de succès est affichée

#### Scenario: Lecture de propriétés avec filtres

**Given**: La base contient 50 propriétés  
**When**: L'utilisateur filtre par `status = 'available'`  
**Then**:

- Seules les propriétés disponibles sont retournées
- La query utilise l'index sur `status`
- Les résultats sont triés par `createdAt` desc
- La performance est < 50ms

#### Scenario: Mise à jour d'un locataire

**Given**: Un locataire existe avec id=5  
**When**: Ses informations sont modifiées  
**Then**:

- Seuls les champs modifiés sont mis à jour
- Le champ `updatedAt` est mis à jour automatiquement
- La transaction est atomique
- Les listeners réactifs sont notifiés

#### Scenario: Suppression d'un bail avec vérifications

**Given**: Un bail existe avec des loyers associés  
**When**: L'utilisateur tente de supprimer le bail  
**Then**:

- Le système vérifie les dépendances (loyers)
- Un dialogue de confirmation s'affiche
- Si confirmé, le bail ET ses loyers sont supprimés (cascade)
- Les documents liés restent (optionnel)

---

### Requirement: REQ-DB-003: Système de Migrations

**Priority**: High  
**Status**: Active

The database MUST support migrations to evolve the schema without data loss during application updates.

**Details**:

- Versioning du schéma (v1, v2, etc.)
- Migrations automatiques au démarrage
- Migration functions pour chaque version
- Backup automatique avant migration
- Rollback en cas d'erreur

**Acceptance Criteria**:

- Système de migration configuré
- Version 1 définie (schéma initial)
- Migration functions testées
- Logs de migration disponibles
- Gestion d'erreurs robuste

#### Scenario: Mise à jour de v1 vers v2 (futur)

**Given**: L'utilisateur a la DB version 1 avec données  
**When**: Il installe la version 2 de l'application  
**Then**:

- Le système détecte la différence de version
- Un backup de la DB est créé
- La fonction de migration v1→v2 s'exécute
- Les données existantes sont préservées
- La version de DB passe à 2

#### Scenario: Erreur pendant une migration

**Given**: Une migration v2→v3 échoue en cours  
**When**: Une erreur est levée  
**Then**:

- La transaction est annulée (rollback)
- La version reste à v2
- Un message d'erreur clair est affiché
- L'utilisateur peut réessayer ou restaurer backup

---

### Requirement: REQ-DB-004: Composables Database

**Priority**: High  
**Status**: Active

The application MUST provide reusable Vue composables to facilitate database access in components.

**Details**:
Composables à créer:

- `useDatabase()`: Accès à l'instance DB
- `usePropertyDB()`: CRUD propriétés
- `useTenantDB()`: CRUD locataires
- `useLeaseDB()`: CRUD baux
- `useRentDB()`: CRUD loyers
- `useDocumentDB()`: CRUD documents
- Chaque composable retourne: `{ items, loading, error, create, update, delete, find }`

**Acceptance Criteria**:

- Composables réactifs (ref/computed)
- Loading states gérés
- Error handling intégré
- TypeScript types complets
- Tests unitaires pour chaque composable

#### Scenario: Utilisation de usePropertyDB dans un composant

**Given**: Un composant Vue affiche une liste de propriétés  
**When**: Le composant utilise `const { items, loading } = usePropertyDB()`  
**Then**:

- `items` est un ref réactif contenant les propriétés
- `loading` est true pendant la query
- Les données s'affichent quand loading devient false
- Le composant se re-render automatiquement si les données changent

#### Scenario: Gestion d'erreur avec composable

**Given**: Une erreur survient lors d'une query DB  
**When**: Le composable détecte l'erreur  
**Then**:

- `error` ref contient le message d'erreur
- `loading` passe à false
- Une notification d'erreur est affichée (optionnel)
- L'utilisateur peut réessayer

---

### Requirement: REQ-DB-005: Queries Optimisées avec Indexes

**Priority**: High  
**Status**: Active

Frequent queries MUST use indexes to ensure optimal performance even with large data volumes.

**Details**:
Indexes requis:

- `properties`: `status`, `createdAt`
- `tenants`: `status`, `lastName`, `email`
- `leases`: `propertyId`, `status`, `startDate`, `endDate`
- `rents`: `leaseId`, `dueDate`, `status`
- `documents`: `relatedEntityType`, `relatedEntityId`, `type`
- Compound indexes si nécessaire (ex: `[status, createdAt]`)

**Acceptance Criteria**:

- Indexes définis dans schéma
- Queries utilisent les indexes (vérifiable via explain)
- Performance < 50ms pour queries typiques
- Supporte 10,000+ enregistrements sans dégradation

#### Scenario: Recherche de baux actifs

**Given**: La DB contient 1000 baux  
**When**: L'utilisateur filtre par `status = 'active'`  
**Then**:

- La query utilise l'index sur `status`
- Seuls les baux actifs sont scannés
- Résultat retourné en < 20ms
- Pas de full table scan

#### Scenario: Tri des locataires par nom

**Given**: 500 locataires dans la DB  
**When**: L'utilisateur trie par `lastName` ASC  
**Then**:

- L'index sur `lastName` est utilisé
- Les résultats sont triés correctement
- Performance < 30ms
- Pagination fonctionne efficacement

---

### Requirement: REQ-DB-006: Gestion des Documents et Blobs

**Priority**: High  
**Status**: Active

Documents (PDFs, images, etc.) MUST be stored in IndexedDB as Blobs with metadata and size management.

**Details**:

- Stockage Blob dans table `documents`
- Validation MIME types
- Limite de taille par fichier (ex: 10MB)
- Compression optionnelle pour images
- Thumbnail generation pour images (optionnel)
- Cleanup des documents orphelins

**Acceptance Criteria**:

- Upload de fichiers fonctionne
- Blobs stockés correctement dans DB
- Download/preview fonctionne
- Limite de taille respectée
- Types MIME validés

#### Scenario: Upload d'un document PDF

**Given**: L'utilisateur upload un bail PDF de 2MB  
**When**: Le fichier est sélectionné  
**Then**:

- Le fichier est lu comme Blob
- Les métadonnées sont extraites (nom, taille, type)
- Le document est inséré dans table `documents`
- Le Blob est stocké en tant que tel (pas base64)
- Un ID de document est retourné

#### Scenario: Tentative d'upload d'un fichier trop gros

**Given**: L'utilisateur sélectionne un fichier de 15MB  
**When**: Le système valide la taille  
**Then**:

- L'upload est rejeté
- Un message d'erreur clair s'affiche
- La limite de taille est indiquée
- Aucune donnée n'est stockée

#### Scenario: Affichage d'un document stocké

**Given**: Un document PDF est stocké avec id=10  
**When**: L'utilisateur clique pour voir le document  
**Then**:

- Le Blob est récupéré de la DB
- Une URL blob est créée (URL.createObjectURL)
- Le PDF s'ouvre dans une nouvelle fenêtre ou viewer
- L'URL blob est révoquée après usage

---

### Requirement: REQ-DB-007: Export/Import des Données

**Priority**: Medium  
**Status**: Active

The user MUST be able to export all their data in JSON format and re-import it for backup or migration purposes.

**Details**:

- Export: JSON contenant toutes les tables
- Blobs encodés en base64 dans l'export
- Import: Validation du schéma avant import
- Options: Replace all ou Merge
- Backup automatique avant import

**Acceptance Criteria**:

- Export génère un fichier JSON téléchargeable
- Import valide et charge les données
- Blobs sont correctement encodés/décodés
- Validation empêche corruption de données
- Progress indicator pour gros exports/imports

#### Scenario: Export complet des données

**Given**: L'utilisateur a 50 propriétés, 100 locataires, 200 baux  
**When**: Il clique sur "Exporter mes données"  
**Then**:

- Un fichier JSON est généré
- Toutes les tables sont incluses
- Les Blobs sont encodés en base64
- Le fichier est téléchargé (ex: `locapilot-backup-2025-11-24.json`)
- Un message de succès s'affiche

#### Scenario: Import de données avec validation

**Given**: L'utilisateur a un fichier d'export JSON  
**When**: Il importe le fichier  
**Then**:

- Le JSON est parsé et validé
- Le schéma est vérifié (version compatible)
- Un backup de la DB actuelle est créé
- Les données sont importées
- Un rapport (success/errors) est affiché

---

### Requirement: REQ-DB-008: Relations entre Entités

**Priority**: High  
**Status**: Active

The system MUST properly manage relationships between entities (property ↔ lease, lease ↔ rent, etc.) with helpers for relational queries.

**Details**:
Relations principales:

- Property → Leases (1-to-many)
- Tenant → Leases (many-to-many via `tenantIds[]`)
- Lease → Rents (1-to-many)
- Lease → Inventories (1-to-2: entry + exit)
- Document → Any entity (polymorphic)
- Helpers pour queries: `getPropertyWithLeases()`, `getLeaseWithTenants()`, etc.

**Acceptance Criteria**:

- Relations définies dans types
- Helpers fonctionnent correctement
- Cascade delete optionnel
- Validation de contraintes (foreign keys)
- Tests pour queries relationnelles

#### Scenario: Récupération d'une propriété avec ses baux

**Given**: Une propriété id=1 a 3 baux  
**When**: On appelle `getPropertyWithLeases(1)`  
**Then**:

- La propriété est récupérée
- Les 3 baux associés sont joints
- Un seul accès DB efficace (pas de N+1)
- Les données sont typées correctement

#### Scenario: Suppression en cascade

**Given**: Un bail a 12 loyers associés  
**When**: L'utilisateur supprime le bail  
**Then**:

- Une confirmation demande si les loyers doivent être supprimés
- Si oui, bail ET loyers sont supprimés en une transaction
- Si non, seul le bail est supprimé (loyers deviennent orphelins si autorisé)
- Pas de données incohérentes

---

## Dependencies

**Internal**:

- core-infrastructure (TypeScript, build tools)

**External**:

- Dexie.js ^4.0.0

## Risks

- **IndexedDB limits**: Quota storage (~50% disk), géré via quotas API
- **Migration failures**: Backups automatiques + rollback
- **Performance avec gros volumes**: Indexes + pagination + archivage
- **Corruption de données**: Validation stricte + transactions

## Performance Targets

- Simple query: < 20ms
- Complex query with joins: < 50ms
- Insert: < 10ms
- Bulk insert (100 items): < 200ms
- Database initialization: < 100ms
- Migration: < 5s pour 10k records

## Security

- Données stockées localement (browser security)
- Validation avant toute insertion
- Sanitization des entrées
- Pas de SQL injection (NoSQL)
- Encryption optionnelle (future avec SubtleCrypto)

## Accessibility

- N/A (couche de données, pas d'UI)

## Observability

- Logging des erreurs DB
- Migration logs
- Performance monitoring (queries lentes)
- Storage quota monitoring
