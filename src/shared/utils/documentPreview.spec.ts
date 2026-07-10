import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Document } from '@/db/types';
import {
  documentPreviewKind,
  canPreviewDocument,
  extractDocumentBlob,
  createDocumentPreviewSource,
} from './documentPreview';

function makeDocument(overrides: Partial<Document>): Document {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    name: 'doc',
    type: 'other',
    mimeType: 'application/pdf',
    size: 10,
    data: new Blob(['x'], { type: 'application/pdf' }),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Document;
}

describe('documentPreview', () => {
  describe('documentPreviewKind', () => {
    it('returns "pdf" for application/pdf', () => {
      expect(documentPreviewKind('application/pdf')).toBe('pdf');
    });

    it('returns "image" for any image/* mimeType', () => {
      expect(documentPreviewKind('image/png')).toBe('image');
      expect(documentPreviewKind('image/jpeg')).toBe('image');
      expect(documentPreviewKind('image/webp')).toBe('image');
    });

    it('returns null for unsupported mimeTypes', () => {
      expect(
        documentPreviewKind(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBeNull();
      expect(documentPreviewKind('application/zip')).toBeNull();
    });

    it('returns null for non-string mimeTypes', () => {
      expect(documentPreviewKind(undefined)).toBeNull();
      expect(documentPreviewKind(null)).toBeNull();
      expect(documentPreviewKind(42)).toBeNull();
    });
  });

  describe('canPreviewDocument', () => {
    it('is true for PDFs and images, false otherwise', () => {
      expect(canPreviewDocument('application/pdf')).toBe(true);
      expect(canPreviewDocument('image/gif')).toBe(true);
      expect(canPreviewDocument('text/plain')).toBe(false);
      expect(canPreviewDocument(undefined)).toBe(false);
    });
  });

  describe('extractDocumentBlob', () => {
    it('returns the Blob as-is when data is a Blob', () => {
      const blob = new Blob(['hi'], { type: 'image/png' });
      const doc = makeDocument({ data: blob, mimeType: 'image/png' });
      expect(extractDocumentBlob(doc)).toBe(blob);
    });

    it('wraps an ArrayBuffer-bearing object into a Blob with the document mimeType', () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      const doc = makeDocument({
        data: { buffer } as unknown as Blob,
        mimeType: 'application/pdf',
      });
      const result = extractDocumentBlob(doc);
      expect(result).toBeInstanceOf(Blob);
      expect(result?.type).toBe('application/pdf');
    });

    it('returns null when data is missing', () => {
      const doc = makeDocument({ data: undefined as unknown as Blob });
      expect(extractDocumentBlob(doc)).toBeNull();
    });

    it('returns null for an unusable data shape', () => {
      const doc = makeDocument({ data: { nope: true } as unknown as Blob });
      expect(extractDocumentBlob(doc)).toBeNull();
    });
  });

  describe('createDocumentPreviewSource', () => {
    beforeEach(() => {
      vi.stubGlobal('URL', {
        createObjectURL: vi.fn(() => 'blob:mock-url'),
        revokeObjectURL: vi.fn(),
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('creates an object URL from a Blob and revokes it only once', () => {
      const doc = makeDocument({
        data: new Blob(['pdf'], { type: 'application/pdf' }),
      });
      const source = createDocumentPreviewSource(doc);
      expect(source).not.toBeNull();
      expect(source?.url).toBe('blob:mock-url');
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

      source?.revoke();
      source?.revoke();
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it('returns the data URL directly (no revocation) when data is a data-URL string', () => {
      const doc = makeDocument({
        data: 'data:image/png;base64,AAAA' as unknown as Blob,
        mimeType: 'image/png',
      });
      const source = createDocumentPreviewSource(doc);
      expect(source?.url).toBe('data:image/png;base64,AAAA');
      source?.revoke();
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });

    it('returns null when data is missing or unusable', () => {
      const doc = makeDocument({ data: undefined as unknown as Blob });
      expect(createDocumentPreviewSource(doc)).toBeNull();
    });
  });
});
