import type { Document } from '@/db/types';

export type UploadDocumentMetadata = Omit<
  Document,
  'id' | 'name' | 'mimeType' | 'size' | 'data' | 'createdAt' | 'updatedAt'
>;

export function buildDocumentFromFile(
  file: File,
  metadata: UploadDocumentMetadata,
  now = new Date()
): Omit<Document, 'id'> {
  return {
    ...metadata,
    name: file.name,
    mimeType: file.type,
    size: file.size,
    // Preserve the MIME type on the stored Blob: File.slice() with no
    // contentType argument yields a Blob whose `.type` is empty, which breaks
    // inline preview (the <iframe> renders a PDF as raw text). See #45.
    data: file.slice(0, file.size, file.type),
    createdAt: now,
    updatedAt: now,
  };
}

export function triggerDocumentDownload(document: Document): void {
  const blob = new Blob([document.data], { type: document.mimeType });
  const url = URL.createObjectURL(blob);

  try {
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = document.name;
    window.document.body.appendChild(anchor);
    anchor.click();
    window.document.body.removeChild(anchor);
  } finally {
    URL.revokeObjectURL(url);
  }
}
