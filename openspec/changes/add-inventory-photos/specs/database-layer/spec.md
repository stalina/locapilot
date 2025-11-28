## MODIFIED Requirements

### Requirement: REQ-DB-001: Schéma de Base de Données Initial

The database MUST have a complete schema covering all Locapilot business entities with TypeScript types and optimized indexes, including support for inventory photos.

**Priority**: Critical  
**Status**: Active

**Details**:

- Database name: `locapilot`
- Version 3 avec harmonisation du type `photos` dans `Inventory`
- Tous les champs typés avec TypeScript interfaces
- `Inventory.photos` utilise `number[]` (IDs de documents) de manière cohérente
- `InventoryItem.photos` utilise également `number[]`
- Support des photos par inventaire et par item (pièce/équipement)

**Acceptance Criteria**:

- Schéma défini dans `src/db/schema.ts`
- Type `Inventory.photos` harmonisé à `number[]`
- Migration v3 convertit les données existantes
- Types TypeScript cohérents et utilisables
- Aucune erreur à la compilation

#### Scenario: Migration v2 vers v3 - Harmonisation du type photos

**Given**: Une base de données en version 2 avec des inventaires  
**When**: La migration v3 s'exécute  
**Then**:

- Le champ `Inventory.photos` passe de `string[]` à `number[]`
- Les données existantes sont converties (string[] vide → number[] vide)
- La version de DB passe à 3
- Aucune perte de données
- Les nouveaux inventaires utilisent le bon type

#### Scenario: Création d'un inventaire avec photos

**Given**: Un utilisateur crée un état des lieux d'entrée  
**When**: Il ajoute 5 photos pour documenter l'état  
**Then**:

- Les 5 photos sont stockées comme documents avec `type: 'photo'`
- Les IDs des documents sont stockés dans `Inventory.photos`
- `relatedEntityType` est défini à `'inventory'`
- `relatedEntityId` pointe vers l'ID de l'inventaire
- Les photos sont récupérables via `getInventoryPhotos()`

---

### Requirement: REQ-DB-006: Gestion des Documents et Blobs

Documents (PDFs, images, etc.) MUST be stored in IndexedDB as Blobs with metadata and size management, with support for inventory photos.

**Priority**: High  
**Status**: Active

**Details**:

- Stockage Blob dans table `documents`
- Validation MIME types
- Support de `relatedEntityType: 'inventory'` pour les photos d'états des lieux
- Limite de taille par fichier (ex: 10MB)
- Organisation par inventaire et par item (pièce)
- Aperçu visuel pour les photos d'inventaire
- Cleanup des documents orphelins

**Acceptance Criteria**:

- Upload de photos d'inventaire fonctionne
- Photos liées correctement à l'inventaire via `relatedEntityId`
- Photos organisables par pièce/équipement via `InventoryItem.photos`
- Download/preview fonctionne
- Aperçu des photos affiché dans la vue inventaire
- Limite de taille respectée

#### Scenario: Ajout de photos par pièce dans un inventaire

**Given**: Un utilisateur remplit un état des lieux avec 4 pièces  
**When**: Il ajoute 3 photos pour la cuisine et 2 pour la salle de bain  
**Then**:

- 5 documents photo sont créés dans la table `documents`
- Les IDs des 3 photos de cuisine sont dans `kitchenItem.photos`
- Les IDs des 2 photos de salle de bain sont dans `bathroomItem.photos`
- Chaque photo est liée à l'inventaire via `relatedEntityId`
- Les photos sont groupées par pièce dans l'interface

#### Scenario: Visualisation d'un inventaire avec photos

**Given**: Un inventaire complet avec 12 photos réparties sur 5 pièces  
**When**: L'utilisateur consulte l'inventaire  
**Then**:

- Les photos s'affichent organisées par pièce
- Chaque section de pièce montre ses photos respectives
- Un clic sur une photo ouvre le lightbox
- La navigation entre photos respecte le groupement par pièce
- Les URLs blob sont révoquées au démontage

