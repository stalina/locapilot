import type { Document } from '@/db/types';
import { extractDocumentBlob } from './documentPreview';

/**
 * Renders the first page of a PDF document to a PNG data URL, fully locally
 * (pdfjs-dist bundled by Vite — no network access needed).
 *
 * Returns null on ANY failure (missing/corrupted data, unsupported mimeType,
 * rendering error): callers silently fall back to the type icon.
 */
export async function renderPdfFirstPageThumbnail(
  document: Document,
  maxWidth = 160
): Promise<string | null> {
  if (document.mimeType !== 'application/pdf') return null;

  const blob = extractDocumentBlob(document);
  if (!blob) return null;

  try {
    const [pdfjs, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const loadingTask = pdfjs.getDocument({ data: bytes });
    try {
      const pdfDocument = await loadingTask.promise;
      const page = await pdfDocument.getPage(1);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = baseViewport.width > 0 ? maxWidth / baseViewport.width : 1;
      const viewport = page.getViewport({ scale });

      const canvas = window.document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));

      await page.render({ canvas, viewport }).promise;
      return canvas.toDataURL('image/png');
    } finally {
      await loadingTask.destroy();
    }
  } catch {
    // Silent fallback: the caller shows the type icon instead
    return null;
  }
}
