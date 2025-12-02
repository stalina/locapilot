/* eslint-env vitest */
/* global describe,it,expect */
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import PropertyFormModal from './PropertyFormModal.vue';
import { defaultAnnonceTemplate } from '@/shared/utils/annonceTemplate';

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
