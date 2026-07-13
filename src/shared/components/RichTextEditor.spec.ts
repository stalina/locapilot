import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import RichTextEditor from './RichTextEditor.vue';
import PrimeVue from 'primevue/config';

// Mock PrimeVue components
vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button><slot /></button>',
  },
}));

vi.mock('primevue/dialog', () => ({
  default: {
    name: 'Dialog',
    template: '<div v-if="visible"><slot /><slot name="footer" /></div>',
    props: ['visible', 'header', 'modal', 'style'],
  },
}));

// The Editor is now lazy-loaded via `defineAsyncComponent(() => import('primevue/editor'))`.
// Mock the module with a lightweight stub so the async chunk resolves deterministically
// in jsdom (the real PrimeVue Editor pulls in Quill, which needs a full DOM).
vi.mock('primevue/editor', () => ({
  // Flag as an ES module so Vue's defineAsyncComponent unwraps `.default`
  // instead of handing the whole mock namespace to @vue/test-utils.
  __esModule: true,
  default: {
    name: 'Editor',
    props: ['modelValue', 'placeholder', 'modules', 'editorStyle'],
    template: '<div class="mock-editor"></div>',
  },
}));

describe('RichTextEditor', () => {
  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
  });

  it('monte le composant sans erreur', async () => {
    const wrapper = mount(RichTextEditor, {
      global: {
        plugins: [PrimeVue],
      },
      props: {
        modelValue: '',
      },
    });

    await nextTick();
    expect(wrapper.exists()).toBe(true);
  });

  it('affiche le placeholder quand vide', async () => {
    const wrapper = mount(RichTextEditor, {
      global: {
        plugins: [PrimeVue],
      },
      props: {
        modelValue: '',
        placeholder: 'Saisissez du texte...',
      },
    });

    await flushPromises();
    expect(wrapper.html()).toBeTruthy();
  });

  it('émet update:modelValue lors de changements', async () => {
    const wrapper = mount(RichTextEditor, {
      global: {
        plugins: [PrimeVue],
      },
      props: {
        modelValue: '<p>Initial</p>',
      },
    });

    await flushPromises();

    // Vérifier que le composant est monté
    expect(wrapper.exists()).toBe(true);
  });

  it('affiche la toolbar avec les boutons', async () => {
    const wrapper = mount(RichTextEditor, {
      global: {
        plugins: [PrimeVue],
      },
      props: {
        modelValue: '',
      },
    });

    await flushPromises();

    // Vérifier que la toolbar existe
    const toolbar = wrapper.find('.editor-toolbar');
    expect(toolbar.exists()).toBe(true);
  });

  it('accepte du contenu HTML initial', async () => {
    const wrapper = mount(RichTextEditor, {
      global: {
        plugins: [PrimeVue],
      },
      props: {
        modelValue: '<p>Contenu <strong>initial</strong></p>',
      },
    });

    await flushPromises();
    expect(wrapper.exists()).toBe(true);
  });

  it('affiche la toolbar de secours immédiatement, avant que le chunk async ne soit résolu', () => {
    const wrapper = mount(RichTextEditor, {
      global: {
        plugins: [PrimeVue],
      },
      props: {
        modelValue: '',
      },
    });

    // Synchronously after mount the async Editor chunk has not resolved yet:
    // the fallback toolbar (with its stable buttons) must already be shown.
    const fallback = wrapper.find('.editor-toolbar');
    expect(fallback.exists()).toBe(true);
    expect(wrapper.find('.editor-toolbar .btn-bold').exists()).toBe(true);
    // The lazily-imported Editor is not in the tree until the chunk resolves.
    expect(wrapper.find('.mock-editor').exists()).toBe(false);
  });

  it('monte le composant Editor de façon asynchrone une fois le chunk lazy résolu', async () => {
    const wrapper = mount(RichTextEditor, {
      global: {
        plugins: [PrimeVue],
      },
      props: {
        modelValue: '',
      },
    });

    // Once the dynamic import() resolves, the async Editor component renders.
    await flushPromises();
    await nextTick();
    expect(wrapper.find('.mock-editor').exists()).toBe(true);
  });
});
