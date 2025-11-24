<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import Button from './Button.vue';

const showUpdatePrompt = ref(false);

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegistered(registration) {
    console.log('Service Worker registered:', registration);
  },
  onRegisterError(error) {
    console.error('Service Worker registration error:', error);
  },
  onNeedRefresh() {
    showUpdatePrompt.value = true;
  },
});

const handleUpdate = async () => {
  showUpdatePrompt.value = false;
  await updateServiceWorker(true);
};

const handleDismiss = () => {
  showUpdatePrompt.value = false;
};
</script>

<template>
  <Transition name="slide-up">
    <div v-if="showUpdatePrompt || needRefresh" class="pwa-update-prompt">
      <div class="prompt-content">
        <div class="prompt-icon">
          <i class="mdi mdi-refresh"></i>
        </div>
        <div class="prompt-text">
          <h3>Mise à jour disponible</h3>
          <p>Une nouvelle version de l'application est disponible</p>
        </div>
        <div class="prompt-actions">
          <Button @click="handleUpdate" variant="primary" size="sm">
            Actualiser
          </Button>
          <Button @click="handleDismiss" variant="ghost" size="sm">
            Plus tard
          </Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-update-prompt {
  position: fixed;
  bottom: var(--spacing-4, 1rem);
  right: var(--spacing-4, 1rem);
  z-index: 9999;
  max-width: 400px;
}

.prompt-content {
  background: var(--color-surface, #ffffff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  padding: var(--spacing-4, 1rem);
  display: flex;
  align-items: center;
  gap: var(--spacing-3, 0.75rem);
}

.prompt-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary, #4f46e5);
  color: white;
  border-radius: var(--radius-full, 9999px);
  font-size: 1.5rem;
}

.prompt-text {
  flex: 1;
}

.prompt-text h3 {
  margin: 0 0 var(--spacing-1, 0.25rem) 0;
  font-size: var(--text-base, 1rem);
  font-weight: 600;
  color: var(--color-text, #0f172a);
}

.prompt-text p {
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  color: var(--color-text-secondary, #64748b);
}

.prompt-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2, 0.5rem);
}

/* Transition */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

@media (max-width: 640px) {
  .pwa-update-prompt {
    left: var(--spacing-4, 1rem);
    right: var(--spacing-4, 1rem);
    max-width: none;
  }

  .prompt-content {
    flex-direction: column;
    text-align: center;
  }

  .prompt-actions {
    flex-direction: row;
    width: 100%;
  }

  .prompt-actions button {
    flex: 1;
  }
}
</style>
