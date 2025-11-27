import { ref } from 'vue';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ConfirmDialog extends ConfirmDialogOptions {
  resolve: (value: boolean) => void;
}

const currentDialog = ref<ConfirmDialog | null>(null);

export function useConfirm() {
  const confirm = (options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      currentDialog.value = {
        title: options.title ?? 'Confirmation',
        message: options.message,
        confirmText: options.confirmText ?? 'Confirmer',
        cancelText: options.cancelText ?? 'Annuler',
        type: options.type ?? 'info',
        resolve,
      };
    });
  };

  const handleConfirm = () => {
    if (currentDialog.value) {
      currentDialog.value.resolve(true);
      currentDialog.value = null;
    }
  };

  const handleCancel = () => {
    if (currentDialog.value) {
      currentDialog.value.resolve(false);
      currentDialog.value = null;
    }
  };

  return {
    currentDialog,
    confirm,
    handleConfirm,
    handleCancel,
  };
}
