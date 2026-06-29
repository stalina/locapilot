import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { defineComponent, h, nextTick } from 'vue';
import ErrorBoundary from './ErrorBoundary.vue';
import { logger } from '@/shared/utils/logger';

const Boom = defineComponent({
  setup() {
    throw new Error('child exploded');
  },
  render() {
    return h('div');
  },
});

// Throws only while `shouldThrow` is true — used to test recovery via reset().
const shouldThrow = { value: true };
const Flaky = defineComponent({
  render() {
    if (shouldThrow.value) {
      throw new Error('flaky exploded');
    }
    return h('div', { class: 'recovered' }, 'recovered');
  },
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    logger.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its slot content when there is no error', () => {
    const wrapper = mount(ErrorBoundary, {
      slots: { default: () => h('div', { class: 'ok' }, 'all good') },
    });
    expect(wrapper.find('.ok').exists()).toBe(true);
    expect(wrapper.find('[data-testid="error-boundary"]').exists()).toBe(false);
  });

  it('shows the fallback UI and logs when a child throws', async () => {
    const wrapper = mount(ErrorBoundary, {
      props: { label: 'test-zone' },
      slots: { default: () => h(Boom) },
    });
    await nextTick();

    expect(wrapper.find('[data-testid="error-boundary"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Une erreur est survenue');

    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].context).toMatchObject({ source: 'error-boundary', boundary: 'test-zone' });
    expect(entries[0].error?.message).toBe('child exploded');
  });

  it('recovers and renders the slot again when retry is clicked', async () => {
    shouldThrow.value = true;
    const wrapper = mount(ErrorBoundary, {
      slots: { default: () => h(Flaky) },
    });
    await nextTick();
    expect(wrapper.find('[data-testid="error-boundary"]').exists()).toBe(true);

    // Underlying condition fixed before retrying.
    shouldThrow.value = false;
    await wrapper.find('[data-testid="error-boundary-retry"]').trigger('click');
    await flushPromises();

    expect((wrapper.vm as unknown as { hasError: boolean }).hasError).toBe(false);
    expect(wrapper.find('.recovered').exists()).toBe(true);
  });

  it('exposes the fallback with role=alert for accessibility', async () => {
    const wrapper = mount(ErrorBoundary, {
      slots: { default: () => h(Boom) },
    });
    await nextTick();
    expect(wrapper.find('[data-testid="error-boundary"]').attributes('role')).toBe('alert');
  });
});
