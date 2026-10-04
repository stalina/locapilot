import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Modal from '@/shared/components/Modal.vue';
import { contrastRatio, readComponentStyles, themeColors } from '@/test/themeColors';

const MODAL_PATH = 'src/shared/components/Modal.vue';

describe('Modal theme colours', () => {
  const resolve = themeColors(MODAL_PATH);

  it.each(['light', 'dark'] as const)(
    'keeps the title and close button readable on the dialog surface in %s mode',
    theme => {
      const surface = resolve('background', ['.modal'], theme);

      expect(
        contrastRatio(resolve('color', ['.modal-title'], theme), surface)
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(resolve('color', ['.close-button'], theme), surface)
      ).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('follows the theme surface: white in light mode, neutral-900 in dark mode', () => {
    expect(resolve('background', ['.modal'], 'light')).toBe('#ffffff');
    expect(resolve('background', ['.modal'], 'dark')).toBe('#171717');
  });

  it('does not hard-code colours that would ignore the dark theme', () => {
    expect(readComponentStyles(MODAL_PATH)).not.toMatch(/\bwhite\b|#[0-9a-f]{3,8}\b/i);
  });
});

describe('Modal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should not render when modelValue is false', () => {
    const wrapper = mount(Modal, {
      props: {
        modelValue: false,
        title: 'Test Modal',
      },
    });
    // Teleport renders comment nodes when not active
    expect(wrapper.html()).toContain('<!--teleport');
  });

  it('should render when modelValue is true', () => {
    mount(Modal, {
      props: {
        modelValue: true,
        title: 'Test Modal',
      },
      attachTo: document.body,
    });
    expect(document.body.querySelector('.modal-overlay')).toBeTruthy();
  });

  it('should display title', () => {
    mount(Modal, {
      props: {
        modelValue: true,
        title: 'My Test Title',
      },
      attachTo: document.body,
    });
    expect(document.body.querySelector('.modal-title')?.textContent).toContain('My Test Title');
  });

  it('should render slot content', () => {
    mount(Modal, {
      props: {
        modelValue: true,
        title: 'Test',
      },
      slots: {
        default: '<p>Modal Content</p>',
      },
      attachTo: document.body,
    });
    expect(document.body.querySelector('.modal-body')?.textContent).toContain('Modal Content');
  });

  it('should emit update:modelValue when overlay is clicked', async () => {
    const wrapper = mount(Modal, {
      props: {
        modelValue: true,
        title: 'Test',
      },
      attachTo: document.body,
    });

    const overlay = document.body.querySelector('.modal-overlay') as HTMLElement;
    await overlay.click();

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
  });

  it('should not close when clicking modal content', async () => {
    const wrapper = mount(Modal, {
      props: {
        modelValue: true,
        title: 'Test',
      },
      attachTo: document.body,
    });

    const modalContent = document.body.querySelector('.modal') as HTMLElement;
    await modalContent.click();

    expect(wrapper.emitted('update:modelValue')).toBeFalsy();
  });

  it('should apply size prop', () => {
    mount(Modal, {
      props: {
        modelValue: true,
        title: 'Test',
        size: 'lg',
      },
      attachTo: document.body,
    });
    expect(document.body.querySelector('.modal-lg')).toBeTruthy();
  });
});
