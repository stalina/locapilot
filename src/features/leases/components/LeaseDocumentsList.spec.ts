import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { Document } from '@/db/types';
import LeaseDocumentsList from './LeaseDocumentsList.vue';

// --- Mock the documents store -------------------------------------------------
const documents = vi.hoisted(() => ({ list: [] as Document[] }));

const uploadDocument = vi.fn();
const deleteDocument = vi.fn();
const downloadDocument = vi.fn();
const fetchDocuments = vi.fn();

vi.mock('@/features/documents/stores/documentsStore', () => ({
  useDocumentsStore: () => ({
    documentsByEntity: (entityType: string, entityId: number) =>
      documents.list.filter(
        d => d.relatedEntityType === entityType && d.relatedEntityId === entityId
      ),
    uploadDocument,
    deleteDocument,
    downloadDocument,
    fetchDocuments,
  }),
}));

// Stub shared components so we can drive the component from the DOM
vi.mock('@/shared/components/Button.vue', () => ({
  default: {
    name: 'Button',
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock('@/shared/components/DocumentCard.vue', () => ({
  default: {
    name: 'DocumentCard',
    props: ['document'],
    emits: ['download', 'delete'],
    template:
      '<div class="document-card" :data-name="document.name">' +
      '{{ document.name }} — {{ document.description }}' +
      '<button class="dl" @click="$emit(\'download\')">dl</button>' +
      '<button class="del" @click="$emit(\'delete\')">del</button>' +
      '</div>',
  },
}));

function makeDoc(overrides: Partial<Document>): Document {
  return {
    id: 1,
    name: 'file.pdf',
    type: 'other',
    relatedEntityType: 'lease',
    relatedEntityId: 42,
    mimeType: 'application/pdf',
    size: 100,
    data: new Blob(['x']),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Document;
}

describe('LeaseDocumentsList', () => {
  beforeEach(() => {
    documents.list = [];
    uploadDocument.mockReset();
    deleteDocument.mockReset();
    downloadDocument.mockReset();
    fetchDocuments.mockReset();
    vi.restoreAllMocks();
  });

  it('fetches documents on mount', async () => {
    mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    await flushPromises();
    expect(fetchDocuments).toHaveBeenCalledOnce();
  });

  it('shows an empty state with a call to action when the lease has no documents', () => {
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    expect(wrapper.find('[data-testid="lease-documents-empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="lease-documents-list"]').exists()).toBe(false);
  });

  it('only lists documents attached to the given lease', () => {
    documents.list = [
      makeDoc({ id: 1, name: 'mine.pdf', relatedEntityId: 42 }),
      makeDoc({ id: 2, name: 'other-lease.pdf', relatedEntityId: 99 }),
      makeDoc({
        id: 3,
        name: 'a-property.pdf',
        relatedEntityType: 'property',
        relatedEntityId: 42,
      }),
    ];
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    const cards = wrapper.findAll('.document-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.attributes('data-name')).toBe('mine.pdf');
  });

  it('sorts documents most-recent-first', () => {
    documents.list = [
      makeDoc({ id: 1, name: 'old.pdf', createdAt: new Date('2026-01-01') }),
      makeDoc({ id: 2, name: 'new.pdf', createdAt: new Date('2026-06-01') }),
      makeDoc({ id: 3, name: 'mid.pdf', createdAt: new Date('2026-03-01') }),
    ];
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    const names = wrapper.findAll('.document-card').map(c => c.attributes('data-name'));
    expect(names).toEqual(['new.pdf', 'mid.pdf', 'old.pdf']);
  });

  it('lists generated documents alongside manual ones without duplication', () => {
    documents.list = [
      makeDoc({ id: 1, name: 'garant.pdf', type: 'other', description: 'Garant' }),
      makeDoc({
        id: 2,
        name: 'attestation.pdf',
        type: 'lease',
        description: 'Attestation de remise des clés',
      }),
    ];
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    const names = wrapper.findAll('.document-card').map(c => c.attributes('data-name'));
    expect(names).toHaveLength(2);
    expect(names).toContain('garant.pdf');
    expect(names).toContain('attestation.pdf');
  });

  it('uploads with the mapped type and lease metadata for the "Garant" category', async () => {
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 42 } });

    // Open upload form via empty-state CTA
    await wrapper.find('[data-testid="lease-documents-empty"] button').trigger('click');

    const file = new File(['data'], 'garant.pdf', { type: 'application/pdf' });
    const input = wrapper.find('[data-testid="lease-document-file"]');
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
    await input.trigger('change');

    await wrapper.find('[data-testid="lease-document-category"]').setValue('garant');
    await wrapper.find('[data-testid="lease-document-submit"]').trigger('click');
    await flushPromises();

    expect(uploadDocument).toHaveBeenCalledWith(file, {
      type: 'other',
      relatedEntityType: 'lease',
      relatedEntityId: 42,
      description: 'Garant',
    });
  });

  it('maps the "Bail signé" category to the lease document type', async () => {
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 7 } });
    await wrapper.find('[data-testid="lease-documents-empty"] button').trigger('click');

    const file = new File(['data'], 'bail.pdf', { type: 'application/pdf' });
    const input = wrapper.find('[data-testid="lease-document-file"]');
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
    await input.trigger('change');

    // 'bail' is the default category, but set it explicitly
    await wrapper.find('[data-testid="lease-document-category"]').setValue('bail');
    await wrapper.find('[data-testid="lease-document-submit"]').trigger('click');
    await flushPromises();

    expect(uploadDocument).toHaveBeenCalledWith(
      file,
      expect.objectContaining({ type: 'lease', relatedEntityId: 7, description: 'Bail signé' })
    );
  });

  it('does not upload when no file is selected', async () => {
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    await wrapper.find('[data-testid="lease-documents-empty"] button').trigger('click');
    await wrapper.find('[data-testid="lease-document-submit"]').trigger('click');
    await flushPromises();
    expect(uploadDocument).not.toHaveBeenCalled();
  });

  it('deletes a document after confirmation', async () => {
    documents.list = [makeDoc({ id: 5, name: 'garant.pdf' })];
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    await wrapper.find('.document-card .del').trigger('click');
    await flushPromises();
    expect(deleteDocument).toHaveBeenCalledWith(5);
  });

  it('does not delete when the confirmation is dismissed', async () => {
    documents.list = [makeDoc({ id: 5, name: 'garant.pdf' })];
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    await wrapper.find('.document-card .del').trigger('click');
    await flushPromises();
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it('downloads a document', async () => {
    documents.list = [makeDoc({ id: 8, name: 'garant.pdf' })];
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    await wrapper.find('.document-card .dl').trigger('click');
    await flushPromises();
    expect(downloadDocument).toHaveBeenCalledWith(8);
  });

  it('renders the list once documents exist and hides the empty state', async () => {
    const wrapper = mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    expect(wrapper.find('[data-testid="lease-documents-empty"]').exists()).toBe(true);
    documents.list = [makeDoc({ id: 1, name: 'garant.pdf' })];
    // remount to reflect reactive-independent mock change
    const w2 = mount(LeaseDocumentsList, { props: { leaseId: 42 } });
    await nextTick();
    expect(w2.find('[data-testid="lease-documents-empty"]').exists()).toBe(false);
    expect(w2.find('[data-testid="lease-documents-list"]').exists()).toBe(true);
  });
});
