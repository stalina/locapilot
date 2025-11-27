<template>
  <AppLayout />
  <PWAUpdatePrompt />
  <NotificationContainer />
  <ConfirmDialog />
</template>

<script setup lang="ts">
import AppLayout from '@core/layouts/AppLayout.vue';
import PWAUpdatePrompt from '@/shared/components/PWAUpdatePrompt.vue';
import NotificationContainer from '@/shared/components/NotificationContainer.vue';
import ConfirmDialog from '@/shared/components/ConfirmDialog.vue';
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell,
    'Open Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  min-height: 100vh;
}
</style>
