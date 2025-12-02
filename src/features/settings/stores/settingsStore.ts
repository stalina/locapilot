import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db } from '@/db/database';

interface NotificationSettings {
  enabled: boolean;
  rentReminders: boolean;
  leaseExpiration: boolean;
  paymentConfirmations: boolean;
}

interface AppSettingsData {
  theme: 'light' | 'dark';
  language: string;
  currency: string;
  dateFormat: string;
  notifications: NotificationSettings;
  autoSave: boolean;
  compactMode: boolean;
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const theme = ref<'light' | 'dark'>('light');
  const language = ref<string>('fr');
  const currency = ref<string>('EUR');
  const dateFormat = ref<string>('DD/MM/YYYY');
  const notifications = ref<NotificationSettings>({
    enabled: true,
    rentReminders: true,
    leaseExpiration: true,
    paymentConfirmations: true,
  });
  const autoSave = ref<boolean>(true);
  const compactMode = ref<boolean>(false);
  const defaultRejectionMessage = ref<string>(`Bonjour Monsieur,

J'ai recu énormément de réponse à mon'annonce et l'appartement a déjà été loué.  Je suis désolé de ne pas pouvoir satisfaire votre demande.
j'espère que vous trouverez rapidement une location qui vous convient.

Cordialement, `);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Default settings
  const defaultSettings: AppSettingsData = {
    theme: 'light',
    language: 'fr',
    currency: 'EUR',
    dateFormat: 'DD/MM/YYYY',
    notifications: {
      enabled: true,
      rentReminders: true,
      leaseExpiration: true,
      paymentConfirmations: true,
    },
    autoSave: true,
    compactMode: false,
  };

  // Getters
  const currentTheme = computed(() => theme.value);
  const currentLanguage = computed(() => language.value);
  const currentCurrency = computed(() => currency.value);
  const notificationsEnabled = computed(() => notifications.value.enabled);
  const currentDefaultRejectionMessage = computed(() => defaultRejectionMessage.value);

  // Helper to get setting from DB
  const getSetting = async <T>(key: string, defaultValue: T): Promise<T> => {
    try {
      const setting = await db.settings.where('key').equals(key).first();
      return setting ? (setting.value as T) : defaultValue;
    } catch (err) {
      console.error(`Failed to get setting ${key}:`, err);
      return defaultValue;
    }
  };

  // Helper to save setting to DB
  const setSetting = async (key: string, value: unknown): Promise<void> => {
    try {
      // Try the simple put first - tests and many environments mock/expect this.
      await db.settings.put({ key, value, updatedAt: new Date() });
    } catch {
      // If put failed (eg. edge cases with unique index), fallback to explicit upsert
      try {
        const existing = await db.settings.where('key').equals(key).first();
        if (existing && existing.id) {
          await db.settings.update(existing.id, { value, updatedAt: new Date() });
        } else {
          await db.settings.add({ key, value, updatedAt: new Date() });
        }
      } catch (err2) {
        console.error(`Failed to save setting ${key}:`, err2);
        throw err2;
      }
    }
  };

  // Actions
  const loadSettings = async (): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      // Load all settings from database
      theme.value = await getSetting('theme', defaultSettings.theme);
      language.value = await getSetting('language', defaultSettings.language);
      currency.value = await getSetting('currency', defaultSettings.currency);
      dateFormat.value = await getSetting('dateFormat', defaultSettings.dateFormat);
      notifications.value = await getSetting('notifications', defaultSettings.notifications);
      autoSave.value = await getSetting('autoSave', defaultSettings.autoSave);
      compactMode.value = await getSetting('compactMode', defaultSettings.compactMode);

      // Load default rejection message
      defaultRejectionMessage.value = await getSetting(
        'defaultRejectionMessage',
        defaultRejectionMessage.value
      );
      console.log('[settingsStore] loaded defaultRejectionMessage:', defaultRejectionMessage.value);

