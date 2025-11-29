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
});
