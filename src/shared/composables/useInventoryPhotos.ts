import { ref } from 'vue';
import { db } from '@/db/database';
import type { Document } from '@/db/types';

/**
 * Composable pour gérer les photos d'un état des lieux
 */
export function useInventoryPhotos() {
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * Récupère toutes les photos d'un état des lieux
   */
  async function getInventoryPhotos(inventoryId: number): Promise<Document[]> {
    try {
      const inventory = await db.inventories.get(inventoryId);
      if (!inventory?.photos?.length) return [];

      const photos = await db.documents.bulkGet(inventory.photos);
      return photos.filter((photo): photo is Document => photo !== undefined);
    } catch (err) {
      console.error('Failed to fetch inventory photos:', err);
      return [];
    }
  }

  /**
   * Ajoute une photo à un état des lieux
   */
  async function addInventoryPhoto(
    inventoryId: number,
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
        relatedEntityType: 'inventory',
        relatedEntityId: inventoryId,
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

      // Récupérer l'état des lieux
      const inventory = await db.inventories.get(inventoryId);
      if (!inventory) {
        throw new Error('Inventory not found');
      }

      // Mettre à jour la liste des photos de l'état des lieux
      const photos = inventory.photos || [];
      photos.push(documentId);

      await db.inventories.update(inventoryId, { photos });

      // Récupérer et retourner le document créé
      const createdDocument = await db.documents.get(documentId);
      return createdDocument || null;
    } catch (err) {
      try {
        const errorObj = err as any;
        console.error(
          'Failed to add inventory photo:',
          errorObj && (errorObj.name || errorObj.message || String(err))
        );
        if (errorObj && errorObj.stack) console.error(errorObj.stack);
      } catch (e) {
        console.error('Failed to add inventory photo (logging error)', String(e));
      }
      error.value = err instanceof Error ? err.message : "Échec de l'ajout de la photo";
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Supprime une photo d'un état des lieux
   */
  async function removeInventoryPhoto(inventoryId: number, documentId: number): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      // Récupérer l'état des lieux
      const inventory = await db.inventories.get(inventoryId);
      if (!inventory) {
        throw new Error('Inventory not found');
      }

      // Supprimer l'ID de la liste des photos
      const photos = (inventory.photos || []).filter(id => id !== documentId);

      await db.inventories.update(inventoryId, { photos });

      // Supprimer le document
      await db.documents.delete(documentId);
    } catch (err) {
      console.error('Failed to remove inventory photo:', err);
      error.value = err instanceof Error ? err.message : 'Échec de la suppression de la photo';
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Définit une photo comme photo principale (première dans le tableau)
   */
  async function setPrimaryPhoto(inventoryId: number, documentId: number): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const inventory = await db.inventories.get(inventoryId);
      if (!inventory?.photos?.length) {
        throw new Error('No photos found');
      }

      // Réorganiser : mettre la photo sélectionnée en premier
      const photos = inventory.photos.filter(id => id !== documentId);
      photos.unshift(documentId);

      await db.inventories.update(inventoryId, { photos });
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
  async function getPrimaryPhoto(inventoryId: number): Promise<Document | null> {
    try {
      const inventory = await db.inventories.get(inventoryId);
      if (!inventory?.photos?.length) return null;

      const primaryPhotoId = inventory.photos[0];
      if (!primaryPhotoId) return null;

      const photo = await db.documents.get(primaryPhotoId);
      return photo || null;
    } catch (err) {
      console.error('Failed to fetch primary photo:', err);
      return null;
    }
  }

  /**
   * Convertit des données (Blob, ArrayBuffer, base64 string…) en URL pour affichage.
   * Retourne une chaîne vide si les données ne sont pas utilisables.
   */
  function createPhotoUrl(data: unknown): string {
    try {
      if (!data) return '';

      if (data instanceof Blob) return URL.createObjectURL(data);

      if (data instanceof ArrayBuffer) {
        const blob = new Blob([data], { type: 'application/octet-stream' });
        return URL.createObjectURL(blob);
      }

      if (typeof data === 'object' && data !== null) {
        // @ts-ignore
        const maybeBuffer = (data as any).buffer;
        if (maybeBuffer instanceof ArrayBuffer) {
          const uint8 = new Uint8Array(maybeBuffer);
          const blob = new Blob([uint8], { type: 'application/octet-stream' });
          return URL.createObjectURL(blob);
        }
      }

      if (typeof data === 'string') {
        if (data.startsWith('data:')) return data;
        try {
          const binary = atob(data);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'application/octet-stream' });
          return URL.createObjectURL(blob);
        } catch (e) {
          console.error('createPhotoUrl error', e);
          return '';
        }
      }

      return '';
    } catch (err) {
      console.error('createPhotoUrl error', err);
      return '';
    }
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
    getInventoryPhotos,
    addInventoryPhoto,
    removeInventoryPhoto,
    setPrimaryPhoto,
    getPrimaryPhoto,
    createPhotoUrl,
    revokePhotoUrl,
  };
}
