import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import DocumentPreviewModal from './DocumentPreviewModal.vue';
import type { Document } from '@/db/types';

let urlCounter = 0;
const revokeObjectURL = vi.fn();

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

describe('DocumentPreviewModal', () => {
  beforeEach(() => {
    urlCounter = 0;
    revokeObjectURL.mockReset();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:mock-${++urlCounter}`),
      revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('renders an image preview for image documents', () => {
    mount(DocumentPreviewModal, {
      props: {
        modelValue: true,
        document: makeDocument({ mimeType: 'image/png', name: 'photo.png' }),
      },
      attachTo: document.body,
    });
    const img = document.body.querySelector('[data-testid=document-preview-image]');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toContain('blob:mock-');
    expect(document.body.querySelector('[data-testid=document-preview-pdf]')).toBeNull();
  });

  it('renders an iframe preview for PDF documents', () => {
    mount(DocumentPreviewModal, {
      props: {
        modelValue: true,
        document: makeDocument({ mimeType: 'application/pdf', name: 'bail.pdf' }),
      },
      attachTo: document.body,
    });
    const frame = document.body.querySelector('[data-testid=document-preview-pdf]');
    expect(frame).toBeTruthy();
    expect(frame?.getAttribute('src')).toContain('blob:mock-');
  });

  it('shows the error fallback when the data cannot be read', () => {
    mount(DocumentPreviewModal, {
      props: {
        modelValue: true,
        document: makeDocument({
          mimeType: 'application/pdf',
          data: undefined as unknown as Blob,
        }),
      },
      attachTo: document.body,
    });
    const error = document.body.querySelector('[data-testid=document-preview-error]');
    expect(error).toBeTruthy();
    expect(error?.textContent).toContain("Impossible d'afficher l'aperçu de ce document");
  });

  it('shows the error fallback for unsupported mime types', () => {
    mount(DocumentPreviewModal, {
      props: {
        modelValue: true,
        document: makeDocument({ mimeType: 'application/zip' }),
      },
      attachTo: document.body,
    });
    expect(document.body.querySelector('[data-testid=document-preview-error]')).toBeTruthy();
  });

  it('revokes the object URL when the modal is closed', async () => {
    const wrapper = mount(DocumentPreviewModal, {
      props: {
        modelValue: true,
        document: makeDocument({ mimeType: 'image/png' }),
      },
      attachTo: document.body,
    });
    expect(revokeObjectURL).not.toHaveBeenCalled();

    await wrapper.setProps({ modelValue: false });
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('revokes the object URL on unmount', () => {
    const wrapper = mount(DocumentPreviewModal, {
      props: {
        modelValue: true,
        document: makeDocument({ mimeType: 'image/png' }),
      },
      attachTo: document.body,
    });
    wrapper.unmount();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('emits download and closes correctly', async () => {
    const wrapper = mount(DocumentPreviewModal, {
      props: {
        modelValue: true,
        document: makeDocument({ mimeType: 'image/png' }),
      },
      attachTo: document.body,
    });

    const downloadBtn = document.body.querySelector<HTMLButtonElement>(
      '[data-testid=document-preview-download]'
    );
    downloadBtn?.click();
    expect(wrapper.emitted('download')).toBeTruthy();

    const closeBtn = document.body.querySelector<HTMLButtonElement>(
      '[data-testid=document-preview-close]'
    );
    closeBtn?.click();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
    expect(wrapper.emitted('close')).toBeTruthy();
  });
});
