import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Button from '@/shared/components/Button.vue';

describe('Button', () => {
  it('should render slot content', () => {
    const wrapper = mount(Button, {
      slots: {
        default: 'Click me',
      },
    });
    expect(wrapper.text()).toContain('Click me');
  });

  it('should apply primary variant by default', () => {
    const wrapper = mount(Button);
    expect(wrapper.classes()).toContain('btn-primary');
  });

  it('should apply correct variant class', () => {
    const wrapper = mount(Button, {
      props: {
        variant: 'danger',
      },
    });
    expect(wrapper.classes()).toContain('btn-danger');
  });

  it('should be disabled when disabled prop is true', () => {
    const wrapper = mount(Button, {
      props: {
        disabled: true,
      },
    });
    expect(wrapper.attributes('disabled')).toBeDefined();
  });

  it('should emit click event', async () => {
    const wrapper = mount(Button);
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeTruthy();
  });

  it('should not emit click when disabled', async () => {
    const wrapper = mount(Button, {
      props: {
        disabled: true,
      },
    });
    await wrapper.trigger('click');
    expect(wrapper.emitted('click')).toBeFalsy();
  });

  it('should render icon when icon prop is provided', () => {
    const wrapper = mount(Button, {
      props: {
        icon: 'plus',
      },
    });
    expect(wrapper.html()).toContain('mdi-plus');
  });

  it('should apply size class when size prop is provided', () => {
    const wrapper = mount(Button, {
      props: {
        size: 'lg',
      },
    });
    expect(wrapper.classes()).toContain('btn-lg');
  });
});