---

## ADDED Requirements

### Requirement: REQ-INV-001: Photos d'États des Lieux

Inventories MUST support photo attachments to document property condition during check-in and check-out inspections.

**Priority**: High  
**Status**: Active

**Details**:

- Support de photos au niveau global (inventaire complet)
- Support de photos au niveau item (par pièce/équipement)
- Interface intuitive pour photographier pendant l'inspection
- Organisation par pièce pour faciliter la révision
- Comparaison photos entrée/sortie (optionnel futur)
- Export PDF avec photos (optionnel futur)

**Acceptance Criteria**:

- Photos uploadables pendant création/édition d'inventaire
- Photos organisées par pièce/équipement
- Galerie visuelle dans la vue détail
- Gestion mémoire optimisée (révocation URLs)
- Export/import inclut les photos d'inventaire

#### Scenario: Création d'un état des lieux d'entrée avec photos

**Given**: Un locataire emménage dans un logement  
**When**: Le propriétaire crée l'état des lieux d'entrée  
**Then**:

- Il peut ajouter des photos générales de l'appartement
- Pour chaque pièce, il peut ajouter des photos spécifiques
- Les photos sont horodatées automatiquement
- L'aperçu montre toutes les photos organisées par section
- Les photos sont sauvegardées avec l'inventaire

#### Scenario: Comparaison état d'entrée vs sortie (futur)

**Given**: Un locataire quitte le logement  
**When**: Le propriétaire fait l'état des lieux de sortie  
**Then**:

- Il voit les photos de l'état d'entrée pour référence
- Il peut ajouter de nouvelles photos pour l'état de sortie
- Les photos sont affichées côte à côte pour comparaison
- Les différences peuvent être annotées
- Un rapport peut être généré avec les deux séries de photos

#### Scenario: Export d'inventaire avec photos

**Given**: Un inventaire contient 15 photos  
**When**: L'utilisateur exporte ses données  
**Then**:

- Les 15 photos sont incluses dans l'export JSON
- Les blobs sont encodés en base64
- La structure maintient les liens inventaire→photos
- L'import restaure correctement toutes les photos
- Aucune perte de qualité d'image

### Requirement: REQ-INV-002: Composable Photos Inventaire

The application MUST provide a reusable composable for managing inventory photos following the same patterns as property photos.

**Priority**: High  
**Status**: Active

**Details**:

- Composable `useInventoryPhotos` similaire à `usePropertyPhotos`
- Fonctions : `addInventoryPhoto`, `getInventoryPhotos`, `getItemPhotos`, `removeInventoryPhoto`
- Support des photos au niveau inventaire et item
- Gestion automatique des blob URLs
- Réutilisation du système de documents existant

**Acceptance Criteria**:

- Composable créé et testé
- API cohérente avec `usePropertyPhotos`
- Gestion de la mémoire correcte
- Tests unitaires couvrent tous les cas d'usage
- Documentation complète

#### Scenario: Utilisation du composable dans un formulaire

**Given**: Un composant Vue crée un inventaire  
**When**: Il utilise `const { addInventoryPhoto } = useInventoryPhotos()`  
**Then**:

- L'upload de photo est simplifié via `await addInventoryPhoto(inventoryId, file)`
- Les erreurs sont gérées automatiquement
- Le state de chargement est géré par le composable
- Les photos sont immédiatement disponibles après ajout
- Aucune gestion manuelle de blob URL nécessaire

#### Scenario: Récupération des photos d'une pièce

**Given**: Un inventaire avec 3 pièces contenant des photos  
**When**: On appelle `getItemPhotos(inventoryId, 'kitchen')`  
**Then**:

- Seules les photos de la cuisine sont retournées
- Les documents sont complets avec leurs blobs
- L'ordre des photos est préservé
- Les métadonnées (nom, taille, date) sont disponibles
- Performance optimale même avec beaucoup de photos
