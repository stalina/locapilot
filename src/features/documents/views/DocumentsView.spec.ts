/* eslint-env vitest */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia } from 'pinia';
import DocumentsView from './DocumentsView.vue';
import SearchBox from '@/shared/components/SearchBox.vue';
import { useDocumentsStore } from '../stores/documentsStore';
import type { Document } from '@/db/types';

const route = { query: {} as Record<string, string> };
vi.mock('vue-router', () => ({
  useRoute: () => route,
}));

vi.mock('../services/entityOptionsService', () => ({
  loadEntityOptions: vi.fn().mockResolvedValue([
    { id: 1, label: 'Appart Gambetta' },
    { id: 2, label: 'Studio Belleville' },
  ]),
}));

function doc(overrides: Partial<Document>): Document {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: Math.floor(Math.random() * 100000),
    name: 'doc',
    type: 'other',
    mimeType: 'application/pdf',
    size: 10,
    data: new Blob(['x']),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as Document;
}

const sampleDocs: Document[] = [
  doc({ id: 1, name: 'Bail avenant.pdf', type: 'lease', relatedEntityType: 'lease', relatedEntityId: 1 }),
  doc({ id: 2, name: 'Bail initial.pdf', type: 'lease', relatedEntityType: 'lease', relatedEntityId: 2 }),
  doc({ id: 3, name: 'Photo salon.png', type: 'photo', relatedEntityType: 'property', relatedEntityId: 1 }),
  doc({ id: 4, name: 'Quittance mars.pdf', type: 'receipt', relatedEntityType: 'rent', relatedEntityId: 5 }),
];

function mountView() {
  const pinia = createPinia();
  const store = useDocumentsStore(pinia);
  vi.spyOn(store, 'fetchDocuments').mockResolvedValue(undefined as unknown as void);
  store.documents = [...sampleDocs];
  const wrapper = mount(DocumentsView, {
    global: {
      plugins: [pinia],
      stubs: {
        DocumentCard: {
          props: ['document'],
          template: '<div class="doc-stub">{{ document.name }}</div>',
        },
        DocumentPreviewModal: true,
        UploadZone: true,
        StatCard: true,
      },
    },
  });
  return { wrapper, store };
}

function renderedNames(wrapper: ReturnType<typeof mountView>['wrapper']): string[] {
  return wrapper.findAll('.doc-stub').map(n => n.text());
}

describe('DocumentsView filtering', () => {
  beforeEach(() => {
    route.query = {};
  });

  it('renders all documents by default', async () => {
    const { wrapper } = mountView();
    await flushPromises();
    expect(renderedNames(wrapper)).toHaveLength(4);
  });

  it('filters by related entity type', async () => {
    const { wrapper } = mountView();
    await flushPromises();

    const typeSelect = wrapper.get('[data-testid=entity-type-filter]');
    await typeSelect.setValue('lease');
    await flushPromises();

    expect(renderedNames(wrapper)).toEqual(
      expect.arrayContaining(['Bail avenant.pdf', 'Bail initial.pdf'])
    );
    expect(renderedNames(wrapper)).toHaveLength(2);
  });

  it('narrows to a specific related entity', async () => {
    const { wrapper } = mountView();
    await flushPromises();

    await wrapper.get('[data-testid=entity-type-filter]').setValue('lease');
    await flushPromises();
    await wrapper.get('[data-testid=entity-filter]').setValue('1');
    await flushPromises();

    expect(renderedNames(wrapper)).toEqual(['Bail avenant.pdf']);
  });

  it('resets to all documents when the entity filter goes back to "all"', async () => {
    const { wrapper } = mountView();
    await flushPromises();

    const typeSelect = wrapper.get('[data-testid=entity-type-filter]');
    await typeSelect.setValue('lease');
    await flushPromises();
    expect(renderedNames(wrapper)).toHaveLength(2);

    await typeSelect.setValue('all');
    await flushPromises();
    expect(renderedNames(wrapper)).toHaveLength(4);
  });

  it('combines the entity filter with the type filter and search', async () => {
    const { wrapper } = mountView();
    await flushPromises();

    // entity type: lease
    await wrapper.get('[data-testid=entity-type-filter]').setValue('lease');
    await flushPromises();
    // search: "avenant"
    await wrapper.findComponent(SearchBox).vm.$emit('update:modelValue', 'avenant');
    await nextTick();

    expect(renderedNames(wrapper)).toEqual(['Bail avenant.pdf']);
  });

  it('preserves route-query filtering (relatedEntityType + relatedEntityId)', async () => {
    route.query = { relatedEntityType: 'rent', relatedEntityId: '5' };
    const { wrapper } = mountView();
    await flushPromises();
    expect(renderedNames(wrapper)).toEqual(['Quittance mars.pdf']);
  });
});
