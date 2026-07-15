<script setup lang="ts">
import { computed } from 'vue';
import type { ChartPoint } from '../services/dashboardChartsService';

const props = withDefaults(
  defineProps<{
    items: ChartPoint[];
    /** Suffix appended to value labels, e.g. " €". */
    suffix?: string;
    /** Bar colour. */
    color?: string;
  }>(),
  {
    suffix: '',
    color: '#4f46e5',
  }
);

const maxValue = computed(() => {
  const max = Math.max(0, ...props.items.map(i => i.value));
  return max === 0 ? 1 : max;
});

function widthPercent(value: number): number {
  return Math.max(2, Math.round((value / maxValue.value) * 100));
}

function formatValue(value: number): string {
  return `${value.toLocaleString('fr-FR')}${props.suffix}`;
}
</script>

<template>
  <ul class="mini-bar-chart">
    <li v-for="(item, i) in items" :key="i" class="bar-row">
      <span class="bar-label" :title="item.label">{{ item.label }}</span>
      <span class="bar-track">
        <span
          class="bar-fill"
          :style="{ width: `${widthPercent(item.value)}%`, background: color }"
        ></span>
      </span>
      <span class="bar-value">{{ formatValue(item.value) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.mini-bar-chart {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.bar-row {
  display: grid;
  grid-template-columns: minmax(6rem, 30%) 1fr auto;
  align-items: center;
  gap: 0.75rem;
}

.bar-label {
  font-size: 0.875rem;
  color: var(--text-primary, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-track {
  height: 0.75rem;
  background: var(--bg-secondary, #f1f5f9);
  border-radius: var(--radius-full, 9999px);
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width var(--transition-base, 0.2s ease);
}

.bar-value {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
  white-space: nowrap;
}
</style>
