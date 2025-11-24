<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue: string | number;
  type?: 'text' | 'email' | 'tel' | 'number' | 'password' | 'url' | 'date';
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
  required?: boolean;
  icon?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
});

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
}>();

const hasError = computed(() => !!props.error);

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = props.type === 'number' ? Number(target.value) : target.value;
  emit('update:modelValue', value);
}
</script>

<template>
  <div class="input-wrapper">
    <label v-if="label" class="input-label">
      {{ label }}
      <span v-if="required" class="required">*</span>
    </label>
    
    <div class="input-container" :class="{ 'has-icon': icon, 'has-error': hasError }">
      <i v-if="icon" :class="`mdi mdi-${icon}`" class="input-icon"></i>
      <input
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        class="input-field"
        @input="handleInput"
      />
    </div>
    
    <div v-if="error" class="input-error">
      <i class="mdi mdi-alert-circle"></i>
      {{ error }}
    </div>
    
    <div v-else-if="hint" class="input-hint">
      {{ hint }}
    </div>
  </div>
</template>

<style scoped>
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.input-label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #0f172a);
}

.required {
  color: var(--error-500, #ef4444);
}

.input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.input-container.has-icon .input-field {
  padding-left: var(--space-12, 3rem);
}

.input-icon {
  position: absolute;
  left: var(--space-4, 1rem);
  font-size: 1.25rem;
  color: var(--text-tertiary, #94a3b8);
  pointer-events: none;
}

.input-field {
  width: 100%;
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  font-size: var(--text-base, 1rem);
  font-family: inherit;
  color: var(--text-primary, #0f172a);
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  outline: none;
  transition: all var(--transition-base, 0.2s ease);
}

.input-field:focus {
  border-color: var(--primary-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.input-field:disabled {
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-tertiary, #94a3b8);
  cursor: not-allowed;
}

.input-field::placeholder {
  color: var(--text-tertiary, #94a3b8);
}

.input-container.has-error .input-field {
  border-color: var(--error-500, #ef4444);
}

.input-container.has-error .input-field:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.input-error {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--error-600, #dc2626);
}

.input-hint {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}
</style>
