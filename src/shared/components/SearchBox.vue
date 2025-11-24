<script setup lang="ts">
import { ref, watch } from 'vue';

interface Props {
  modelValue: string;
  placeholder?: string;
  debounce?: number;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Rechercher...',
  debounce: 300,
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  search: [value: string];
}>();

const inputValue = ref(props.modelValue);
const timeoutId = ref<number>();

watch(() => props.modelValue, (newValue) => {
  inputValue.value = newValue;
});

watch(inputValue, (newValue) => {
  emit('update:modelValue', newValue);
  
  clearTimeout(timeoutId.value);
  timeoutId.value = window.setTimeout(() => {
    emit('search', newValue);
  }, props.debounce);
});

function clearSearch() {
  inputValue.value = '';
}
</script>

<template>
  <div class="search-box">
    <i class="mdi mdi-magnify search-icon"></i>
    <input
      v-model="inputValue"
      type="text"
      class="search-input"
      :placeholder="placeholder"
    />
    <button
      v-if="inputValue"
      type="button"
      class="clear-button"
      @click="clearSearch"
    >
      <i class="mdi mdi-close"></i>
    </button>
  </div>
</template>

<style scoped>
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: var(--space-4, 1rem);
  font-size: 1.25rem;
  color: var(--text-tertiary, #94a3b8);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: var(--space-3, 0.75rem) var(--space-12, 3rem);
  font-size: var(--text-base, 1rem);
  font-family: inherit;
  color: var(--text-primary, #0f172a);
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  outline: none;
  transition: all var(--transition-base, 0.2s ease);
}

.search-input:focus {
  border-color: var(--primary-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.search-input::placeholder {
  color: var(--text-tertiary, #94a3b8);
}

.clear-button {
  position: absolute;
  right: var(--space-4, 1rem);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  color: var(--text-secondary, #64748b);
  transition: all var(--transition-base, 0.2s ease);
}

.clear-button:hover {
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-primary, #0f172a);
}
</style>
