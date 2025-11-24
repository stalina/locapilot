<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'default'
  icon?: string
  rounded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  rounded: false,
})

const classes = computed(() => [
  'badge',
  `badge-${props.variant}`,
  {
    'badge-rounded': props.rounded,
  },
])
</script>

<template>
  <span :class="classes">
    <i v-if="icon" :class="`mdi mdi-${icon}`"></i>
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
}

.badge-rounded {
  border-radius: var(--radius-full);
}

.badge-primary {
  background: var(--primary-100);
  color: var(--primary-700);
}

.badge-success {
  background: var(--success-50);
  color: var(--success-700);
}

.badge-warning {
  background: var(--warning-50);
  color: var(--warning-700);
}

.badge-error {
  background: var(--error-50);
  color: var(--error-700);
}

.badge-info {
  background: var(--accent-100);
  color: var(--accent-700);
}

.badge-default {
  background: var(--neutral-100);
  color: var(--neutral-700);
}
</style>
