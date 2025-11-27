import { ref } from 'vue';

export interface Notification {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface NotificationOptions {
  duration?: number;
  position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
}

const notifications = ref<Notification[]>([]);
const position = ref<NotificationOptions['position']>('top-right');
let notificationId = 0;

export function useNotification() {
  const show = (
    type: Notification['type'],
    message: string,
    options: NotificationOptions = {}
  ) => {
    const id = ++notificationId;
    const duration = options.duration ?? (type === 'error' ? 5000 : 3000);
    
    if (options.position) {
      position.value = options.position;
    }

    const notification: Notification = {
      id,
      type,
      message,
      duration,
    };

    notifications.value.push(notification);

    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }

    return id;
  };

  const remove = (id: number) => {
    const index = notifications.value.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications.value.splice(index, 1);
    }
  };

  const success = (message: string, options?: NotificationOptions) => {
    return show('success', message, options);
  };

  const error = (message: string, options?: NotificationOptions) => {
    return show('error', message, options);
  };

  const warning = (message: string, options?: NotificationOptions) => {
    return show('warning', message, options);
  };

  const info = (message: string, options?: NotificationOptions) => {
    return show('info', message, options);
  };

  const clear = () => {
    notifications.value = [];
  };

  return {
    notifications,
    position,
    show,
    remove,
    success,
    error,
    warning,
    info,
    clear,
  };
}
