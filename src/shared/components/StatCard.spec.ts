import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StatCard from './StatCard.vue';

describe('StatCard', () => {
  it('should display label and value', () => {
    const wrapper = mount(StatCard, {
      props: {
        label: 'Total Revenue',
        value: '€12,500',
      },
    });
    expect(wrapper.text()).toContain('Total Revenue');
    expect(wrapper.text()).toContain('€12,500');
  });

  it('should display numeric value', () => {
    const wrapper = mount(StatCard, {
      props: {
        label: 'Properties',
        value: 42,
      },
    });
    expect(wrapper.text()).toContain('42');
  });

  it('should display icon with default primary color', () => {
    const wrapper = mount(StatCard, {
      props: {
        label: 'Revenue',
        value: 1000,
        icon: 'currency-eur',
      },
    });
    expect(wrapper.find('.mdi-currency-eur').exists()).toBe(true);
    expect(wrapper.find('.stat-icon-primary').exists()).toBe(true);
  });

  it('should apply icon color', () => {
    const wrapper = mount(StatCard, {
      props: {
        label: 'Success',
        value: 100,
        icon: 'check',
        iconColor: 'success',
      },
    });
    expect(wrapper.find('.stat-icon-success').exists()).toBe(true);
  });

  it('should display trend up', () => {
    const wrapper = mount(StatCard, {
      props: {
        label: 'Growth',
        value: 1000,
        trend: { value: 12, direction: 'up' as const },
      },
    });
    expect(wrapper.find('.trend-up').exists()).toBe(true);
    expect(wrapper.find('.mdi-arrow-up').exists()).toBe(true);
    expect(wrapper.text()).toContain('12');
  });

  it('should display trend down', () => {
    const wrapper = mount(StatCard, {
      props: {
        label: 'Decline',
        value: 500,
        trend: { value: -8, direction: 'down' as const },
      },
    });
    expect(wrapper.find('.trend-down').exists()).toBe(true);
    expect(wrapper.find('.mdi-arrow-down').exists()).toBe(true);
    expect(wrapper.text()).toContain('8'); // Math.abs() removes the minus
  });

  it('should render custom trend label slot', () => {
    const wrapper = mount(StatCard, {
      props: {
        label: 'Custom',
        value: 100,
        trend: { value: 5, direction: 'up' as const },
      },
      slots: {
        'trend-label': 'vs last week',
      },
    });
    expect(wrapper.text()).toContain('vs last week');
  });

  it('should not display trend when not provided', () => {
    const wrapper = mount(StatCard, {
      props: {
        label: 'No Trend',
        value: 100,
      },
    });
    expect(wrapper.find('.stat-trend').exists()).toBe(false);
  });

  it('should apply all icon colors', () => {
    const colors: Array<'primary' | 'success' | 'warning' | 'accent' | 'error'> = [
      'primary',
      'success',
      'warning',
      'accent',
      'error',
    ];

    colors.forEach((color) => {
      const wrapper = mount(StatCard, {
        props: {
          label: 'Test',
          value: 100,
          icon: 'test',
          iconColor: color,
        },
      });
      expect(wrapper.find(`.stat-icon-${color}`).exists()).toBe(true);
    });
  });
});
