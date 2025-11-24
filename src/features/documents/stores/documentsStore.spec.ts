import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDocumentsStore } from './documentsStore';
import type { Document } from '@/db/types';

vi.mock('@/db/database', () => ({
  db: {
    documents: {
      toArray: vi.fn(),
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { db } from '@/db/database';

describe('documentsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('State', () => {
    it('should initialize with empty documents', () => {
      const store = useDocumentsStore();
      expect(store.documents).toEqual([]);
      expect(store.currentDocument).toBeNull();
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
      expect(store.uploadProgress).toBe(0);
    });
  });

  describe('Getters', () => {
    it('should filter documents by type', () => {
      const store = useDocumentsStore();
      store.documents = [
        { id: 1, type: 'lease', name: 'Lease 1' } as Document,
        { id: 2, type: 'inventory', name: 'Inventory 1' } as Document,
        { id: 3, type: 'lease', name: 'Lease 2' } as Document,
      ];
      
      const leaseDocuments = store.documentsByType('lease');
      expect(leaseDocuments.length).toBe(2);
      expect(leaseDocuments[0]!.type).toBe('lease');
    });

    it('should filter documents by entity', () => {
      const store = useDocumentsStore();
      store.documents = [
        { id: 1, relatedEntityType: 'property', relatedEntityId: 1 } as Document,
        { id: 2, relatedEntityType: 'tenant', relatedEntityId: 1 } as Document,
        { id: 3, relatedEntityType: 'property', relatedEntityId: 1 } as Document,
      ];
      
      const propertyDocs = store.documentsByEntity('property', 1);
      expect(propertyDocs.length).toBe(2);
      expect(propertyDocs[0]!.relatedEntityType).toBe('property');
    });

    it('should calculate total size', () => {
      const store = useDocumentsStore();
      store.documents = [
        { id: 1, size: 1024 } as Document,
        { id: 2, size: 2048 } as Document,
        { id: 3, size: 512 } as Document,
      ];
      
      expect(store.totalSize).toBe(3584); // 1024 + 2048 + 512
    });

    it('should count documents by type', () => {
      const store = useDocumentsStore();
      store.documents = [
        { id: 1, type: 'lease' } as Document,
        { id: 2, type: 'lease' } as Document,
        { id: 3, type: 'inventory' } as Document,
        { id: 4, type: 'other' } as Document,
      ];
      
      const counts = store.documentCounts;
      expect(counts.lease).toBe(2);
      expect(counts.inventory).toBe(1);
      expect(counts.other).toBe(1);
    });
  });

  describe('Actions', () => {
    it('should fetch documents successfully', async () => {
      const mockDocuments = [
        { id: 1, name: 'Doc 1' } as Document,
        { id: 2, name: 'Doc 2' } as Document,
      ];

      vi.mocked(db.documents.toArray).mockResolvedValue(mockDocuments);

      const store = useDocumentsStore();
      await store.fetchDocuments();

      expect(db.documents.toArray).toHaveBeenCalled();
      expect(store.documents.length).toBe(2);
    });

    it('should upload document successfully', async () => {
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const metadata = {
        type: 'lease' as const,
        relatedEntityType: 'property' as const,
        relatedEntityId: 1,
      };

      const mockDocument = {
        id: 1,
        name: 'test.pdf',
        type: 'lease',
        mimeType: 'application/pdf',
        size: file.size,
      } as Document;

      vi.mocked(db.documents.add).mockResolvedValue(1);
      vi.mocked(db.documents.get).mockResolvedValue(mockDocument);

      const store = useDocumentsStore();
      const result = await store.uploadDocument(file, metadata);

      expect(db.documents.add).toHaveBeenCalled();
      expect(result?.name).toBe('test.pdf');
      expect(store.documents.length).toBe(1);
      expect(store.uploadProgress).toBe(0); // Reset after upload
    });

    it('should update document successfully', async () => {
      const existingDoc = {
        id: 1,
        name: 'Old Name.pdf',
        type: 'lease' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Document;

      const updatedDoc = {
        ...existingDoc,
        name: 'New Name.pdf',
      };

      const store = useDocumentsStore();
      store.documents = [existingDoc];

      vi.mocked(db.documents.update).mockResolvedValue(1);
      vi.mocked(db.documents.get).mockResolvedValue(updatedDoc);

      await store.updateDocument(1, { name: 'New Name.pdf' });

      expect(db.documents.update).toHaveBeenCalledWith(1, expect.objectContaining({
        name: 'New Name.pdf',
      }));
      expect(store.documents[0]!.name).toBe('New Name.pdf');
    });

    it('should delete document successfully', async () => {
      const doc1 = { id: 1, name: 'Doc 1' } as Document;
      const doc2 = { id: 2, name: 'Doc 2' } as Document;

      const store = useDocumentsStore();
      store.documents = [doc1, doc2];

      vi.mocked(db.documents.delete).mockResolvedValue(undefined);

      await store.deleteDocument(1);

      expect(db.documents.delete).toHaveBeenCalledWith(1);
      expect(store.documents.length).toBe(1);
      expect(store.documents[0]!.id).toBe(2);
    });

    it('should handle fetch error', async () => {
      vi.mocked(db.documents.toArray).mockRejectedValue(new Error('Fetch failed'));

      const store = useDocumentsStore();
      await store.fetchDocuments();
      
      expect(store.error).toBe('Échec du chargement des documents');
    });

    it('should handle upload error', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const metadata = {
        type: 'lease' as const,
        relatedEntityType: 'property' as const,
        relatedEntityId: 1,
      };

      vi.mocked(db.documents.add).mockRejectedValue(new Error('Upload failed'));

      const store = useDocumentsStore();
      
      await expect(store.uploadDocument(file, metadata)).rejects.toThrow('Upload failed');
      expect(store.error).toBe('Échec du téléversement du document');
    });

    it('should handle update error', async () => {
      vi.mocked(db.documents.update).mockRejectedValue(new Error('Update failed'));

      const store = useDocumentsStore();
      
      await expect(store.updateDocument(1, { name: 'New' })).rejects.toThrow('Update failed');
      expect(store.error).toBe('Échec de la mise à jour du document');
    });

    it('should handle delete error', async () => {
      vi.mocked(db.documents.delete).mockRejectedValue(new Error('Delete failed'));

      const store = useDocumentsStore();
      
      await expect(store.deleteDocument(1)).rejects.toThrow('Delete failed');
      expect(store.error).toBe('Échec de la suppression du document');
    });

    it('should fetch document by id successfully', async () => {
      const mockDocument: Document = {
        id: 1,
        name: 'Test.pdf',
        type: 'lease',
        relatedEntityType: 'property',
        relatedEntityId: 1,
        mimeType: 'application/pdf',
        size: 1024,
        data: new Blob(['test']),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.documents.get).mockResolvedValue(mockDocument);

      const store = useDocumentsStore();
      await store.fetchDocumentById(1);

      expect(store.currentDocument).toEqual(mockDocument);
      expect(store.error).toBeNull();
    });

    it('should handle document not found', async () => {
      vi.mocked(db.documents.get).mockResolvedValue(undefined);

      const store = useDocumentsStore();
      await store.fetchDocumentById(999);

      expect(store.currentDocument).toBeNull();
      expect(store.error).toBe('Document non trouvé');
    });

    it('should handle fetch by id error', async () => {
      vi.mocked(db.documents.get).mockRejectedValue(new Error('Fetch failed'));

      const store = useDocumentsStore();
      await store.fetchDocumentById(1);

      expect(store.error).toBe('Échec du chargement du document');
    });

    it('should clear error', () => {
      const store = useDocumentsStore();
      store.error = 'Test error';

      store.clearError();

      expect(store.error).toBeNull();
    });
  });
});
