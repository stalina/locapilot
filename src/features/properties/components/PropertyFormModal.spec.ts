/* eslint-env vitest */
/* global describe,it,expect */
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import PropertyFormModal from './PropertyFormModal.vue';
import { defaultAnnonceTemplate } from '@/shared/utils/annonceTemplate';
import { contrastRatio, themeColors } from '@/test/themeColors';

// "Type de bien", "Statut", "Nom du bien" and "Adresse" are native fields
// styled here, with --text-primary text that turns near-white in dark mode.
describe('PropertyFormModal theme colours', () => {
  const resolve = themeColors('src/features/properties/components/PropertyFormModal.vue');

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it.each(['.select', '.textarea'])('keeps the value of %s fields readable', field => {
      expect(
        contrastRatio(resolve('color', [field], theme), resolve('background', [field], theme))
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('follows the theme surface: white in light mode, neutral-900 in dark mode', () => {
    expect(resolve('background', ['.select'], 'light')).toBe('#ffffff');
    expect(resolve('background', ['.select'], 'dark')).toBe('#171717');
  });

  it('renders native parts of the fields for a dark background in dark mode only', () => {
    expect(resolve('color-scheme', ['.select'], 'dark')).toBe('dark');
    expect(resolve('color-scheme', ['.textarea'], 'dark')).toBe('dark');
    expect(() => resolve('color-scheme', ['.select'], 'light')).toThrow();
  });
});

describe('PropertyFormModal', () => {
  it('initializes annonce with default template for new property', async () => {
    const pinia = createPinia();
    const wrapper = mount(PropertyFormModal, {
      props: { modelValue: true, property: null },
      global: { plugins: [pinia], stubs: ['Modal', 'RichTextEditor'] },
    });

    // Access the component's vm to read reactive formData (setup state, untyped on vm)
    const vm = wrapper.vm as unknown as { formData: { annonce: string } };
    // Wait a tick for immediate watch
    await wrapper.vm.$nextTick();
    expect(vm.formData.annonce).toBe(defaultAnnonceTemplate());
  });
});
