import { describe, it, expect } from 'vitest';
import { buildDocumentFromFile } from './documentsService';

describe('buildDocumentFromFile', () => {
  it('stores a Blob that preserves the file MIME type', () => {
    const file = new File(['%PDF-1.7 binary'], 'lease.pdf', {
      type: 'application/pdf',
    });

    const doc = buildDocumentFromFile(file, { type: 'lease' });

    expect(doc.mimeType).toBe('application/pdf');
    expect(doc.data).toBeInstanceOf(Blob);
    // Regression: File.slice() with no contentType drops the type and breaks
    // inline preview (see #45). The stored Blob must keep the correct type.
    expect((doc.data as Blob).type).toBe('application/pdf');
    expect(doc.size).toBe(file.size);
    expect(doc.name).toBe('lease.pdf');
  });

  it('carries over the provided metadata and timestamps', () => {
    const now = new Date('2026-02-03T10:00:00.000Z');
    const file = new File(['x'], 'photo.png', { type: 'image/png' });

    const doc = buildDocumentFromFile(file, { type: 'photo' }, now);

    expect(doc.type).toBe('photo');
    expect(doc.createdAt).toBe(now);
    expect(doc.updatedAt).toBe(now);
    expect((doc.data as Blob).type).toBe('image/png');
  });
});
