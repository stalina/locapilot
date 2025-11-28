## MODIFIED Requirements

### Requirement: REQ-DB-006: Gestion des Documents et Blobs

Documents (PDFs, images, etc.) MUST be stored in IndexedDB as Blobs with metadata and size management, with visual previews for photos in document lists.

**Priority**: High  
**Status**: Active

**Details**:

- Stockage Blob dans table `documents`
- Validation MIME types
- Limite de taille par fichier (ex: 10MB)
- Compression optionnelle pour images
- **Aperçu visuel pour les photos dans la liste des documents**
- **Filtre par type "photo" dans la vue Documents**
- Thumbnail generation pour images (optionnel)
- Cleanup des documents orphelins

**Acceptance Criteria**:

- Upload de fichiers fonctionne
- Blobs stockés correctement dans DB
- Download/preview fonctionne
- **Aperçu des photos affiché dans la liste des documents**
- **Filtre par type "photo" disponible et fonctionnel**
- Limite de taille respectée
- Types MIME validés

#### Scenario: Affichage de la liste des documents avec photos

**Given**: L'utilisateur a uploadé 5 photos et 3 PDFs comme documents  
**When**: Il accède à la vue Documents  
**Then**:

- Les 5 photos affichent un aperçu visuel (miniature)
- Les 3 PDFs affichent une icône de document
- Chaque aperçu est généré depuis le Blob stocké
- Les URLs blob sont révoquées après démontage du composant
- Aucune fuite mémoire n'est détectée

#### Scenario: Filtrage des documents par type photo

**Given**: La liste contient des documents de différents types (photo, lease, invoice, etc.)  
**When**: L'utilisateur sélectionne le filtre "Type: Photo"  
**Then**:

- Seuls les documents avec `type === 'photo'` sont affichés
- Le compteur affiche le nombre correct de photos
- Les autres types de documents sont cachés
- Le filtre peut être désactivé pour voir tous les documents

## ADDED Requirements

### Requirement: REQ-DB-009: Photos Principales sur Vignettes

Property photos MUST be displayed on all visual representations of properties (cards, lease cards, lists) for better user experience.

**Priority**: Medium  
**Status**: Active

**Details**:

- Photo principale (première photo) affichée sur PropertyCard
- Photo principale du logement affichée sur les vignettes de bail
- Fallback vers gradient/icône si aucune photo
- Gestion optimisée de la mémoire (révocation des blob URLs)
- Cache des photos pour performance

**Acceptance Criteria**:

- PropertyCard affiche la photo principale ou fallback
- Les vignettes de bail affichent la photo du logement associé
- Pas de fuite mémoire (URLs révoquées au démontage)
- Performance : affichage < 100ms par vignette
- Images chargées de manière lazy si hors viewport

#### Scenario: Affichage de la liste des propriétés avec photos

**Given**: L'utilisateur a 10 propriétés dont 7 avec photos  
**When**: Il accède à la vue liste des propriétés  
**Then**:

- Les 7 propriétés avec photos affichent leur photo principale
- Les 3 propriétés sans photo affichent un gradient avec icône
- Toutes les vignettes ont une taille cohérente
- Les images sont chargées progressivement
- Aucun ralentissement de l'interface n'est perceptible

#### Scenario: Affichage des baux avec photo du logement

**Given**: Un bail est associé à une propriété avec photo  
**When**: L'utilisateur voit la vignette du bail  
**Then**:

- La photo principale du logement est affichée sur la vignette
- Si le logement n'a pas de photo, un fallback est affiché
- La même logique que PropertyCard est réutilisée
- Les informations du bail restent lisibles par-dessus la photo

#### Scenario: Gestion de la mémoire pour les aperçus

**Given**: L'utilisateur navigue entre différentes vues avec photos  
**When**: Il quitte une vue contenant des photos  
**Then**:

- Toutes les blob URLs créées sont révoquées (revokePhotoUrl)
- La mémoire est libérée correctement
- Aucune fuite mémoire n'est détectable dans DevTools
- Les performances restent stables après navigation répétée
