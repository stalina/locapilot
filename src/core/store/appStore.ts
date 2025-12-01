import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAppStore = defineStore('app', () => {
  // State
  const isOnline = ref(navigator.onLine);
  const appVersion = ref('0.0.1');
  const isLoading = ref(false);
  const isInitialized = ref(false);
  const notification = ref<{
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  // Getters
  const appInfo = computed(() => ({
    version: appVersion.value,
    online: isOnline.value,
    initialized: isInitialized.value,
  }));

  // Actions
  function setOnlineStatus(status: boolean) {
    isOnline.value = status;
  }

  function showNotification(
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info'
  ) {
    notification.value = { message, type };
    setTimeout(() => {
      notification.value = null;
    }, 5000);
  }

  function setLoading(status: boolean) {
    isLoading.value = status;
  }

  // Initialize online/offline listeners
  function initializeNetworkListeners() {
    window.addEventListener('online', () => setOnlineStatus(true));
    window.addEventListener('offline', () => setOnlineStatus(false));
  }

  // Initialize app (seed database if needed)
  async function initializeApp() {
    if (isInitialized.value) return;

    try {
      setLoading(true);
      isInitialized.value = true;
      console.log('✅ App initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      showNotification("Erreur lors de l'initialisation", 'error');
    } finally {
      setLoading(false);
    }
  }

  return {
    // State
    isOnline,
    appVersion,
    isLoading,
    isInitialized,
    notification,
    // Getters
    appInfo,
    // Actions
    setOnlineStatus,
    showNotification,
    setLoading,
    initializeNetworkListeners,
    initializeApp,
  };
});
