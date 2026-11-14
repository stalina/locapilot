import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import router from '@core/router';
import { initializeDatabase } from '@/db/schema';
import { useAppStore } from '@core/store/appStore';
import { installErrorHandling } from '@core/errorHandler';
import { logger } from '@/shared/utils/logger';

import './assets/styles/variables.css';
import './assets/styles/global.css';
import './assets/styles/views.css';
import './style.css';
import 'primeicons/primeicons.css';
import '@mdi/font/css/materialdesignicons.css';

import App from './App.vue';
import { seedDemoData } from '@/db/seed';

// Initialize database
const databaseReady = initializeDatabase().then(
  () => true,
  error => {
    logger.error('Failed to initialize database', { source: 'bootstrap' }, error);
    return false;
  }
);

// Create app
const app = createApp(App);
const pinia = createPinia();

// Use plugins
app.use(pinia);
app.use(router);
app.use(PrimeVue, {
  ripple: true,
});

// Global error capture + structured reporting
installErrorHandling(app);

// Initialize app store and seed database
const appStore = useAppStore();
appStore.initializeNetworkListeners();
appStore.initializeApp();

// Seed demo data in development so dashboard shows content
const demoDataReady = import.meta.env.DEV
  ? seedDemoData().catch(err =>
      logger.error('Failed to seed demo data', { source: 'bootstrap' }, err)
    )
  : Promise.resolve();

// Automatic restore points (issue #59): checked in the background once the
// database is open (never delays the mount), then every hour. Loaded lazily so
// the backup code stays out of the initial bundle.
void Promise.all([databaseReady, demoDataReady])
  .then(async ([ready]) => {
    if (!ready) return;
    const { useBackupStore } = await import('@/features/settings/stores/backupStore');
    useBackupStore(pinia).startAutoBackupScheduler();
  })
  .catch(err =>
    logger.error('Failed to start automatic restore points', { source: 'backup' }, err)
  );

// Mount app
app.mount('#app');
