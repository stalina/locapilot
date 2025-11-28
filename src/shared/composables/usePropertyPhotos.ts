import { ref } from 'vue';
import { db } from '@/db/database';
import type { Document } from '@/db/types';

/**
 * Composable pour gérer les photos d'un logement
 */
export function usePropertyPhotos() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Récupère toutes les photos d'un logement
   */
  async function getPropertyPhotos(propertyId: number): Promise<Document[]> {
    try {
      const property = await db.properties.get(propertyId);
      if (!property?.photos?.length) return [];

      const photos = await db.documents.bulkGet(property.photos);
      return photos.filter((photo): photo is Document => photo !== undefined);
    } catch (err) {
      console.error('Failed to fetch property photos:', err);
      return [];
    }
  }

  /**
   * Ajoute une photo à un logement
   */
  async function addPropertyPhoto(
    propertyId: number,
    file: File,
    description?: string
  ): Promise<Document | null> {
    isLoading.value = true;
    error.value = null;

    try {
      // Vérifier que c'est bien une image
      if (!file.type.startsWith('image/')) {
        error.value = 'Le fichier doit être une image';
        return null;
      }

      // Créer le document photo
      const now = new Date();
      const photoDocument: Omit<Document, 'id'> = {
        name: file.name,
        type: 'photo',
        relatedEntityType: 'property',
        relatedEntityId: propertyId,
        mimeType: file.type,
        size: file.size,
        data: file.slice(),
        ...(description && { description }),
        createdAt: now,
        updatedAt: now,
      };

      // Ajouter le document à la base de données
      const documentId = await db.documents.add(photoDocument as Document);

      if (typeof documentId !== 'number') {
        throw new Error('Failed to create document');
      }

      // Récupérer le logement
      const property = await db.properties.get(propertyId);
      if (!property) {
        throw new Error('Property not found');
      }

      // Mettre à jour la liste des photos du logement
      const photos = property.photos || [];
      photos.push(documentId);

      await db.properties.update(propertyId, {
        photos,
        updatedAt: now,
      });

      // Récupérer et retourner le document créé
      const createdDocument = await db.documents.get(documentId);
      return createdDocument || null;
    } catch (err) {
      console.error('Failed to add property photo:', err);
      error.value = err instanceof Error ? err.message : "Échec de l'ajout de la photo";
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Supprime une photo d'un logement
   */
  async function removePropertyPhoto(propertyId: number, documentId: number): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // Récupérer le logement
      const property = await db.properties.get(propertyId);
      if (!property) {
        throw new Error('Property not found');
      }

      // Supprimer l'ID de la liste des photos
      const photos = (property.photos || []).filter(id => id !== documentId);

      await db.properties.update(propertyId, {
        photos,
        updatedAt: new Date(),
      });

      // Supprimer le document
      await db.documents.delete(documentId);
    } catch (err) {
      console.error('Failed to remove property photo:', err);
      error.value = err instanceof Error ? err.message : 'Échec de la suppression de la photo';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Définit une photo comme photo principale (première dans le tableau)
   */
  async function setPrimaryPhoto(propertyId: number, documentId: number): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const property = await db.properties.get(propertyId);
      if (!property?.photos?.length) {
        throw new Error('No photos found');
      }

      // Réorganiser : mettre la photo sélectionnée en premier
      const photos = property.photos.filter(id => id !== documentId);
      photos.unshift(documentId);

      await db.properties.update(propertyId, {
        photos,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('Failed to set primary photo:', err);
      error.value =
        err instanceof Error ? err.message : 'Échec de la définition de la photo principale';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Récupère la photo principale (première photo)
   */
  async function getPrimaryPhoto(propertyId: number): Promise<Document | null> {
    try {
      const property = await db.properties.get(propertyId);
      if (!property?.photos?.length) return null;

      const primaryPhotoId = property.photos[0];
      if (!primaryPhotoId) return null;

      const photo = await db.documents.get(primaryPhotoId);
      return photo || null;
    } catch (err) {
      console.error('Failed to fetch primary photo:', err);
      return null;
    }
  }

  /**
   * Convertit un blob en URL pour affichage
   */
  function createPhotoUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  /**
   * Libère une URL créée avec createPhotoUrl
   */
  function revokePhotoUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  return {
    isLoading,
    error,
    getPropertyPhotos,
    addPropertyPhoto,
    removePropertyPhoto,
    setPrimaryPhoto,
    getPrimaryPhoto,
    createPhotoUrl,
    revokePhotoUrl,
  };
}
