# Gestion des photos de logements

## Vue d'ensemble

Le système de gestion des photos permet d'attacher des images aux logements dans Locapilot. Les photos sont stockées localement dans IndexedDB et font partie intégrante du système d'export/import.

## Architecture

### Stockage des données

Les photos sont stockées de deux manières complémentaires :

1. **Table `documents`** : Les fichiers images eux-mêmes (Blob)
   - Type : `'photo'`
   - Lien vers le logement via `relatedEntityType: 'property'` et `relatedEntityId`
   - Métadonnées : nom, taille, mimeType, description

2. **Table `properties`** : Référence aux photos
   - Champ `photos?: number[]` contenant les IDs des documents
   - L'ordre dans le tableau détermine la photo principale (index 0)

### Migration de base de données

La version 2 du schéma ajoute le support des photos :

- Nouveau champ `photos` dans `Property`
- Nouveau type `'photo'` dans `Document`
- Migration automatique : initialise `photos: []` pour les propriétés existantes

## Composants

### `usePropertyPhotos` (Composable)

Localisation : `src/shared/composables/usePropertyPhotos.ts`

**Fonctions principales :**

```typescript
// Récupérer toutes les photos d'un logement
getPropertyPhotos(propertyId: number): Promise<Document[]>

// Ajouter une photo
addPropertyPhoto(propertyId: number, file: File, description?: string): Promise<Document | null>

// Supprimer une photo
removePropertyPhoto(propertyId: number, documentId: number): Promise<void>

// Définir la photo principale
setPrimaryPhoto(propertyId: number, documentId: number): Promise<void>

// Récupérer la photo principale
getPrimaryPhoto(propertyId: number): Promise<Document | null>

// Créer une URL temporaire pour affichage
createPhotoUrl(blob: Blob): string

// Libérer une URL temporaire
revokePhotoUrl(url: string): void
```

### `PhotoGallery.vue` (Composant)

Localisation : `src/shared/components/PhotoGallery.vue`

**Props :**

- `propertyId` (required) : ID du logement
- `editable` (default: `true`) : Mode édition activé/désactivé
- `maxPhotos` (default: `10`) : Nombre maximum de photos

**Fonctionnalités :**

- Grille responsive (min 200px par photo)
- Upload multiple d'images
- Marquage de la photo principale (étoile)
- Lightbox pour affichage plein écran
- Navigation clavier (← → Escape)
- Suppression avec confirmation

### `PropertyCard.vue` (Mise à jour)

Affiche automatiquement la photo principale du logement :

- Si photo disponible : affichage de l'image
- Sinon : gradient de couleur + icône (comportement par défaut)

### `LeaseCard.vue` (Mise à jour)

Affiche la photo principale du logement associé au bail :

- Récupération automatique via `propertyId`
- Fallback vers gradient si aucune photo
- Gestion optimisée de la mémoire (révocation des URLs)

### `DocumentCard.vue` (Mise à jour)

Affichage amélioré pour les documents photo :

- Aperçu visuel pour les photos (miniature 80x80px)
- Badge "Photo" avec couleur distinctive
- Fallback vers icône pour les autres types de documents

## Export/Import

### Export

Les photos sont **automatiquement incluses** dans l'export JSON via `exportData()` :

```typescript
{
  "version": 2,
  "exportDate": "2025-11-28T...",
  "properties": [...],  // Contient le champ photos: [1, 2, 3]
  "documents": [...]    // Contient les Blobs des photos
}
```

**Important :** Les Blobs sont sérialisés en base64 dans le JSON.

### Import

L'import via `importData(jsonData)` restaure :

1. Les documents (photos avec leurs Blobs)
2. Les propriétés avec leurs références aux photos

**Aucune configuration supplémentaire n'est nécessaire** - le système d'export/import existant gère tout automatiquement.

## Utilisation

### Dans une page de détail

```vue
<script setup lang="ts">
import PhotoGallery from '@/shared/components/PhotoGallery.vue';

const propertyId = ref(1);
</script>

<template>
  <PhotoGallery :property-id="propertyId" :editable="true" @update="handlePhotoUpdate" />
</template>
```

### Récupérer la photo principale

```typescript
import { usePropertyPhotos } from '@/shared/composables/usePropertyPhotos';

const { getPrimaryPhoto, createPhotoUrl } = usePropertyPhotos();

const photo = await getPrimaryPhoto(propertyId);
if (photo) {
  const url = createPhotoUrl(photo.data);
  // Utiliser url dans <img :src="url">
  // Ne pas oublier de libérer : revokePhotoUrl(url)
}
```

### Filtrer les documents par type photo

Dans la vue Documents, utilisez le filtre "Photos" pour afficher uniquement les documents de type photo.

## Bonnes pratiques

### Gestion de la mémoire

```typescript
// ✅ BON - Libérer les URLs au unmount
onMounted(async () => {
  const photo = await getPrimaryPhoto(id);
  if (photo) photoUrl.value = createPhotoUrl(photo.data);
});

onUnmounted(() => {
  if (photoUrl.value) revokePhotoUrl(photoUrl.value);
});

// ❌ MAUVAIS - Fuite mémoire
const photo = await getPrimaryPhoto(id);
const url = createPhotoUrl(photo.data);
// URL jamais libérée
```

### Validation des fichiers

Le composable vérifie automatiquement :

- Type MIME : doit commencer par `image/`
- Formats supportés : JPEG, PNG, GIF, WebP, SVG, etc.

### Limites

- **Taille maximale recommandée** : 5 MB par photo
- **Nombre maximum** : 10 photos par défaut (configurable via `maxPhotos`)
- **Formats** : Tous les formats d'image supportés par le navigateur

## Stockage local

### Avantages

✅ **Pas de serveur requis** - 100% offline  
✅ **Privacité totale** - Les données ne quittent jamais l'appareil  
✅ **Export/import** - Sauvegarde complète possible  
✅ **Performance** - Accès instantané aux images

### Considérations

⚠️ **Quota de stockage** : Limité par le navigateur (≈50 MB à plusieurs GB selon le navigateur)  
⚠️ **Compression** : Les photos ne sont pas automatiquement compressées  
⚠️ **Synchronisation** : Pas de sync entre appareils (par conception)

## Tests

Fichier de tests : `src/shared/composables/__tests__/usePropertyPhotos.spec.ts`

Couverture :

- ✅ Ajout de photos
- ✅ Suppression de photos
- ✅ Définition de photo principale
- ✅ Validation des types de fichiers
- ✅ Gestion des URLs

## Évolutions futures

Possibilités d'amélioration :

- Compression automatique des images
- Recadrage/édition basique
- Watermark automatique
- Catégorisation des photos (extérieur, intérieur, détails)
- Génération de miniatures

## Références

- [Dexie.js Blobs](https://dexie.org/docs/Blob)
- [File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- [IndexedDB Storage Limits](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Browser_storage_limits_and_eviction_criteria)
