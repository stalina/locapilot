import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Document } from '@/db/types';

const getDocumentMock = vi.fn();
const globalWorkerOptions: { workerSrc: string } = { workerSrc: '' };

vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: globalWorkerOptions,
  getDocument: (...args: unknown[]) => getDocumentMock(...args),
}));

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({
  default: 'mock-worker-url',
}));

import { renderPdfFirstPageThumbnail } from './pdfThumbnail';

function makeDocument(overrides: Partial<Document>): Document {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    name: 'doc.pdf',
    type: 'lease',
    mimeType: 'application/pdf',
    size: 10,
    data: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Document;
}

describe('renderPdfFirstPageThumbnail', () => {
  beforeEach(() => {
    getDocumentMock.mockReset();
  });

  it('returns null for non-PDF documents without touching pdfjs', async () => {
    const doc = makeDocument({ mimeType: 'image/png' });
    expect(await renderPdfFirstPageThumbnail(doc)).toBeNull();
    expect(getDocumentMock).not.toHaveBeenCalled();
  });

  it('returns null when the document data is missing', async () => {
    const doc = makeDocument({ data: undefined as unknown as Blob });
    expect(await renderPdfFirstPageThumbnail(doc)).toBeNull();
    expect(getDocumentMock).not.toHaveBeenCalled();
  });

  it('renders the first page to a PNG data URL', async () => {
    const renderPromise = { promise: Promise.resolve() };
    const page = {
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 200 * scale,
        height: 300 * scale,
      })),
      render: vi.fn(() => renderPromise),
    };
    const pdfDocument = { getPage: vi.fn().mockResolvedValue(page) };
    const destroy = vi.fn().mockResolvedValue(undefined);
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(pdfDocument), destroy });

    // Stub canvas so jsdom returns a data URL
    const toDataURL = vi.fn(() => 'data:image/png;base64,THUMB');
    vi.spyOn(window.document, 'createElement').mockReturnValue({
      width: 0,
      height: 0,
      toDataURL,
    } as unknown as HTMLCanvasElement);

    const result = await renderPdfFirstPageThumbnail(makeDocument({}), 160);

    expect(result).toBe('data:image/png;base64,THUMB');
    expect(pdfDocument.getPage).toHaveBeenCalledWith(1);
    expect(page.render).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('returns null (silent fallback) when pdfjs throws', async () => {
    getDocumentMock.mockReturnValue({
      promise: Promise.reject(new Error('corrupted pdf')),
      destroy: vi.fn().mockResolvedValue(undefined),
    });
    const result = await renderPdfFirstPageThumbnail(makeDocument({}));
    expect(result).toBeNull();
  });
});
