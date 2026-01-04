import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from './settingsStore';

vi.mock('../repositories/settingsRepository', () => ({
  fetchSettingValue: vi.fn(),
  saveSettingValue: vi.fn(),
}));

import { fetchSettingValue, saveSettingValue } from '../repositories/settingsRepository';

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
      vi.mocked(fetchSettingValue).mockImplementation(async (key: string) => {
        if (key === 'theme') return 'dark';
        return undefined;
      });

      const store = useSettingsStore();
      await store.loadSettings();

      expect(fetchSettingValue).toHaveBeenCalled();
      expect(store.theme).toBe('dark');
    });

    it('should handle load errors gracefully', async () => {
      vi.mocked(fetchSettingValue).mockRejectedValue(new Error('DB Error'));

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
      expect(saveSettingValue).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  describe('updateLanguage', () => {
    it('should update language and persist', async () => {
      const store = useSettingsStore();

      await store.updateLanguage('en');

      expect(store.language).toBe('en');
      expect(saveSettingValue).toHaveBeenCalledWith('language', 'en');
    });
  });

  describe('updateCurrency', () => {
    it('should update currency and persist', async () => {
      const store = useSettingsStore();

      await store.updateCurrency('USD');

      expect(store.currency).toBe('USD');
      expect(saveSettingValue).toHaveBeenCalledWith('currency', 'USD');
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
      expect(saveSettingValue).toHaveBeenCalledWith('notifications', newNotifications);
    });
  });

  describe('toggleNotification', () => {
    it('should toggle enabled notifications', async () => {
      const store = useSettingsStore();
      const initialValue = store.notifications.enabled;

      await store.toggleNotification('enabled');

      expect(store.notifications.enabled).toBe(!initialValue);
      expect(saveSettingValue).toHaveBeenCalled();
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
      expect(saveSettingValue).toHaveBeenCalledWith('compactMode', !initialValue);
    });
  });

  describe('toggleAutoSave', () => {
    it('should toggle auto save and persist', async () => {
      const store = useSettingsStore();
      const initialValue = store.autoSave;

      await store.toggleAutoSave();

      expect(store.autoSave).toBe(!initialValue);
      expect(saveSettingValue).toHaveBeenCalledWith('autoSave', !initialValue);
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
