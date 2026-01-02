/* eslint-env vitest */
/* global describe,it,expect */
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import DashboardView from '@/features/dashboard/views/DashboardView.vue';

describe('DashboardView', () => {
  it('renders heading and stats grid', async () => {
    const pinia = createPinia();
    const wrapper = mount(DashboardView, {
      global: { plugins: [pinia], stubs: ['StatCard', 'Button', 'Badge', 'router-link'] },
    });
    expect(wrapper.text()).toContain('Tableau de bord');
    // stats grid should exist
    expect(wrapper.find('.stats-grid').exists()).toBe(true);
  });
});
