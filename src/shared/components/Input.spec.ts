import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Input from '@/shared/components/Input.vue';
import { contrastRatio, themeColors, themeToken } from '@/test/themeColors';

// The typed value uses --text-primary, which turns near-white in dark mode, so
// the field background must follow the theme too.
describe('Input theme colours', () => {
  const resolve = themeColors('src/shared/components/Input.vue');

  it.each(['light', 'dark'] as const)('keeps the typed value readable in %s mode', theme => {
    expect(
      contrastRatio(
        resolve('color', ['.input-field'], theme),
        resolve('background', ['.input-field'], theme)
      )
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['light', 'dark'] as const)(
    'keeps the error message readable on the form surface in %s mode',
    theme => {
      expect(
        contrastRatio(resolve('color', ['.input-error'], theme), themeToken('--bg-primary', theme))
      ).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('follows the theme surface: white in light mode, neutral-900 in dark mode', () => {
    expect(resolve('background', ['.input-field'], 'light')).toBe('#ffffff');
    expect(resolve('background', ['.input-field'], 'dark')).toBe('#171717');
  });

  it('keeps the light error colour unchanged', () => {
    expect(resolve('color', ['.input-error'], 'light')).toBe('#dc2626');
  });

  it('renders native parts such as the date picker icon for a dark background in dark mode only', () => {
    expect(resolve('color-scheme', ['.input-field'], 'dark')).toBe('dark');
    expect(() => resolve('color-scheme', ['.input-field'], 'light')).toThrow();
  });
});

describe('Input', () => {
  it('should render with placeholder', () => {
    const wrapper = mount(Input, {
      props: {
        modelValue: '',
        placeholder: 'Enter text',
      },
    });
    expect(wrapper.find('input').attributes('placeholder')).toBe('Enter text');
  });

  it('should emit update:modelValue on input', async () => {
    const wrapper = mount(Input, {
      props: {
        modelValue: '',
      },
    });

    await wrapper.find('input').setValue('test value');
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['test value']);
  });

  it('should display label when provided', () => {
    const wrapper = mount(Input, {
      props: {
        modelValue: '',
        label: 'Username',
      },
    });
    expect(wrapper.find('label').text()).toContain('Username');
  });

  it('should show error message', () => {
    const wrapper = mount(Input, {
      props: {
        modelValue: '',
        error: 'This field is required',
      },
    });
    expect(wrapper.text()).toContain('This field is required');
    expect(wrapper.find('.input-container').classes()).toContain('has-error');
  });

  it('should apply correct type attribute', () => {
    const wrapper = mount(Input, {
      props: {
        modelValue: '',
        type: 'email',
      },
    });
    expect(wrapper.find('input').attributes('type')).toBe('email');
  });

  it('should be disabled when disabled prop is true', () => {
    const wrapper = mount(Input, {
      props: {
        modelValue: '',
        disabled: true,
      },
    });
    expect(wrapper.find('input').attributes('disabled')).toBeDefined();
  });

  it('should be required when required prop is true', () => {
    const wrapper = mount(Input, {
      props: {
        modelValue: '',
        required: true,
      },
    });
    expect(wrapper.find('input').attributes('required')).toBeDefined();
  });

  it('should render icon when icon prop is provided', () => {
    const wrapper = mount(Input, {
      props: {
        modelValue: '',
        icon: 'search',
      },
    });
    expect(wrapper.html()).toContain('mdi-search');
  });
});
