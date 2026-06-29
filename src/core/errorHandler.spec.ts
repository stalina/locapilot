import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { App } from 'vue';
import { registerVueErrorHandler, registerGlobalErrorListeners } from './errorHandler';
import { logger } from '@/shared/utils/logger';
import { useNotification } from '@/shared/composables/useNotification';

describe('errorHandler', () => {
  beforeEach(() => {
    logger.clear();
    useNotification().clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerVueErrorHandler', () => {
    it('installs a handler that logs the error and notifies the user', () => {
      const app = { config: {} } as unknown as App;
      registerVueErrorHandler(app);
      expect(typeof app.config.errorHandler).toBe('function');

      app.config.errorHandler?.(new Error('render fail'), null, 'render');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe('error');
      expect(entries[0].context).toMatchObject({ source: 'vue', info: 'render' });
      expect(entries[0].error?.message).toBe('render fail');

      expect(useNotification().notifications.value).toHaveLength(1);
      expect(useNotification().notifications.value[0].type).toBe('error');
    });
  });

  describe('registerGlobalErrorListeners', () => {
    it('logs uncaught window errors', () => {
      const teardown = registerGlobalErrorListeners();
      window.dispatchEvent(new ErrorEvent('error', { message: 'oops', error: new Error('oops') }));
      const entries = logger.getEntries();
      expect(entries.some(e => e.context?.source === 'window.onerror')).toBe(true);
      teardown();
    });

    it('logs unhandled promise rejections', () => {
      const teardown = registerGlobalErrorListeners();
      const event = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(event, 'reason', { value: new Error('rejected') });
      window.dispatchEvent(event);
      const entries = logger.getEntries();
      expect(entries.some(e => e.context?.source === 'unhandledrejection')).toBe(true);
      teardown();
    });

    it('teardown removes the listeners', () => {
      const teardown = registerGlobalErrorListeners();
      teardown();
      window.dispatchEvent(new ErrorEvent('error', { message: 'after teardown' }));
      expect(logger.getEntries()).toHaveLength(0);
    });
  });
});
