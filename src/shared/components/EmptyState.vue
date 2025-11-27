<script setup lang="ts">
interface Props {
  icon?: string
  title?: string
  description?: string
  actionLabel?: string
}

withDefaults(defineProps<Props>(), {
  icon: 'inbox',
  title: 'Aucun élément',
  description: '',
})

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-state-icon">
      <i :class="`mdi mdi-${icon}`"></i>
    </div>
    <h3 class="empty-state-title">{{ title }}</h3>
    <p v-if="description" class="empty-state-description">{{ description }}</p>
    <slot />
    <button
      v-if="actionLabel"
      class="empty-state-action"
      type="button"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12, 3rem) var(--space-6, 1.5rem);
  text-align: center;
  min-height: 300px;
}

.empty-state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  margin-bottom: var(--space-4, 1rem);
  border-radius: var(--radius-full, 9999px);
  background: var(--neutral-100, #f1f5f9);
}

.empty-state-icon i {
  font-size: 2rem;
  color: var(--neutral-400, #94a3b8);
}

.empty-state-title {
  margin: 0 0 var(--space-2, 0.5rem) 0;
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.empty-state-description {
  margin: 0 0 var(--space-6, 1.5rem) 0;
  max-width: 32rem;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
  line-height: 1.5;
}

.empty-state-action {
  padding: var(--space-3, 0.75rem) var(--space-6, 1.5rem);
  background: linear-gradient(135deg, var(--primary-600, #4f46e5), var(--primary-700, #4338ca));
  color: white;
  border: none;
  border-radius: var(--radius-lg, 0.5rem);
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-weight-semibold, 600);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
}

.empty-state-action:hover {
  background: linear-gradient(135deg, var(--primary-700, #4338ca), var(--primary-800, #3730a3));
  box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.15));
  transform: translateY(-2px);
}

.empty-state-action:focus-visible {
  outline: 2px solid var(--primary-500, #6366f1);
  outline-offset: 2px;
}
</style>
