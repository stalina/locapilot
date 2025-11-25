<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

interface Props {
  modelValue: boolean;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnOverlay?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closeOnOverlay: true,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}

function handleOverlayClick() {
  if (props.closeOnOverlay) {
    handleClose();
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    handleClose();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click="handleOverlayClick" data-testid="modal-overlay">
        <div class="modal" :class="`modal-${size}`" @click.stop data-testid="modal">
          <!-- Header -->
          <div class="modal-header">
            <h3 class="modal-title" data-testid="modal-title">{{ title }}</h3>
            <button class="close-button" @click="handleClose" type="button" data-testid="modal-close">
              <i class="mdi mdi-close"></i>
            </button>
          </div>

          <!-- Body -->
          <div class="modal-body" data-testid="modal-body">
            <slot></slot>
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="modal-footer" data-testid="modal-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4, 1rem);
  overflow-y: auto;
}

.modal {
  background: white;
  border-radius: var(--radius-2xl, 1.5rem);
  box-shadow: var(--shadow-2xl, 0 25px 50px rgba(0, 0, 0, 0.25));
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  margin: auto;
}

.modal-sm {
  max-width: 400px;
}

.modal-md {
  max-width: 600px;
}

.modal-lg {
  max-width: 800px;
}

.modal-xl {
  max-width: 1200px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6, 1.5rem);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: var(--text-2xl, 1.5rem);
  font-weight: var(--font-weight-bold, 700);
  color: var(--text-primary, #0f172a);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  transition: background var(--transition-base, 0.2s ease);
  font-size: 1.25rem;
  color: var(--text-secondary, #64748b);
}

.close-button:hover {
  background: var(--bg-secondary, #f1f5f9);
}

.modal-body {
  padding: var(--space-6, 1.5rem);
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-6, 1.5rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
  flex-shrink: 0;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.95) translateY(-20px);
}

@media (max-width: 768px) {
  .modal {
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-overlay {
    padding: 0;
  }
}
</style>
