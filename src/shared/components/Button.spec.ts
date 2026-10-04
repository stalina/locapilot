import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Button from '@/shared/components/Button.vue';
import { contrastRatio, themeColors, type Theme } from '@/test/themeColors';

// The neutral variants paint --text-primary, which turns near-white in dark
// mode, so their backgrounds must follow the theme too.
describe('Button theme colours', () => {
  const resolve = themeColors('src/shared/components/Button.vue');
  const text = (variant: string, theme: Theme) => resolve('color', [`.btn-${variant}`], theme);
  const background = (variant: string, theme: Theme) =>
    resolve('background', [`.btn-${variant}`], theme);
  const hoverBackground = (variant: string, theme: Theme) =>
    resolve('background', [`.btn-${variant}`, `.btn-${variant}:hover:not(:disabled)`], theme);

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it.each(['secondary', 'default'])(
      'keeps the %s variant readable at rest and on hover',
      variant => {
        expect(
          contrastRatio(text(variant, theme), background(variant, theme))
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(text(variant, theme), hoverBackground(variant, theme))
        ).toBeGreaterThanOrEqual(4.5);
      }
    );

    it.each(['secondary', 'default'])('gives the %s variant a visible hover', variant => {
      expect(hoverBackground(variant, theme)).not.toBe(background(variant, theme));
    });

    it.each(['ghost', 'text'])('keeps the %s variant readable on hover', variant => {
      expect(
        contrastRatio(text(variant, theme), hoverBackground(variant, theme))
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('keeps the light theme colours of the neutral variants unchanged', () => {
    expect({
      secondary: [background('secondary', 'light'), hoverBackground('secondary', 'light')],
      default: [background('default', 'light'), hoverBackground('default', 'light')],
      ghostHover: hoverBackground('ghost', 'light'),
      textHover: hoverBackground('text', 'light'),
    }).toEqual({
      secondary: ['#f5f5f5', '#e5e5e5'],
      default: ['#e5e5e5', '#d4d4d4'],
      ghostHover: '#f5f5f5',
      textHover: '#f5f5f5',
    });
  });
});

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
