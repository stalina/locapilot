import type { Document } from '@/db/types';

export type DocumentPreviewKind = 'pdf' | 'image';

/**
 * Returns the inline-preview kind supported for a mimeType, or null when
 * the document cannot be previewed in the app (e.g. .docx, .zip…).
 */
export function documentPreviewKind(mimeType: unknown): DocumentPreviewKind | null {
  if (typeof mimeType !== 'string') return null;
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

/** True when the document can be previewed inline (PDF or image). */
export function canPreviewDocument(mimeType: unknown): boolean {
  return documentPreviewKind(mimeType) !== null;
}

export interface DocumentPreviewSource {
  /** URL usable as iframe/img src (object URL or data URL). */
  url: string;
  /** Revokes the underlying object URL (no-op for data URLs). Idempotent. */
  revoke: () => void;
}

/**
 * Extracts the binary content of a document as a Blob, defensively handling
 * the shapes found in real databases (Blob, data URL string, ArrayBuffer-like
 * objects coming from JSON imports). Returns null when the data is unusable.
 */
export function extractDocumentBlob(document: Document): Blob | null {
  const data: unknown = document.data as unknown;
  try {
    if (!data) return null;

    if (data instanceof Blob) {
      // Stored Blobs (seeded/imported/uploaded via File.slice()) may carry an
      // empty or incorrect `.type`. An object URL built from such a Blob is
      // served with the wrong/empty Content-Type, so an <iframe> renders a PDF
      // as raw text. Re-type the Blob against the document's declared mimeType
      // so the preview source always advertises the correct content type.
      const desiredType = document.mimeType || data.type || 'application/octet-stream';
      if (data.type === desiredType) {
        return data;
      }
      return data.slice(0, data.size, desiredType);
    }

    if (typeof data === 'object' && data !== null) {
      const buf = (data as { buffer?: unknown }).buffer;
      if (buf instanceof ArrayBuffer) {
        return new Blob([new Uint8Array(buf)], {
          type: document.mimeType || 'application/octet-stream',
        });
      }
    }

    return null;
  } catch (err) {
    console.error('Failed to extract document blob', err);
    return null;
  }
}

/**
 * Creates a displayable source (object URL or data URL) for a document.
 * The caller MUST call `revoke()` once the preview is closed/unmounted.
 * Returns null when the document data is missing or unreadable.
 */
export function createDocumentPreviewSource(document: Document): DocumentPreviewSource | null {
  const data: unknown = document.data as unknown;
  try {
    // Some imports store the content as a data URL string
    if (typeof data === 'string' && data.startsWith('data:')) {
      return { url: data, revoke: () => {} };
    }

    const blob = extractDocumentBlob(document);
    if (!blob) return null;

    let revoked = false;
    const url = URL.createObjectURL(blob);
    return {
      url,
      revoke: () => {
        if (revoked) return;
        revoked = true;
        URL.revokeObjectURL(url);
      },
    };
  } catch (err) {
    console.error('Failed to create document preview source', err);
    return null;
  }
}
