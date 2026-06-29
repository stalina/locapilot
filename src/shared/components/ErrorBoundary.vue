<template>
  <div v-if="hasError" class="error-boundary" role="alert" data-testid="error-boundary">
    <div class="error-boundary__card">
      <i class="mdi mdi-alert-circle-outline error-boundary__icon"></i>
      <h2 class="error-boundary__title">Une erreur est survenue</h2>
      <p class="error-boundary__message">
        Cette section n'a pas pu s'afficher correctement. Vos données restent enregistrées
        localement.
      </p>
      <p v-if="showDetails && errorMessage" class="error-boundary__details">
        {{ errorMessage }}
      </p>
      <button
        type="button"
        class="error-boundary__retry"
        data-testid="error-boundary-retry"
        @click="reset"
      >
        <i class="mdi mdi-refresh"></i>
        Réessayer
      </button>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';
import { logger } from '@/shared/utils/logger';

const props = withDefaults(
  defineProps<{
    /** Label identifying the boundary location, included in logs. */
    label?: string;
    /** Show the raw error message in the fallback UI (defaults to dev only). */
    showDetails?: boolean;
  }>(),
  {
    label: 'unknown',
    showDetails: import.meta.env.DEV,
  }
);

const hasError = ref(false);
const errorMessage = ref('');

onErrorCaptured((err, _instance, info) => {
  hasError.value = true;
  errorMessage.value = err instanceof Error ? err.message : String(err);
  logger.error(
    'Error captured by boundary',
    { source: 'error-boundary', boundary: props.label, info },
    err
  );
  // Stop propagation so the global handler does not also fire for the same error.
  return false;
});

const reset = (): void => {
  hasError.value = false;
  errorMessage.value = '';
};

defineExpose({ reset, hasError });
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: var(--space-6, 1.5rem);
}

.error-boundary__card {
  max-width: 480px;
  text-align: center;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--error-100, #fee2e2);
  border-radius: var(--radius-lg, 0.75rem);
  padding: var(--space-8, 2rem);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.error-boundary__icon {
  font-size: 3rem;
  color: var(--error-500, #ef4444);
}

.error-boundary__title {
  margin: var(--space-4, 1rem) 0 var(--space-2, 0.5rem);
  font-size: var(--text-xl, 1.25rem);
  color: var(--text-primary, #0f172a);
}

.error-boundary__message {
  color: var(--text-secondary, #64748b);
  line-height: 1.5;
}

.error-boundary__details {
  margin-top: var(--space-4, 1rem);
  padding: var(--space-3, 0.75rem);
  background: var(--error-50, #fef2f2);
  border-radius: var(--radius-md, 0.5rem);
  color: var(--error-700, #b91c1c);
  font-family: monospace;
  font-size: var(--text-sm, 0.875rem);
  word-break: break-word;
}

.error-boundary__retry {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  margin-top: var(--space-6, 1.5rem);
  padding: var(--space-3, 0.75rem) var(--space-5, 1.25rem);
  background: var(--primary-600, #4f46e5);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-md, 0.5rem);
  font-weight: var(--font-weight-medium, 500);
  cursor: pointer;
  transition: background var(--transition-base, 0.2s ease);
}

.error-boundary__retry:hover {
  background: var(--primary-700, #4338ca);
}
</style>
