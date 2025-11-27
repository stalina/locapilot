import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from './settingsStore';
import { db } from '@/db/database';

// Mock IndexedDB
vi.mock('@/db/database', () => ({
  db: {
    settings: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(),
        })),
      })),
      put: vi.fn(),
      clear: vi.fn(),
    },
  },
}));

describe('settingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have default values', () => {
      const store = useSettingsStore();

      expect(store.theme).toBe('light');
      expect(store.language).toBe('fr');
      expect(store.currency).toBe('EUR');
      expect(store.dateFormat).toBe('DD/MM/YYYY');
      expect(store.notifications).toEqual({
        enabled: true,
        rentReminders: true,
        leaseExpiration: true,
        paymentConfirmations: true,
      });
      expect(store.autoSave).toBe(true);
      expect(store.compactMode).toBe(false);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });
  });

  describe('loadSettings', () => {
    it('should load settings from IndexedDB', async () => {
      const mockSettings = {
        key: 'theme',
        value: 'dark',
      };

      const mockFirst = vi.fn().mockResolvedValue(mockSettings);
      const mockEquals = vi.fn().mockReturnValue({ first: mockFirst });
      vi.mocked(db.settings.where).mockReturnValue({ equals: mockEquals } as any);

      const store = useSettingsStore();
      await store.loadSettings();

      expect(db.settings.where).toHaveBeenCalledWith('key');
      expect(store.theme).toBe('dark');
    });

    it('should handle load errors gracefully', async () => {
      const mockFirst = vi.fn().mockRejectedValue(new Error('DB Error'));
      const mockEquals = vi.fn().mockReturnValue({ first: mockFirst });
      vi.mocked(db.settings.where).mockReturnValue({ equals: mockEquals } as any);

      const store = useSettingsStore();
      await store.loadSettings();

      // Should use default values on error
      expect(store.theme).toBe('light');
    });
  });

  describe('updateTheme', () => {
    it('should update theme and persist to IndexedDB', async () => {
      const store = useSettingsStore();

      await store.updateTheme('dark');

      expect(store.theme).toBe('dark');
      expect(db.settings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'theme',
          value: 'dark',
        })
      );
    });
  });

  describe('updateLanguage', () => {
    it('should update language and persist', async () => {
      const store = useSettingsStore();

      await store.updateLanguage('en');

      expect(store.language).toBe('en');
      expect(db.settings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'language',
          value: 'en',
        })
      );
    });
  });

  describe('updateCurrency', () => {
    it('should update currency and persist', async () => {
      const store = useSettingsStore();

      await store.updateCurrency('USD');

      expect(store.currency).toBe('USD');
      expect(db.settings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'currency',
          value: 'USD',
        })
      );
    });
  });

  describe('updateNotifications', () => {
    it('should update notifications and persist', async () => {
      const store = useSettingsStore();
      const newNotifications = {
        enabled: true,
        rentReminders: false,
        leaseExpiration: true,
        paymentConfirmations: false,
      };

      await store.updateNotifications(newNotifications);

      expect(store.notifications).toEqual(newNotifications);
      expect(db.settings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'notifications',
          value: newNotifications,
        })
      );
    });
  });

  describe('toggleNotification', () => {
    it('should toggle enabled notifications', async () => {
      const store = useSettingsStore();
      const initialValue = store.notifications.enabled;

      await store.toggleNotification('enabled');

      expect(store.notifications.enabled).toBe(!initialValue);
      expect(db.settings.put).toHaveBeenCalled();
    });

    it('should toggle rent reminders', async () => {
      const store = useSettingsStore();
      const initialValue = store.notifications.rentReminders;

      await store.toggleNotification('rentReminders');

      expect(store.notifications.rentReminders).toBe(!initialValue);
    });

    it('should toggle lease expiration', async () => {
      const store = useSettingsStore();
      const initialValue = store.notifications.leaseExpiration;

      await store.toggleNotification('leaseExpiration');

      expect(store.notifications.leaseExpiration).toBe(!initialValue);
    });

    it('should toggle payment confirmations', async () => {
      const store = useSettingsStore();
      const initialValue = store.notifications.paymentConfirmations;

      await store.toggleNotification('paymentConfirmations');

      expect(store.notifications.paymentConfirmations).toBe(!initialValue);
    });
  });

  describe('toggleCompactMode', () => {
    it('should toggle compact mode and persist', async () => {
      const store = useSettingsStore();
      const initialValue = store.compactMode;

      await store.toggleCompactMode();

      expect(store.compactMode).toBe(!initialValue);
      expect(db.settings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'compactMode',
          value: !initialValue,
        })
      );
    });
  });

  describe('toggleAutoSave', () => {
    it('should toggle auto save and persist', async () => {
      const store = useSettingsStore();
      const initialValue = store.autoSave;

      await store.toggleAutoSave();

      expect(store.autoSave).toBe(!initialValue);
      expect(db.settings.put).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'autoSave',
          value: !initialValue,
        })
      );
    });
  });

  describe('resetToDefaults', () => {
    it('should reset all settings to defaults', async () => {
      const store = useSettingsStore();

      // Modify settings
      await store.updateTheme('dark');
      await store.updateLanguage('en');
      await store.updateCurrency('USD');

      await store.resetToDefaults();

      expect(store.theme).toBe('light');
      expect(store.language).toBe('fr');
      expect(store.currency).toBe('EUR');
      expect(store.compactMode).toBe(false);
      expect(store.autoSave).toBe(true);
    });
  });

  describe('Computed Properties', () => {
    it('should provide currentTheme computed', () => {
      const store = useSettingsStore();
      expect(store.currentTheme).toBe('light');
    });

    it('should provide currentLanguage computed', () => {
      const store = useSettingsStore();
      expect(store.currentLanguage).toBe('fr');
    });

    it('should provide currentCurrency computed', () => {
      const store = useSettingsStore();
      expect(store.currentCurrency).toBe('EUR');
    });

    it('should provide notificationsEnabled computed', () => {
      const store = useSettingsStore();
      expect(store.notificationsEnabled).toBe(true);
    });
  });
});
