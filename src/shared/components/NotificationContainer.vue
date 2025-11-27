<template>
  <Teleport to="body">
    <div :class="['notification-container', `notification-container--${position}`]">
      <TransitionGroup name="notification">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :class="['notification', `notification--${notification.type}`]"
          role="alert"
          @click="remove(notification.id)"
        >
          <div class="notification__icon">
            <span v-if="notification.type === 'success'">✓</span>
            <span v-else-if="notification.type === 'error'">✕</span>
            <span v-else-if="notification.type === 'warning'">⚠</span>
            <span v-else>ℹ</span>
          </div>
          <div class="notification__message">{{ notification.message }}</div>
          <button
            class="notification__close"
            type="button"
            aria-label="Fermer"
            @click.stop="remove(notification.id)"
          >
            ✕
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useNotification } from '@/shared/composables/useNotification';

const { notifications, position, remove } = useNotification();
</script>

<style scoped>
.notification-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 420px;
  padding: 1rem;
}

.notification-container--top-right {
  top: 0;
  right: 0;
}

.notification-container--top-center {
  top: 0;
  left: 50%;
  transform: translateX(-50%);
}

.notification-container--top-left {
  top: 0;
  left: 0;
}

.notification-container--bottom-right {
  bottom: 0;
  right: 0;
}

.notification-container--bottom-center {
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.notification-container--bottom-left {
  bottom: 0;
  left: 0;
}

.notification {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: all;
  cursor: pointer;
  min-width: 300px;
  border-left: 4px solid;
  transition: all 0.2s ease;
}

.notification:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  transform: translateY(-2px);
}

.notification--success {
  border-left-color: #10b981;
}

.notification--error {
  border-left-color: #ef4444;
}

.notification--warning {
  border-left-color: #f59e0b;
}

.notification--info {
  border-left-color: #3b82f6;
}

.notification__icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: bold;
  font-size: 14px;
}

.notification--success .notification__icon {
  background: #d1fae5;
  color: #10b981;
}

.notification--error .notification__icon {
  background: #fee2e2;
  color: #ef4444;
}

.notification--warning .notification__icon {
  background: #fef3c7;
  color: #f59e0b;
}

.notification--info .notification__icon {
  background: #dbeafe;
  color: #3b82f6;
}

.notification__message {
  flex: 1;
  font-size: 14px;
  color: #1f2937;
  line-height: 1.5;
}

.notification__close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 0.25rem;
  font-size: 16px;
  line-height: 1;
  transition: color 0.2s ease;
}

.notification__close:hover {
  color: #111827;
}

/* Animations */
.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.notification-move {
  transition: transform 0.3s ease;
}
</style>
