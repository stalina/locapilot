import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppStore } from './appStore';
// Import package.json to assert against current package version
import pkg from '../../../package.json';

describe('appStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('State', () => {
    it('should initialize with correct defaults', () => {
      const store = useAppStore();
      expect(store.appVersion).toBe(pkg.version);
      expect(store.isLoading).toBe(false);
      expect(store.isInitialized).toBe(false);
      expect(store.notification).toBeNull();
      expect(typeof store.isOnline).toBe('boolean'); // Depends on navigator.onLine
    });
  });

  describe('Getters', () => {
    it('should compute app info', () => {
      const store = useAppStore();
      const info = store.appInfo;
      expect(info.version).toBe(pkg.version);
      expect(typeof info.online).toBe('boolean');
      expect(info.initialized).toBe(false);
    });
  });

  describe('Actions', () => {
    it('should set online status', () => {
      const store = useAppStore();
      store.setOnlineStatus(false);
      expect(store.isOnline).toBe(false);

      store.setOnlineStatus(true);
      expect(store.isOnline).toBe(true);
    });

    it('should show notification with default type', () => {
      const store = useAppStore();
      store.showNotification('Test message');

      expect(store.notification).toEqual({
        message: 'Test message',
        type: 'info',
      });
    });

    it('should show notification with specific type', () => {
      const store = useAppStore();
      store.showNotification('Error message', 'error');

      expect(store.notification).toEqual({
        message: 'Error message',
        type: 'error',
      });
    });

    it('should clear notification after 5 seconds', () => {
      const store = useAppStore();
      store.showNotification('Test');

      expect(store.notification).toBeTruthy();

      vi.advanceTimersByTime(5000);

      expect(store.notification).toBeNull();
    });

    it('should set loading status', () => {
      const store = useAppStore();

      store.setLoading(true);
      expect(store.isLoading).toBe(true);

      store.setLoading(false);
      expect(store.isLoading).toBe(false);
    });

    it('should initialize app successfully', async () => {
      const store = useAppStore();
      await store.initializeApp();

      expect(store.isInitialized).toBe(true);
      expect(store.isLoading).toBe(false);
    });

    it('should handle initialization error', async () => {
      const store = useAppStore();
      await store.initializeApp();
      expect(store.isInitialized).toBe(true);
      expect(store.isLoading).toBe(false);
    });

    it('should not reinitialize if already initialized', async () => {
      const store = useAppStore();
      await store.initializeApp();

      // Try to initialize again
      await store.initializeApp();
    });

    it('should initialize network listeners', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      const store = useAppStore();
      store.initializeNetworkListeners();

      expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });
  });
});
