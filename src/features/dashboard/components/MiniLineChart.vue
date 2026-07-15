<script setup lang="ts">
import { computed } from 'vue';
import type { ChartPoint } from '../services/dashboardChartsService';

const props = withDefaults(
  defineProps<{
    points: ChartPoint[];
    /** Suffix appended to value tooltips/axis, e.g. " €" or " %". */
    suffix?: string;
    /** Stroke/fill colour for the curve. */
    color?: string;
  }>(),
  {
    suffix: '',
    color: '#4f46e5',
  }
);

// Fixed viewBox — the SVG scales responsively to its container width.
const WIDTH = 320;
const HEIGHT = 140;
const PAD_X = 8;
const PAD_TOP = 12;
const PAD_BOTTOM = 20;

const maxValue = computed(() => {
  const max = Math.max(0, ...props.points.map(p => p.value));
  return max === 0 ? 1 : max;
});

type Coord = { x: number; y: number; point: ChartPoint };

const coords = computed<Coord[]>(() => {
  const n = props.points.length;
  const usableW = WIDTH - PAD_X * 2;
  const usableH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  return props.points.map((point, i) => {
    const x = n <= 1 ? WIDTH / 2 : PAD_X + (usableW * i) / (n - 1);
    const y = PAD_TOP + usableH * (1 - point.value / maxValue.value);
    return { x, y, point };
  });
});

const linePath = computed(() =>
  coords.value.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ')
);

const areaPath = computed(() => {
  if (coords.value.length === 0) return '';
  const baseline = HEIGHT - PAD_BOTTOM;
  const first = coords.value[0];
  const last = coords.value[coords.value.length - 1];
  return `${linePath.value} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
});

function formatValue(value: number): string {
  return `${value.toLocaleString('fr-FR')}${props.suffix}`;
}
</script>

<template>
  <div class="mini-line-chart">
    <svg
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      preserveAspectRatio="none"
      role="img"
      class="chart-svg"
    >
      <path v-if="areaPath" :d="areaPath" :fill="color" fill-opacity="0.12" stroke="none" />
      <path
        v-if="linePath"
        :d="linePath"
        :stroke="color"
        stroke-width="2"
        fill="none"
        vector-effect="non-scaling-stroke"
      />
      <circle v-for="(c, i) in coords" :key="i" :cx="c.x" :cy="c.y" r="2.5" :fill="color">
        <title>{{ c.point.label }} : {{ formatValue(c.point.value) }}</title>
      </circle>
    </svg>
    <div class="chart-axis">
      <span>{{ points[0]?.label }}</span>
      <span>{{ points[points.length - 1]?.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.mini-line-chart {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chart-svg {
  width: 100%;
  height: 160px;
}

.chart-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-tertiary, #94a3b8);
}
</style>
