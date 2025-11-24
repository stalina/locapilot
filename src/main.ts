import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import router from '@core/router';
import { initializeDatabase } from '@db/schema';
import { useAppStore } from '@core/store/appStore';

import './assets/styles/variables.css';
import './assets/styles/global.css';
import './style.css';
import 'primeicons/primeicons.css';
import '@mdi/font/css/materialdesignicons.css';

import App from './App.vue';

// Initialize database
initializeDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
});

// Create app
const app = createApp(App);
const pinia = createPinia();

// Use plugins
app.use(pinia);
app.use(router);
app.use(PrimeVue, {
  ripple: true,
});

// Initialize app store and seed database
const appStore = useAppStore();
appStore.initializeNetworkListeners();
appStore.initializeApp();

// Mount app
app.mount('#app');
