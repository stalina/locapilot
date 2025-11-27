<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="currentDialog" class="modal-overlay" @click.self="handleCancel">
        <div class="confirm-dialog" role="alertdialog" aria-labelledby="dialog-title">
          <div class="confirm-dialog__header">
            <h3 id="dialog-title" class="confirm-dialog__title">
              {{ currentDialog.title }}
            </h3>
          </div>
          
          <div class="confirm-dialog__body">
            <div v-if="currentDialog.type" :class="['confirm-dialog__icon', `confirm-dialog__icon--${currentDialog.type}`]">
              <span v-if="currentDialog.type === 'danger'">⚠</span>
              <span v-else-if="currentDialog.type === 'warning'">⚠</span>
              <span v-else>ℹ</span>
            </div>
            <p class="confirm-dialog__message">{{ currentDialog.message }}</p>
          </div>
          
          <div class="confirm-dialog__footer">
            <button
              class="btn btn--secondary"
              type="button"
              @click="handleCancel"
            >
              {{ currentDialog.cancelText }}
            </button>
            <button
              :class="['btn', `btn--${currentDialog.type === 'danger' ? 'danger' : 'primary'}`]"
              type="button"
              @click="handleConfirm"
            >
              {{ currentDialog.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useConfirm } from '@/shared/composables/useConfirm';

const { currentDialog, handleConfirm, handleCancel } = useConfirm();
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  padding: 1rem;
}

.confirm-dialog {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.confirm-dialog__header {
  padding: 1.5rem 1.5rem 1rem;
}

.confirm-dialog__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.confirm-dialog__body {
  padding: 0 1.5rem 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.confirm-dialog__icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.confirm-dialog__icon--danger {
  background: #fee2e2;
  color: #ef4444;
}

.confirm-dialog__icon--warning {
  background: #fef3c7;
  color: #f59e0b;
}

.confirm-dialog__icon--info {
  background: #dbeafe;
  color: #3b82f6;
}

.confirm-dialog__message {
  flex: 1;
  color: #4b5563;
  line-height: 1.6;
  margin: 0;
  padding-top: 0.5rem;
}

.confirm-dialog__footer {
  padding: 1rem 1.5rem;
  background: #f9fafb;
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn--secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn--secondary:hover {
  background: #f9fafb;
}

.btn--primary {
  background: #3b82f6;
  color: white;
}

.btn--primary:hover {
  background: #2563eb;
}

.btn--danger {
  background: #ef4444;
  color: white;
}

.btn--danger:hover {
  background: #dc2626;
}

/* Animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .confirm-dialog,
.modal-leave-active .confirm-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .confirm-dialog {
  transform: scale(0.95);
  opacity: 0;
}

.modal-leave-to .confirm-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
