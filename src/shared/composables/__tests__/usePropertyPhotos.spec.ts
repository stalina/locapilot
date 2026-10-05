import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePropertyPhotos } from '../usePropertyPhotos';
import { db } from '@/db/database';
import type { Document, Property } from '@/db/types';

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

function makeProperty(photos: number[]): Property {
  return {
    id: 1,
    name: 'Test Property',
    address: '1 rue A',
    type: 'apartment',
    surface: 40,
    rooms: 2,
    rent: 700,
    photos,
    status: 'vacant',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

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

describe('usePropertyPhotos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPropertyPhotos', () => {
    it('should return empty array if property has no photos', async () => {
      const { getPropertyPhotos } = usePropertyPhotos();

      vi.mocked(db.properties.get).mockResolvedValue(makeProperty([]));

      const photos = await getPropertyPhotos(1);
      expect(photos).toEqual([]);
    });

    it('should return photos for property', async () => {
      const { getPropertyPhotos } = usePropertyPhotos();

      const mockPhotos = [makePhoto(1, 'photo1.jpg'), makePhoto(2, 'photo2.jpg')];

      vi.mocked(db.properties.get).mockResolvedValue(makeProperty([1, 2]));

      vi.mocked(db.documents.bulkGet).mockResolvedValue(mockPhotos);

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

      vi.mocked(db.properties.get).mockResolvedValue(makeProperty([]));

      vi.mocked(db.documents.add).mockResolvedValue(10);
      vi.mocked(db.documents.get).mockResolvedValue(makePhoto(10, 'photo.jpg'));

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

      vi.mocked(db.properties.get).mockResolvedValue(makeProperty([1, 2, 3]));

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

      vi.mocked(db.properties.get).mockResolvedValue(makeProperty([1, 2, 3]));

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
