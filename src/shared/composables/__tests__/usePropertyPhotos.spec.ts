import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePropertyPhotos } from '../usePropertyPhotos';
import { db } from '@/db/database';

// Mock IndexedDB
vi.mock('@/db/database', () => ({
  db: {
    properties: {
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

describe('usePropertyPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPropertyPhotos', () => {
    it('should return empty array if property has no photos', async () => {
      const { getPropertyPhotos } = usePropertyPhotos();

      vi.mocked(db.properties.get).mockResolvedValue({
        id: 1,
        name: 'Test Property',
        photos: [],
      } as any);

      const photos = await getPropertyPhotos(1);
      expect(photos).toEqual([]);
    });

    it('should return photos for property', async () => {
      const { getPropertyPhotos } = usePropertyPhotos();

      const mockPhotos = [
        { id: 1, name: 'photo1.jpg', type: 'photo', data: new Blob() },
        { id: 2, name: 'photo2.jpg', type: 'photo', data: new Blob() },
      ];

      vi.mocked(db.properties.get).mockResolvedValue({
        id: 1,
        name: 'Test Property',
        photos: [1, 2],
      } as any);

      vi.mocked(db.documents.bulkGet).mockResolvedValue(mockPhotos as any);

      const photos = await getPropertyPhotos(1);
      expect(photos).toHaveLength(2);
    });
  });

  describe('addPropertyPhoto', () => {
    it('should reject non-image files', async () => {
      const { addPropertyPhoto, error } = usePropertyPhotos();

      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const result = await addPropertyPhoto(1, file);

      expect(result).toBeNull();
      expect(error.value).toBe('Le fichier doit être une image');
    });

    it('should add photo to property', async () => {
      const { addPropertyPhoto } = usePropertyPhotos();

      const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });

      vi.mocked(db.properties.get).mockResolvedValue({
        id: 1,
        name: 'Test Property',
        photos: [],
      } as any);

      vi.mocked(db.documents.add).mockResolvedValue(10);
      vi.mocked(db.documents.get).mockResolvedValue({
        id: 10,
        name: 'photo.jpg',
        type: 'photo',
        data: new Blob(),
      } as any);

      const result = await addPropertyPhoto(1, file);

      expect(result).toBeTruthy();
      expect(db.documents.add).toHaveBeenCalled();
      expect(db.properties.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          photos: [10],
        })
      );
    });
  });

  describe('setPrimaryPhoto', () => {
    it('should move photo to first position', async () => {
      const { setPrimaryPhoto } = usePropertyPhotos();

      vi.mocked(db.properties.get).mockResolvedValue({
        id: 1,
        name: 'Test Property',
        photos: [1, 2, 3],
      } as any);

      await setPrimaryPhoto(1, 3);

      expect(db.properties.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          photos: [3, 1, 2],
        })
      );
    });
  });

  describe('removePropertyPhoto', () => {
    it('should remove photo from property and delete document', async () => {
      const { removePropertyPhoto } = usePropertyPhotos();

      vi.mocked(db.properties.get).mockResolvedValue({
        id: 1,
        name: 'Test Property',
        photos: [1, 2, 3],
      } as any);

      await removePropertyPhoto(1, 2);

      expect(db.properties.update).toHaveBeenCalledWith(
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
      const { createPhotoUrl, revokePhotoUrl } = usePropertyPhotos();

      const blob = new Blob(['image'], { type: 'image/jpeg' });
      const url = createPhotoUrl(blob);

      expect(url).toMatch(/^blob:/);

      // Should not throw
      expect(() => revokePhotoUrl(url)).not.toThrow();
    });
  });
});
