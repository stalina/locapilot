import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import DocumentCard from './DocumentCard.vue';
import type { Document } from '@/db/types';

const renderPdfFirstPageThumbnail = vi.fn();

vi.mock('@/shared/utils/pdfThumbnail', () => ({
  renderPdfFirstPageThumbnail: (...args: unknown[]) => renderPdfFirstPageThumbnail(...args),
}));

function makeDocument(overrides: Partial<Document>): Document {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: 1,
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

describe('DocumentCard', () => {
  beforeEach(() => {
    renderPdfFirstPageThumbnail.mockReset();
    renderPdfFirstPageThumbnail.mockResolvedValue(null);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the Preview action for PDF documents', () => {
    const wrapper = mount(DocumentCard, {
      props: { document: makeDocument({ mimeType: 'application/pdf' }) },
    });
    expect(wrapper.find('[data-testid=document-preview-button]').exists()).toBe(true);
  });

  it('shows the Preview action for image documents', () => {
    const wrapper = mount(DocumentCard, {
      props: { document: makeDocument({ mimeType: 'image/jpeg', type: 'photo' }) },
    });
    expect(wrapper.find('[data-testid=document-preview-button]').exists()).toBe(true);
  });

  it('hides the Preview action for unsupported types (e.g. .docx)', () => {
    const wrapper = mount(DocumentCard, {
      props: {
        document: makeDocument({
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      },
    });
    expect(wrapper.find('[data-testid=document-preview-button]').exists()).toBe(false);
  });

  it('emits "preview" when the Preview action is clicked', async () => {
    const wrapper = mount(DocumentCard, {
      props: { document: makeDocument({ mimeType: 'application/pdf' }) },
    });
    await wrapper.find('[data-testid=document-preview-button]').trigger('click');
    expect(wrapper.emitted('preview')).toBeTruthy();
  });

  it('renders a PDF thumbnail when generation succeeds', async () => {
    renderPdfFirstPageThumbnail.mockResolvedValue('data:image/png;base64,THUMB');
    const wrapper = mount(DocumentCard, {
      props: { document: makeDocument({ mimeType: 'application/pdf' }) },
    });
    await flushPromises();
    const thumb = wrapper.find('[data-testid=document-pdf-thumbnail]');
    expect(thumb.exists()).toBe(true);
    expect(thumb.attributes('src')).toBe('data:image/png;base64,THUMB');
  });

  it('falls back to the type icon when the PDF thumbnail cannot be generated', async () => {
    renderPdfFirstPageThumbnail.mockResolvedValue(null);
    const wrapper = mount(DocumentCard, {
      props: { document: makeDocument({ mimeType: 'application/pdf', type: 'lease' }) },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid=document-pdf-thumbnail]').exists()).toBe(false);
    expect(wrapper.find('.document-icon i').exists()).toBe(true);
  });

  it('does not attempt PDF thumbnail generation for non-PDF documents', async () => {
    mount(DocumentCard, {
      props: { document: makeDocument({ mimeType: 'image/png', type: 'photo' }) },
    });
    await flushPromises();
    expect(renderPdfFirstPageThumbnail).not.toHaveBeenCalled();
  });
});
