import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Badge from '@/shared/components/Badge.vue';

describe('Badge', () => {
  it('should render slot content', () => {
    const wrapper = mount(Badge, {
      slots: {
        default: 'Active',
      },
    });
    expect(wrapper.text()).toContain('Active');
  });

  it('should apply primary variant by default', () => {
    const wrapper = mount(Badge);
    expect(wrapper.classes()).toContain('badge-primary');
  });

  it('should apply correct variant class', () => {
    const wrapper = mount(Badge, {
      props: {
        variant: 'error',
      },
    });
    expect(wrapper.classes()).toContain('badge-error');
  });

  it('should apply warning variant', () => {
    const wrapper = mount(Badge, {
      props: {
        variant: 'warning',
      },
    });
    expect(wrapper.classes()).toContain('badge-warning');
  });

  it('should apply info variant', () => {
    const wrapper = mount(Badge, {
      props: {
        variant: 'info',
      },
    });
    expect(wrapper.classes()).toContain('badge-info');
  });

  it('should apply default variant', () => {
    const wrapper = mount(Badge, {
      props: {
        variant: 'default',
      },
    });
    expect(wrapper.classes()).toContain('badge-default');
  });
});
