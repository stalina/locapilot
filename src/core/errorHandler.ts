/**
 * Global error capture for the Vue application.
 *
 * Wires three sources of otherwise-uncaught errors into the structured logger
 * and the user-facing notification system:
 *  - Vue's `app.config.errorHandler` (errors thrown in components / lifecycle)
 *  - `window.onerror` (uncaught synchronous errors outside Vue)
 *  - `window.onunhandledrejection` (rejected promises with no handler)
 *
 * Component-tree render errors are additionally caught by `ErrorBoundary.vue`
 * (via `onErrorCaptured`) so the UI can degrade gracefully instead of going
 * blank; this module is the last-resort safety net and reporting layer.
 */
import type { App, ComponentPublicInstance } from 'vue';
import { logger } from '@/shared/utils/logger';
import { useNotification } from '@/shared/composables/useNotification';

const GENERIC_USER_MESSAGE =
  'Une erreur inattendue est survenue. Vos données sont sauvegardées localement.';

function notifyUser(message: string = GENERIC_USER_MESSAGE): void {
  // Resolve lazily so this works whether or not Pinia/Vue is fully mounted yet.
  const { error } = useNotification();
  error(message);
}

/**
 * Registers the Vue application error handler. Errors thrown during render,
 * watchers, lifecycle hooks or event handlers land here.
 */
export function registerVueErrorHandler(app: App): void {
  app.config.errorHandler = (
    err: unknown,
    _instance: ComponentPublicInstance | null,
    info: string
  ) => {
    logger.error('Unhandled Vue error', { source: 'vue', info }, err);
    notifyUser();
  };
}

/**
 * Registers global window-level error listeners for errors that escape Vue.
 * Returns a teardown function (mainly useful for tests).
 */
export function registerGlobalErrorListeners(target: Window = window): () => void {
  const onError = (event: ErrorEvent): void => {
    logger.error(
      'Uncaught error',
      {
        source: 'window.onerror',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
      event.error ?? event.message
    );
    notifyUser();
  };

  const onRejection = (event: PromiseRejectionEvent): void => {
    logger.error('Unhandled promise rejection', { source: 'unhandledrejection' }, event.reason);
    notifyUser();
  };

  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);

  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}

/** Convenience helper wiring both the Vue handler and the window listeners. */
export function installErrorHandling(app: App): void {
  registerVueErrorHandler(app);
  registerGlobalErrorListeners();
}
