<script setup lang="ts">
interface Props {
  variant?: 'success' | 'info' | 'warning' | 'error'
  title?: string
  dismissible?: boolean
  icon?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'info',
  dismissible: false,
})

const emit = defineEmits<{
  dismiss: []
}>()

const defaultIcons = {
  success: 'check-circle',
  info: 'information',
  warning: 'alert',
  error: 'alert-circle',
}

const iconName = props.icon || defaultIcons[props.variant]
</script>

<template>
  <div :class="['alert', `alert-${variant}`]" role="alert">
    <div class="alert-content">
      <i :class="`mdi mdi-${iconName} alert-icon`"></i>
      <div class="alert-body">
        <h4 v-if="title" class="alert-title">{{ title }}</h4>
        <div class="alert-message">
          <slot />
        </div>
      </div>
    </div>
    <button
      v-if="dismissible"
      class="alert-dismiss"
      type="button"
      aria-label="Fermer"
      @click="emit('dismiss')"
    >
      <i class="mdi mdi-close"></i>
    </button>
  </div>
</template>

<style scoped>
.alert {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-4, 1rem);
  border-radius: var(--radius-lg, 0.5rem);
  border-left: 4px solid;
}

.alert-content {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3, 0.75rem);
  flex: 1;
}

.alert-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.alert-body {
  flex: 1;
  min-width: 0;
}

.alert-title {
  margin: 0 0 var(--space-1, 0.25rem) 0;
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-weight-semibold, 600);
}

.alert-message {
  font-size: var(--text-sm, 0.875rem);
  line-height: 1.5;
}

.alert-dismiss {
  flex-shrink: 0;
  padding: var(--space-1, 0.25rem);
  background: transparent;
  border: none;
  border-radius: var(--radius-md, 0.375rem);
  cursor: pointer;
  transition: background var(--transition-base, 0.2s ease);
  display: flex;
  align-items: center;
  justify-content: center;
}

.alert-dismiss:hover {
  background: rgba(0, 0, 0, 0.05);
}

.alert-dismiss i {
  font-size: 1.25rem;
}

/* Variants */
.alert-success {
  background: var(--success-50, #f0fdf4);
  border-left-color: var(--success-500, #22c55e);
  color: var(--success-900, #14532d);
}

.alert-success .alert-icon {
  color: var(--success-600, #16a34a);
}

.alert-info {
  background: var(--accent-50, #eff6ff);
  border-left-color: var(--accent-500, #3b82f6);
  color: var(--accent-900, #1e3a8a);
}

.alert-info .alert-icon {
  color: var(--accent-600, #2563eb);
}

.alert-warning {
  background: var(--warning-50, #fffbeb);
  border-left-color: var(--warning-500, #f59e0b);
  color: var(--warning-900, #78350f);
}

.alert-warning .alert-icon {
  color: var(--warning-600, #d97706);
}

.alert-error {
  background: var(--error-50, #fef2f2);
  border-left-color: var(--error-500, #ef4444);
  color: var(--error-900, #7f1d1d);
}

.alert-error .alert-icon {
  color: var(--error-600, #dc2626);
}
</style>
