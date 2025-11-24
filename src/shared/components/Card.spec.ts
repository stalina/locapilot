import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Card from './Card.vue';

describe('Card', () => {
  it('should render slot content', () => {
    const wrapper = mount(Card, {
      slots: {
        default: '<p>Card content</p>',
      },
    });
    expect(wrapper.html()).toContain('Card content');
  });

  it('should apply hover class by default', () => {
    const wrapper = mount(Card);
    expect(wrapper.classes()).toContain('card-hover');
  });

  it('should not apply hover when disabled', () => {
    const wrapper = mount(Card, {
      props: {
        hover: false,
      },
    });
    expect(wrapper.classes()).not.toContain('card-hover');
  });

  it('should apply clickable class', () => {
    const wrapper = mount(Card, {
      props: {
        clickable: true,
      },
    });
    expect(wrapper.classes()).toContain('card-clickable');
  });

  it('should apply bordered class', () => {
    const wrapper = mount(Card, {
      props: {
        bordered: true,
      },
    });
    expect(wrapper.classes()).toContain('card-bordered');
  });

  it('should combine multiple props', () => {
    const wrapper = mount(Card, {
      props: {
        hover: true,
        clickable: true,
        bordered: true,
      },
    });
    expect(wrapper.classes()).toContain('card-hover');
    expect(wrapper.classes()).toContain('card-clickable');
    expect(wrapper.classes()).toContain('card-bordered');
  });
});
