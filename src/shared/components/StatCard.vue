<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label: string
  value: string | number
  icon?: string
  trend?: { value: number; direction: 'up' | 'down' }
  iconColor?: 'primary' | 'success' | 'warning' | 'accent'
}

const props = withDefaults(defineProps<Props>(), {
  iconColor: 'primary',
})

const iconBgClass = computed(() => `stat-icon-${props.iconColor}`)
</script>

<template>
  <div class="stat-card">
    <div class="stat-header">
      <div>
        <div class="stat-label">{{ label }}</div>
        <div class="stat-value">{{ value }}</div>
      </div>
      <div v-if="icon" :class="['stat-icon', iconBgClass]">
        <i :class="`mdi mdi-${icon}`"></i>
      </div>
    </div>
    <div v-if="trend" class="stat-trend">
      <span :class="trend.direction === 'up' ? 'trend-up' : 'trend-down'">
        <i :class="`mdi mdi-arrow-${trend.direction}`"></i>
        {{ Math.abs(trend.value) }}
      </span>
      <span class="trend-label">
        <slot name="trend-label">vs mois dernier</slot>
      </span>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-md);
  border-left: 4px solid var(--primary-500);
  transition: all var(--transition-slow);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

.stat-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-4);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.stat-icon-primary {
  background: var(--primary-100);
  color: var(--primary-600);
}

.stat-icon-success {
  background: var(--success-50);
  color: var(--success-700);
}

.stat-icon-warning {
  background: var(--warning-50);
  color: var(--warning-700);
}

.stat-icon-accent {
  background: var(--accent-100);
  color: var(--accent-700);
}

.stat-value {
  font-size: var(--text-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.stat-label {
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.stat-trend {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  font-size: var(--text-sm);
}

.trend-up {
  color: var(--success-700);
  font-weight: var(--font-weight-semibold);
}

.trend-down {
  color: var(--error-700);
  font-weight: var(--font-weight-semibold);
}

.trend-label {
  color: var(--text-tertiary);
}
</style>
