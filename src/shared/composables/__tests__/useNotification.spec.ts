import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNotification } from '../useNotification';

describe('useNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const { clear } = useNotification();
    clear(); // Clear notifications from previous tests
  });

  it('devrait créer une notification success', () => {
    const { notifications, success } = useNotification();
    
    success('Opération réussie');
    
    expect(notifications.value).toHaveLength(1);
    expect(notifications.value[0]).toMatchObject({
      type: 'success',
      message: 'Opération réussie',
    });
  });

  it('devrait créer une notification error', () => {
    const { notifications, error } = useNotification();
    
    error('Une erreur est survenue');
    
    expect(notifications.value).toHaveLength(1);
    expect(notifications.value[0]).toMatchObject({
      type: 'error',
      message: 'Une erreur est survenue',
    });
  });

  it('devrait créer une notification warning', () => {
    const { notifications, warning } = useNotification();
    
    warning('Attention');
    
    expect(notifications.value).toHaveLength(1);
    expect(notifications.value[0]).toMatchObject({
      type: 'warning',
      message: 'Attention',
    });
  });

  it('devrait créer une notification info', () => {
    const { notifications, info } = useNotification();
    
    info('Information');
    
    expect(notifications.value).toHaveLength(1);
    expect(notifications.value[0]).toMatchObject({
      type: 'info',
      message: 'Information',
    });
  });

  it('devrait auto-supprimer les notifications après le délai', () => {
    const { notifications, success } = useNotification();
    
    success('Message', { duration: 1000 });
    expect(notifications.value).toHaveLength(1);
    
    vi.advanceTimersByTime(1000);
    expect(notifications.value).toHaveLength(0);
  });

  it('devrait utiliser un délai plus long pour les erreurs', () => {
    const { notifications, error } = useNotification();
    
    error('Erreur');
    const notification = notifications.value[0]!;
    expect(notification.duration).toBe(5000);
  });

  it('devrait utiliser un délai de 3s pour les autres types', () => {
    const { notifications, success } = useNotification();
    
    success('OK');
    const notification = notifications.value[0]!;
    expect(notification.duration).toBe(3000);
  });

  it('devrait permettre de supprimer manuellement une notification', () => {
    const { notifications, success, remove } = useNotification();
    
    const id = success('Message');
    expect(notifications.value).toHaveLength(1);
    
    remove(id);
    expect(notifications.value).toHaveLength(0);
  });

  it('devrait permettre de clear toutes les notifications', () => {
    const { notifications, success, error, clear } = useNotification();
    
    success('Message 1');
    error('Message 2');
    success('Message 3');
    expect(notifications.value).toHaveLength(3);
    
    clear();
    expect(notifications.value).toHaveLength(0);
  });

  it('devrait permettre de configurer la position', () => {
    const { position, success } = useNotification();
    
    success('Message', { position: 'bottom-left' });
    expect(position.value).toBe('bottom-left');
  });

  it('devrait accepter une durée personnalisée', () => {
    const { notifications, success } = useNotification();
    
    success('Message', { duration: 10000 });
    const notification = notifications.value[0]!;
    expect(notification.duration).toBe(10000);
  });

  it('devrait générer des IDs uniques', () => {
    const { notifications, success } = useNotification();
    
    success('Message 1');
    success('Message 2');
    success('Message 3');
    
    const ids = notifications.value.map(n => n.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it('devrait supporter duration = 0 pour ne pas auto-supprimer', () => {
    const { notifications, success } = useNotification();
    
    success('Message permanent', { duration: 0 });
    expect(notifications.value).toHaveLength(1);
    
    vi.advanceTimersByTime(10000);
    expect(notifications.value).toHaveLength(1);
  });
});
