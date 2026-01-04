import { defineStore } from 'pinia';
import type { Document } from '@/db/types';
import {
  createDocument as createDocumentRepo,
  deleteDocument as deleteDocumentRepo,
  fetchAllDocuments,
  fetchDocumentById as fetchDocumentByIdRepo,
  updateDocument as updateDocumentRepo,
} from '../repositories/documentsRepository';
import {
  buildDocumentFromFile,
  triggerDocumentDownload,
  type UploadDocumentMetadata,
} from '../services/documentsService';

interface DocumentsState {
  documents: Document[];
  currentDocument: Document | null;
  isLoading: boolean;
  error: string | null;
  uploadProgress: number;
}

export const useDocumentsStore = defineStore('documents', {
  state: (): DocumentsState => ({
    documents: [],
    currentDocument: null,
    isLoading: false,
    error: null,
    uploadProgress: 0,
  }),

  getters: {
    // Documents par type
    documentsByType: state => (type: Document['type']) =>
      state.documents.filter(d => d.type === type),

    // Documents par entité (property, tenant, lease)
    documentsByEntity: state => (entityType: string, entityId: number) =>
      state.documents.filter(
        d => d.relatedEntityType === entityType && d.relatedEntityId === entityId
      ),

    // Documents récents (30 derniers jours)
    recentDocuments: state => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return state.documents
        .filter(d => new Date(d.createdAt) >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    // Taille totale des documents (en bytes)
    totalSize: state => state.documents.reduce((sum, d) => sum + d.size, 0),

    // Nombre de documents par type
    documentCounts: state => {
      const counts: Record<string, number> = {
        lease: 0,
        inventory: 0,
        invoice: 0,
        insurance: 0,
        other: 0,
      };
      state.documents.forEach(d => {
        counts[d.type] = (counts[d.type] || 0) + 1;
      });
      return counts;
    },
  },

  actions: {
    async fetchDocuments() {
      this.isLoading = true;
      this.error = null;
      try {
        this.documents = await fetchAllDocuments();
      } catch (error) {
        this.error = 'Échec du chargement des documents';
        console.error('Failed to fetch documents:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async fetchDocumentById(id: number) {
      this.isLoading = true;
      this.error = null;
      try {
        const document = await fetchDocumentByIdRepo(id);
        if (document) {
          this.currentDocument = document;
        } else {
          this.error = 'Document non trouvé';
        }
      } catch (error) {
        this.error = 'Échec du chargement du document';
        console.error('Failed to fetch document:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async uploadDocument(file: File, metadata: UploadDocumentMetadata) {
      this.isLoading = true;
      this.error = null;
      this.uploadProgress = 0;

      try {
        // Simuler une progression (dans un vrai cas, utiliser XMLHttpRequest avec onprogress)
        const progressInterval = setInterval(() => {
          if (this.uploadProgress < 90) {
            this.uploadProgress += 10;
          }
        }, 100);

        clearInterval(progressInterval);
        this.uploadProgress = 100;

        const now = new Date();
        const newDocument: Omit<Document, 'id'> = buildDocumentFromFile(file, metadata, now);

        const addedDocument = await createDocumentRepo(newDocument);
        if (addedDocument) this.documents.push(addedDocument);
        this.uploadProgress = 0;

        return addedDocument;
      } catch (error) {
        this.error = 'Échec du téléversement du document';
        console.error('Failed to upload document:', error);
        this.uploadProgress = 0;
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async updateDocument(
      id: number,
      updates: Partial<Omit<Document, 'id' | 'createdAt' | 'data'>>
    ) {
      this.isLoading = true;
      this.error = null;
      try {
        const updateData = {
          ...updates,
          updatedAt: new Date(),
        };
        await updateDocumentRepo(id, updateData);

        const index = this.documents.findIndex((d: Document) => d.id === id);
        if (index !== -1) {
          this.documents[index] = { ...this.documents[index], ...updateData } as Document;
        }

        if (this.currentDocument?.id === id) {
          this.currentDocument = { ...this.currentDocument, ...updateData } as Document;
        }
      } catch (error) {
        this.error = 'Échec de la mise à jour du document';
        console.error('Failed to update document:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async deleteDocument(id: number) {
      this.isLoading = true;
      this.error = null;
      try {
        await deleteDocumentRepo(id);
        this.documents = this.documents.filter((d: Document) => d.id !== id);
        if (this.currentDocument?.id === id) {
          this.currentDocument = null;
        }
      } catch (error) {
        this.error = 'Échec de la suppression du document';
        console.error('Failed to delete document:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async downloadDocument(id: number) {
      try {
        const document = await fetchDocumentByIdRepo(id);
        if (!document) {
          this.error = 'Document non trouvé';
          return;
        }

        triggerDocumentDownload(document);
      } catch (error) {
        this.error = 'Échec du téléchargement du document';
        console.error('Failed to download document:', error);
        throw error;
      }
    },

    formatFileSize(bytes: number): string {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    },

    clearError() {
      this.error = null;
    },
  },
});
