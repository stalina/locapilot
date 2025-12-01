<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

interface Props {
  variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'success'
    | 'warning'
    | 'error'
    | 'text'
    | 'ghost'
    | 'default'
    | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  to?: string;
  testId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
});

const classes = computed(() => [
  'btn',
  `btn-${props.variant}`,
  `btn-${props.size}`,
  {
    'btn-disabled': props.disabled,
    'btn-loading': props.loading,
  },
]);

const isLink = computed(() => !!props.to && !props.disabled && !props.loading);
</script>

<template>
  <RouterLink v-if="isLink" :to="to || '/'" custom v-slot="{ navigate }">
    <button
      v-bind="$attrs"
      :class="classes"
      @click="navigate"
      :data-testid="props.testId || undefined"
    >
      <i v-if="loading" class="mdi mdi-loading mdi-spin"></i>
      <i v-else-if="icon" :class="`mdi mdi-${icon}`"></i>
      <slot />
    </button>
  </RouterLink>
  <button
    v-else
    v-bind="$attrs"
    :class="classes"
    :disabled="disabled || loading"
    :data-testid="props.testId || undefined"
  >
    <i v-if="loading" class="mdi mdi-loading mdi-spin"></i>
    <i v-else-if="icon" :class="`mdi mdi-${icon}`"></i>
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border: none;
  border-radius: var(--radius-lg);
  font-family: var(--font-family-base);
  font-size: var(--text-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
  user-select: none;
}

.btn:focus-visible {
  outline: 2px solid var(--primary-500);
  outline-offset: 2px;
}

/* Variants */
.btn-primary {
  background: linear-gradient(135deg, var(--primary-600), var(--primary-700));
  color: white;
  box-shadow: var(--shadow-md);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--primary-700), var(--primary-800));
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}

.btn-secondary {
  background: var(--neutral-100);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  background: var(--neutral-200);
}

.btn-outline {
  background: transparent;
  border: 2px solid var(--primary-500);
  color: var(--primary-600);
}

.btn-outline:hover:not(:disabled) {
  background: var(--primary-50);
}

.btn-success {
  background: var(--success-500);
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: var(--success-600);
}

.btn-warning {
  background: var(--warning-500);
  color: white;
}

.btn-warning:hover:not(:disabled) {
  background: var(--warning-600);
}

.btn-error,
.btn-danger {
  background: var(--error-500);
  color: white;
}

.btn-error:hover:not(:disabled),
.btn-danger:hover:not(:disabled) {
  background: var(--error-600);
}

.btn-text,
.btn-ghost {
  background: transparent;
  color: var(--text-primary);
  box-shadow: none;
}

.btn-text:hover:not(:disabled),
.btn-ghost:hover:not(:disabled) {
  background: var(--neutral-100);
}

.btn-default {
  background: var(--neutral-200);
  color: var(--text-primary);
}

.btn-default:hover:not(:disabled) {
  background: var(--neutral-300);
}

/* Sizes */
.btn-sm {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
}

.btn-md {
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
}

.btn-lg {
  padding: var(--space-4) var(--space-8);
  font-size: var(--text-lg);
}

/* States */
.btn-disabled,
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.btn-loading {
  position: relative;
}

.mdi-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
