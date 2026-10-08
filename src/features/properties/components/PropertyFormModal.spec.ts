/* eslint-env vitest */
/* global describe,it,expect */
import { vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { Property } from '@/db/types';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
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
    } as any);

    // Access the component's vm to read reactive formData
    const vm: any = wrapper.vm;
    // Wait a tick for immediate watch
    await wrapper.vm.$nextTick();
    expect(vm.formData.annonce).toBe(defaultAnnonceTemplate());
  });
});

describe('PropertyFormModal purchase price and acquisition costs', () => {
  const ModalStub = { template: '<div><slot /><slot name="footer" /></div>' };

  async function mountFilled() {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = usePropertiesStore();
    const createSpy = vi.spyOn(store, 'createProperty').mockResolvedValue(1);
    const wrapper = mount(PropertyFormModal, {
      props: { modelValue: true, property: null },
      global: { plugins: [pinia], stubs: { Modal: ModalStub, RichTextEditor: true } },
    });
    await wrapper.find('[data-testid="property-name"]').setValue('Appart Gambetta T2');
    await wrapper.find('[data-testid="property-address"]').setValue('10 rue Gambetta');
    await wrapper.find('[data-testid="property-surface"]').setValue('45');
    await wrapper.find('[data-testid="property-rooms"]').setValue('2');
    await wrapper.find('[data-testid="property-rent"]').setValue('800');
    return { wrapper, createSpy };
  }

  async function submit(wrapper: VueWrapper) {
    await wrapper.find('[data-testid="property-form-submit"]').trigger('click');
    await flushPromises();
  }

  it('saves the purchase price and acquisition costs', async () => {
    const { wrapper, createSpy } = await mountFilled();
    await wrapper.find('[data-testid="property-purchasePrice"]').setValue('180000');
    await wrapper.find('[data-testid="property-acquisitionCosts"]').setValue('15000');

    await submit(wrapper);

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ purchasePrice: 180000, acquisitionCosts: 15000 })
    );
  });

  it('leaves both fields undefined when they are empty', async () => {
    const { wrapper, createSpy } = await mountFilled();

    await submit(wrapper);

    const saved = createSpy.mock.calls[0]?.[0];
    expect(saved).toBeDefined();
    expect(saved?.purchasePrice).toBeUndefined();
    expect(saved?.acquisitionCosts).toBeUndefined();
  });

  it('rejects a negative purchase price or acquisition costs', async () => {
    const { wrapper, createSpy } = await mountFilled();
    await wrapper.find('[data-testid="property-purchasePrice"]').setValue('-1000');
    await wrapper.find('[data-testid="property-acquisitionCosts"]').setValue('-500');

    await submit(wrapper);

    expect(wrapper.text()).toContain("Le prix d'acquisition ne peut pas être négatif");
    expect(wrapper.text()).toContain("Les frais d'acquisition ne peuvent pas être négatifs");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('pre-fills the fields when editing a property', () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const property: Property = {
      id: 3,
      name: 'Studio',
      address: '1 rue X',
      type: 'studio',
      surface: 20,
      rooms: 1,
      rent: 500,
      purchasePrice: 90000,
      acquisitionCosts: 7000,
      status: 'vacant',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const wrapper = mount(PropertyFormModal, {
      props: { modelValue: true, property },
      global: { plugins: [pinia], stubs: { Modal: ModalStub, RichTextEditor: true } },
    });
    const price = wrapper.find('[data-testid="property-purchasePrice"]').element;
    const costs = wrapper.find('[data-testid="property-acquisitionCosts"]').element;
    expect(price instanceof HTMLInputElement && price.value).toBe('90000');
    expect(costs instanceof HTMLInputElement && costs.value).toBe('7000');
  });
});
