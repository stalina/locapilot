import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useInventoryPhotos } from '../useInventoryPhotos';
import { db } from '@/db/database';
import type { Document } from '@/db/types';

// Mock IndexedDB
vi.mock('@/db/database', () => ({
  db: {
    inventories: {
      get: vi.fn(),
      update: vi.fn(),
    },
    documents: {
      add: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      bulkGet: vi.fn(),
    },
  },
}));

function makePhoto(id: number, name: string): Document {
  return {
    id,
    name,
    type: 'photo',
    mimeType: 'image/jpeg',
    size: 0,
    data: new Blob(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('useInventoryPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInventoryPhotos', () => {
    it('should return empty array if inventory has no photos', async () => {
      const { getInventoryPhotos } = useInventoryPhotos();

      vi.mocked(db.inventories.get).mockResolvedValue({
        id: 1,
        leaseId: 1,
        type: 'checkin',
        date: new Date(),
        photos: [],
      });

      const photos = await getInventoryPhotos(1);
      expect(photos).toEqual([]);
    });

    it('should return photos for inventory', async () => {
      const { getInventoryPhotos } = useInventoryPhotos();

      const mockPhotos = [makePhoto(1, 'photo1.jpg'), makePhoto(2, 'photo2.jpg')];

      vi.mocked(db.inventories.get).mockResolvedValue({
        id: 1,
        leaseId: 1,
        type: 'checkin',
        date: new Date(),
        photos: [1, 2],
      });

      vi.mocked(db.documents.bulkGet).mockResolvedValue(mockPhotos);

      const photos = await getInventoryPhotos(1);
      expect(photos).toHaveLength(2);
    });
  });

  describe('addInventoryPhoto', () => {
    it('should reject non-image files', async () => {
      const { addInventoryPhoto, error } = useInventoryPhotos();

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const result = await addInventoryPhoto(1, file);

      expect(result).toBeNull();
      expect(error.value).toBe('Le fichier doit être une image');
    });

    it('should add photo to inventory', async () => {
      const { addInventoryPhoto } = useInventoryPhotos();

      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });

      vi.mocked(db.inventories.get).mockResolvedValue({
        id: 1,
        leaseId: 1,
        type: 'checkin',
        date: new Date(),
        photos: [],
      });

      vi.mocked(db.documents.add).mockResolvedValue(10);
      vi.mocked(db.documents.get).mockResolvedValue(makePhoto(10, 'photo.jpg'));

      const result = await addInventoryPhoto(1, file);

      expect(result).toBeTruthy();
      expect(db.documents.add).toHaveBeenCalled();
      expect(db.inventories.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          photos: [10],
        })
      );
    });
  });

  describe('setPrimaryPhoto', () => {
    it('should move photo to first position', async () => {
      const { setPrimaryPhoto } = useInventoryPhotos();

      vi.mocked(db.inventories.get).mockResolvedValue({
        id: 1,
        leaseId: 1,
        type: 'checkin',
        date: new Date(),
        photos: [1, 2, 3],
      });

      await setPrimaryPhoto(1, 3);

      expect(db.inventories.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          photos: [3, 1, 2],
        })
      );
    });
  });

  describe('removeInventoryPhoto', () => {
    it('should remove photo from inventory and delete document', async () => {
      const { removeInventoryPhoto } = useInventoryPhotos();

      vi.mocked(db.inventories.get).mockResolvedValue({
        id: 1,
        leaseId: 1,
        type: 'checkin',
        date: new Date(),
        photos: [1, 2, 3],
      });

      await removeInventoryPhoto(1, 2);

      expect(db.inventories.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          photos: [1, 3],
        })
      );
      expect(db.documents.delete).toHaveBeenCalledWith(2);
    });
  });

  describe('URL management', () => {
    it('should create and revoke photo URLs', () => {
      const { createPhotoUrl, revokePhotoUrl } = useInventoryPhotos();

      const blob = new Blob(['image'], { type: 'image/jpeg' });
      const url = createPhotoUrl(blob);

      expect(url).toMatch(/^blob:/);

      // Should not throw
      expect(() => revokePhotoUrl(url)).not.toThrow();
    });
  });
});