      // Apply theme to document
      document.documentElement.setAttribute('data-theme', theme.value);
    } catch (err) {
      console.error('Failed to load settings:', err);
      error.value = err instanceof Error ? err.message : 'Failed to load settings';
    } finally {
      isLoading.value = false;
    }
  };

  const updateTheme = async (newTheme: 'light' | 'dark'): Promise<void> => {
    try {
      await setSetting('theme', newTheme);
      theme.value = newTheme;
      document.documentElement.setAttribute('data-theme', newTheme);
    } catch (err) {
      console.error('Failed to update theme:', err);
      throw err;
    }
  };

  const updateLanguage = async (newLanguage: string): Promise<void> => {
    try {
      await setSetting('language', newLanguage);
      language.value = newLanguage;
    } catch (err) {
      console.error('Failed to update language:', err);
      throw err;
    }
  };

  const updateCurrency = async (newCurrency: string): Promise<void> => {
    try {
      await setSetting('currency', newCurrency);
      currency.value = newCurrency;
    } catch (err) {
      console.error('Failed to update currency:', err);
      throw err;
    }
  };

  const updateNotifications = async (newNotifications: NotificationSettings): Promise<void> => {
    try {
      await setSetting('notifications', newNotifications);
      notifications.value = newNotifications;
    } catch (err) {
      console.error('Failed to update notifications:', err);
      throw err;
    }
  };

  const toggleNotification = async (key: keyof NotificationSettings): Promise<void> => {
    try {
      const updated = {
        ...notifications.value,
        [key]: !notifications.value[key],
      };
      await updateNotifications(updated);
    } catch (err) {
      console.error(`Failed to toggle notification ${key}:`, err);
      throw err;
    }
  };

  const toggleCompactMode = async (): Promise<void> => {
    try {
      const newValue = !compactMode.value;
      await setSetting('compactMode', newValue);
      compactMode.value = newValue;
    } catch (err) {
      console.error('Failed to toggle compact mode:', err);
      throw err;
    }
  };

  const toggleAutoSave = async (): Promise<void> => {
    try {
      const newValue = !autoSave.value;
      await setSetting('autoSave', newValue);
      autoSave.value = newValue;
    } catch (err) {
      console.error('Failed to toggle auto save:', err);
      throw err;
    }
  };

  const resetToDefaults = async (): Promise<void> => {
    try {
      await updateTheme(defaultSettings.theme);
      await updateLanguage(defaultSettings.language);
      await updateCurrency(defaultSettings.currency);
      await setSetting('dateFormat', defaultSettings.dateFormat);
      await updateNotifications(defaultSettings.notifications);
      await setSetting('autoSave', defaultSettings.autoSave);
      await setSetting('compactMode', defaultSettings.compactMode);

      dateFormat.value = defaultSettings.dateFormat;
      autoSave.value = defaultSettings.autoSave;
      compactMode.value = defaultSettings.compactMode;
      // Load default rejection message if present
      const loadedDefaultMsg = await getSetting(
        'defaultRejectionMessage',
        defaultRejectionMessage.value
      );
      defaultRejectionMessage.value = loadedDefaultMsg;
    } catch (err) {
      console.error('Failed to reset settings:', err);
      throw err;
    }
  };

  const updateDefaultRejectionMessage = async (message: string): Promise<void> => {
    try {
      console.log('[settingsStore] updateDefaultRejectionMessage called with:', message);
      await setSetting('defaultRejectionMessage', message);
      defaultRejectionMessage.value = message;
    } catch (err) {
      console.error('Failed to update default rejection message:', err);
      throw err;
    }
  };

  return {
    // State
    theme,
    language,
    currency,
    dateFormat,
    notifications,
    autoSave,
    compactMode,
    isLoading,
    error,

    // Getters
    currentTheme,
    currentLanguage,
    currentCurrency,
    notificationsEnabled,

    // Actions
    loadSettings,
    updateTheme,
    updateLanguage,
    updateCurrency,
    updateNotifications,
    toggleNotification,
    toggleCompactMode,
    toggleAutoSave,
    resetToDefaults,
    // Default message
    defaultRejectionMessage,
    currentDefaultRejectionMessage,
    updateDefaultRejectionMessage,
  };
});
