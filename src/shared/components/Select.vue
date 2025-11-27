<script setup lang="ts">
import { computed } from 'vue'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

interface Props {
  modelValue: string | number | null
  options: SelectOption[]
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  required?: boolean
  multiple?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  required: false,
  multiple: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
}>()

const hasError = computed(() => !!props.error)

const handleInput = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const value = target.value
  emit('update:modelValue', value === '' ? null : value)
}
</script>

<template>
  <div class="select-wrapper">
    <label v-if="label" class="select-label">
      {{ label }}
      <span v-if="required" class="required-mark">*</span>
    </label>
    <div class="select-container">
      <select
        :value="modelValue ?? ''"
        :disabled="disabled"
        :required="required"
        :multiple="multiple"
        :class="['select-input', { 'select-error': hasError, 'select-disabled': disabled }]"
        @input="handleInput"
      >
        <option v-if="placeholder" value="">{{ placeholder }}</option>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </option>
      </select>
      <i class="mdi mdi-chevron-down select-icon"></i>
    </div>
    <span v-if="hasError" class="select-error-message">
      {{ error }}
    </span>
  </div>
</template>

<style scoped>
.select-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  width: 100%;
}

.select-label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #0f172a);
}

.required-mark {
  color: var(--error-500, #ef4444);
  margin-left: var(--space-1, 0.25rem);
}

.select-container {
  position: relative;
  width: 100%;
}

.select-input {
  width: 100%;
  padding: var(--space-3, 0.75rem) var(--space-10, 2.5rem) var(--space-3, 0.75rem) var(--space-4, 1rem);
  font-size: var(--text-base, 1rem);
  color: var(--text-primary, #0f172a);
  background: var(--bg-primary, #ffffff);
  border: 2px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.5rem);
  transition: all var(--transition-base, 0.2s ease);
  cursor: pointer;
  appearance: none;
}

.select-input:hover:not(:disabled) {
  border-color: var(--primary-400, #818cf8);
}

.select-input:focus {
  outline: none;
  border-color: var(--primary-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.select-input:disabled,
.select-disabled {
  background: var(--neutral-50, #f8fafc);
  color: var(--text-tertiary, #94a3b8);
  cursor: not-allowed;
  opacity: 0.6;
}

.select-error {
  border-color: var(--error-500, #ef4444);
}

.select-error:focus {
  border-color: var(--error-600, #dc2626);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.select-icon {
  position: absolute;
  right: var(--space-4, 1rem);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary, #94a3b8);
  pointer-events: none;
  font-size: 1.25rem;
}

.select-input:disabled ~ .select-icon {
  opacity: 0.5;
}

.select-error-message {
  font-size: var(--text-sm, 0.875rem);
  color: var(--error-600, #dc2626);
  margin-top: var(--space-1, 0.25rem);
}

.select-input option {
  padding: var(--space-2, 0.5rem);
}

.select-input option:disabled {
  color: var(--text-tertiary, #94a3b8);
}
</style>
