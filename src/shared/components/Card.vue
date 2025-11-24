<script setup lang="ts">
interface Props {
  hover?: boolean
  clickable?: boolean
  bordered?: boolean
}

withDefaults(defineProps<Props>(), {
  hover: true,
  clickable: false,
  bordered: false,
})
</script>

<template>
  <div
    :class="[
      'card',
      {
        'card-hover': hover,
        'card-clickable': clickable,
        'card-bordered': bordered,
      },
    ]"
  >
    <slot />
  </div>
</template>

<style scoped>
.card {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-slow);
}

.card-bordered {
  border: 1px solid var(--border-color);
}

.card-hover:hover {
  box-shadow: var(--shadow-lg);
}

.card-clickable {
  cursor: pointer;
}

.card-clickable:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}
</style>
