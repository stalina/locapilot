import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import Modal from '@/shared/components/Modal.vue';

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
