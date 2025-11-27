import { describe, it, expect, beforeEach } from 'vitest';
import { useConfirm } from '../useConfirm';

describe('useConfirm', () => {
  beforeEach(() => {
    const { currentDialog } = useConfirm();
    currentDialog.value = null;
  });

  it('devrait créer un dialogue de confirmation', async () => {
    const { currentDialog, confirm, handleConfirm } = useConfirm();
    
    const promise = confirm({
      message: 'Êtes-vous sûr ?',
    });
    
    expect(currentDialog.value).toBeTruthy();
    expect(currentDialog.value?.message).toBe('Êtes-vous sûr ?');
    expect(currentDialog.value?.title).toBe('Confirmation');
    
    handleConfirm();
    const result = await promise;
    expect(result).toBe(true);
  });

  it('devrait retourner false si annulé', async () => {
    const { confirm, handleCancel } = useConfirm();
    
    const promise = confirm({
      message: 'Supprimer ?',
    });
    
    handleCancel();
    const result = await promise;
    expect(result).toBe(false);
  });

  it('devrait utiliser les textes par défaut', () => {
    const { currentDialog, confirm } = useConfirm();
    
    confirm({
      message: 'Message',
    });
    
    expect(currentDialog.value?.confirmText).toBe('Confirmer');
    expect(currentDialog.value?.cancelText).toBe('Annuler');
    expect(currentDialog.value?.type).toBe('info');
  });

  it('devrait accepter des textes personnalisés', () => {
    const { currentDialog, confirm } = useConfirm();
    
    confirm({
      title: 'Supprimer le bien',
      message: 'Voulez-vous vraiment supprimer ce bien ?',
      confirmText: 'Supprimer',
      cancelText: 'Garder',
      type: 'danger',
    });
    
    expect(currentDialog.value?.title).toBe('Supprimer le bien');
    expect(currentDialog.value?.message).toBe('Voulez-vous vraiment supprimer ce bien ?');
    expect(currentDialog.value?.confirmText).toBe('Supprimer');
    expect(currentDialog.value?.cancelText).toBe('Garder');
    expect(currentDialog.value?.type).toBe('danger');
  });

  it('devrait supporter le type warning', () => {
    const { currentDialog, confirm } = useConfirm();
    
    confirm({
      message: 'Attention',
      type: 'warning',
    });
    
    expect(currentDialog.value?.type).toBe('warning');
  });

  it('devrait fermer le dialogue après confirmation', async () => {
    const { currentDialog, confirm, handleConfirm } = useConfirm();
    
    const promise = confirm({ message: 'OK ?' });
    expect(currentDialog.value).toBeTruthy();
    
    handleConfirm();
    await promise;
    expect(currentDialog.value).toBeNull();
  });

  it('devrait fermer le dialogue après annulation', async () => {
    const { currentDialog, confirm, handleCancel } = useConfirm();
    
    const promise = confirm({ message: 'OK ?' });
    expect(currentDialog.value).toBeTruthy();
    
    handleCancel();
    await promise;
    expect(currentDialog.value).toBeNull();
  });

  it('devrait gérer plusieurs confirmations séquentielles', async () => {
    const { confirm, handleConfirm, handleCancel } = useConfirm();
    
    const promise1 = confirm({ message: 'Premier' });
    handleConfirm();
    const result1 = await promise1;
    expect(result1).toBe(true);
    
    const promise2 = confirm({ message: 'Deuxième' });
    handleCancel();
    const result2 = await promise2;
    expect(result2).toBe(false);
    
    const promise3 = confirm({ message: 'Troisième' });
    handleConfirm();
    const result3 = await promise3;
    expect(result3).toBe(true);
  });
});
