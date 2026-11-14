import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import RestorePointsCard from './RestorePointsCard.vue';
import {
  BackupFailedError,
  CONTINUE_WITHOUT_RESTORE_POINT_PROMPT,
  InvalidSnapshotError,
  type StoredBackupSnapshot,
} from '../services/backupService';
import { SYNC_TABLES, type SyncTableName } from '../services/dataTransferService';

const store = await vi.hoisted(async () => {
  const { reactive } = await import('vue');
  return reactive({
    snapshots: [] as StoredBackupSnapshot[],
    isCreating: false,
    isRestoring: false,
    lastAutoError: null as string | null,
    unavailable: false,
    persisted: null as boolean | null,
    autoBackupEnabled: true,
    loadSnapshots: vi.fn(async () => {}),
    loadAutoBackupSetting: vi.fn(async () => true),
    setAutoBackupEnabled: vi.fn(async (_enabled: boolean) => {}),
    createSnapshot: vi.fn(async (_trigger: string) => 'created'),
    restoreSnapshot: vi.fn(async (_id: number, _options?: { skipSnapshot?: boolean }) => {}),
    downloadSnapshot: vi.fn(async (_id: number) => {}),
    deleteSnapshot: vi.fn(async (_id: number) => {}),
  });
});

vi.mock('../stores/backupStore', () => ({ useBackupStore: () => store }));

function counts(overrides: Partial<Record<SyncTableName, number>> = {}) {
  const zero = Object.fromEntries(SYNC_TABLES.map(t => [t, 0])) as Record<SyncTableName, number>;
  return { ...zero, ...overrides };
}

function snapshot(id: number, overrides: Partial<StoredBackupSnapshot> = {}): StoredBackupSnapshot {
  return {
    id,
    createdAt: new Date(2026, 10, 10, 9, 30),
    trigger: 'auto',
    appVersion: '1.2.0',
    schemaVersion: 12,
    counts: counts({ properties: 3, tenants: 5, leases: 4, documents: 10, tenantDocuments: 2 }),
    totalBytes: 48 * 1024 * 1024,
    ...overrides,
  };
}

let wrapper: VueWrapper | null = null;

async function mountCard() {
  wrapper = mount(RestorePointsCard, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const button = (w: VueWrapper, text: string, index = 0) => {
  const buttons = w.findAll('button').filter(b => b.text().trim() === text);
  const found = buttons[index];
  if (!found) throw new Error(`button "${text}" not found`);
  return found;
};

const message = (w: VueWrapper) => w.find('[data-testid="restore-points-message"]');

describe('RestorePointsCard', () => {
  beforeEach(() => {
    store.snapshots = [];
    store.isCreating = false;
    store.isRestoring = false;
    store.lastAutoError = null;
    store.unavailable = false;
    store.persisted = null;
    store.autoBackupEnabled = true;
    store.createSnapshot.mockResolvedValue('created');
    store.restoreSnapshot.mockResolvedValue(undefined);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.unstubAllGlobals();
  });

  it('loads the setting and the list on mount', async () => {
    await mountCard();
    expect(store.loadAutoBackupSetting).toHaveBeenCalled();
    expect(store.loadSnapshots).toHaveBeenCalled();
  });

  it('shows the empty state and the create button when there is no restore point', async () => {
    const w = await mountCard();
    expect(w.get('[data-testid="restore-points-empty"]').text()).toBe(
      'Aucun point de restauration pour le moment'
    );
    expect(button(w, 'Créer un point de restauration').exists()).toBe(true);
  });

  it('lists each restore point with its date, label, counts, size and actions', async () => {
    store.snapshots = [
      snapshot(2, { trigger: 'pre-clear', createdAt: new Date(2026, 10, 12, 18, 5) }),
      snapshot(1),
    ];
    const w = await mountCard();

    const items = w.findAll('[data-testid="restore-point"]');
    expect(items).toHaveLength(2);
    expect(items[0]?.text()).toContain('12/11/2026 18:05');
    expect(items[0]?.text()).toContain('Avant effacement');
    expect(items[1]?.text()).toContain('Automatique');
    expect(items[0]?.text()).toContain('3 biens · 5 locataires · 4 baux · 12 documents · 48 Mo');
    for (const label of ['Restaurer', 'Télécharger', 'Supprimer']) {
      expect(items[0]?.findAll('button').some(b => b.text().trim() === label)).toBe(true);
    }
  });

  it('uses the singular for one record', async () => {
    store.snapshots = [
      snapshot(1, { counts: counts({ properties: 1, tenants: 1, leases: 1, documents: 1 }) }),
    ];
    const w = await mountCard();
    expect(w.text()).toContain('1 bien · 1 locataire · 1 bail · 1 document');
  });

  it('shows the toggle bound to autoBackupEnabled and saves changes', async () => {
    store.autoBackupEnabled = false;
    const w = await mountCard();
    const toggle = w.get<HTMLInputElement>('[data-testid="auto-backup-toggle"]');
    expect(toggle.element.checked).toBe(false);
    expect(w.text()).toContain('Points de restauration automatiques');

    await toggle.setValue(true);
    await flushPromises();

    expect(store.setAutoBackupEnabled).toHaveBeenCalledWith(true);
  });

  it('reverts the toggle and shows an error when saving fails', async () => {
    store.setAutoBackupEnabled.mockRejectedValueOnce(new Error('db'));
    const w = await mountCard();
    const toggle = w.get<HTMLInputElement>('[data-testid="auto-backup-toggle"]');

    await toggle.setValue(false);
    await flushPromises();

    expect(toggle.element.checked).toBe(true);
    expect(message(w).text()).toBe('Erreur lors de la sauvegarde du réglage');
  });

  it('shows a non-blocking warning when the last automatic restore point failed', async () => {
    store.lastAutoError = 'Le dernier point de restauration automatique n’a pas pu être créé';
    const w = await mountCard();
    expect(w.get('[data-testid="restore-points-auto-error"]').text()).toContain(
      store.lastAutoError
    );
  });

  it('says restore points are unavailable on this browser', async () => {
    store.unavailable = true;
    const w = await mountCard();
    expect(w.get('[data-testid="restore-points-unavailable"]').text()).toBe(
      'Points de restauration indisponibles sur ce navigateur'
    );
    expect(w.findAll('button').some(b => b.text().includes('Créer'))).toBe(false);
  });

  it('always recommends a file export, emphasised when persistence was refused', async () => {
    const w = await mountCard();
    const hint = () => w.get('[data-testid="restore-points-hint"]');
    expect(hint().text()).toContain('Exportez aussi régulièrement vos données');
    expect(hint().classes()).not.toContain('restore-points-hint--emphasis');

    store.persisted = false;
    await flushPromises();
    expect(hint().classes()).toContain('restore-points-hint--emphasis');
    expect(hint().text()).toContain('Votre navigateur peut supprimer les données locales');
  });

  describe('create', () => {
    it('creates a manual restore point and confirms it', async () => {
      const w = await mountCard();
      await button(w, 'Créer un point de restauration').trigger('click');
      await flushPromises();

      expect(store.createSnapshot).toHaveBeenCalledWith('manual');
      expect(message(w).text()).toBe('Point de restauration créé');
    });

    it('says there is nothing to save on an empty database', async () => {
      store.createSnapshot.mockResolvedValueOnce('skipped-empty');
      const w = await mountCard();
      await button(w, 'Créer un point de restauration').trigger('click');
      await flushPromises();

      expect(message(w).text()).toBe('Aucune donnée à sauvegarder');
    });

    it('shows the quota error', async () => {
      store.createSnapshot.mockRejectedValueOnce(new BackupFailedError('quota'));
      const w = await mountCard();
      await button(w, 'Créer un point de restauration').trigger('click');
      await flushPromises();

      expect(message(w).text()).toBe(
        'Espace de stockage insuffisant pour créer un point de restauration'
      );
    });

    it('shows a generic error for an unexpected failure', async () => {
      store.createSnapshot.mockRejectedValueOnce(new Error('boom'));
      const w = await mountCard();
      await button(w, 'Créer un point de restauration').trigger('click');
      await flushPromises();

      expect(message(w).text()).toBe('Impossible de créer le point de restauration');
    });
  });

  describe('restore', () => {
    beforeEach(() => {
      store.snapshots = [snapshot(7)];
    });

    it('asks for confirmation, restores, reports success and emits "restored"', async () => {
      const w = await mountCard();
      await button(w, 'Restaurer').trigger('click');
      await flushPromises();

      expect(window.confirm).toHaveBeenCalledWith(
        'Vos données actuelles seront remplacées par celles du point de restauration du 10/11/2026 09:30. Continuer ?'
      );
      expect(store.restoreSnapshot).toHaveBeenCalledWith(7, { skipSnapshot: false });
      expect(message(w).text()).toBe('Données restaurées avec succès');
      expect(w.emitted('restored')).toHaveLength(1);
    });

    it('does nothing when the confirmation is cancelled', async () => {
      vi.mocked(window.confirm).mockReturnValueOnce(false);
      const w = await mountCard();
      await button(w, 'Restaurer').trigger('click');
      await flushPromises();

      expect(store.restoreSnapshot).not.toHaveBeenCalled();
      expect(w.emitted('restored')).toBeUndefined();
    });

    it('shows the invalid restore point error', async () => {
      store.restoreSnapshot.mockRejectedValueOnce(new InvalidSnapshotError());
      const w = await mountCard();
      await button(w, 'Restaurer').trigger('click');
      await flushPromises();

      expect(message(w).text()).toBe(
        'Ce point de restauration est invalide — restauration annulée'
      );
      expect(w.emitted('restored')).toBeUndefined();
    });

    it('reports a failure while writing without claiming success', async () => {
      store.restoreSnapshot.mockRejectedValueOnce(new Error('QuotaExceededError'));
      const w = await mountCard();
      await button(w, 'Restaurer').trigger('click');
      await flushPromises();

      expect(message(w).text()).toBe(
        "Erreur lors de la restauration — vos données n'ont pas été modifiées"
      );
    });

    it('asks to continue without a pre-restore point and stops when declined', async () => {
      store.restoreSnapshot.mockRejectedValueOnce(new BackupFailedError('quota'));
      vi.mocked(window.confirm).mockReturnValueOnce(true).mockReturnValueOnce(false);
      const w = await mountCard();
      await button(w, 'Restaurer').trigger('click');
      await flushPromises();

      expect(window.confirm).toHaveBeenLastCalledWith(CONTINUE_WITHOUT_RESTORE_POINT_PROMPT);
      expect(store.restoreSnapshot).toHaveBeenCalledTimes(1);
      expect(message(w).text()).toBe("Restauration annulée — aucune donnée n'a été modifiée");
    });

    it('restores without a pre-restore point when the user continues', async () => {
      store.restoreSnapshot.mockRejectedValueOnce(new BackupFailedError('unavailable'));
      const w = await mountCard();
      await button(w, 'Restaurer').trigger('click');
      await flushPromises();

      expect(store.restoreSnapshot).toHaveBeenLastCalledWith(7, { skipSnapshot: true });
      expect(message(w).text()).toBe('Données restaurées avec succès');
    });
  });

  describe('download and delete', () => {
    beforeEach(() => {
      store.snapshots = [snapshot(7)];
    });

    it('downloads the restore point', async () => {
      const w = await mountCard();
      await button(w, 'Télécharger').trigger('click');
      await flushPromises();
      expect(store.downloadSnapshot).toHaveBeenCalledWith(7);
    });

    it('reports a download failure', async () => {
      store.downloadSnapshot.mockRejectedValueOnce(new Error('boom'));
      const w = await mountCard();
      await button(w, 'Télécharger').trigger('click');
      await flushPromises();
      expect(message(w).text()).toBe('Erreur lors du téléchargement du point de restauration');
    });

    it('deletes after confirmation', async () => {
      const w = await mountCard();
      await button(w, 'Supprimer').trigger('click');
      await flushPromises();

      expect(window.confirm).toHaveBeenCalledWith('Supprimer ce point de restauration ?');
      expect(store.deleteSnapshot).toHaveBeenCalledWith(7);
    });

    it('keeps the restore point when the deletion is cancelled', async () => {
      vi.mocked(window.confirm).mockReturnValueOnce(false);
      const w = await mountCard();
      await button(w, 'Supprimer').trigger('click');
      await flushPromises();

      expect(store.deleteSnapshot).not.toHaveBeenCalled();
    });

    it('reports a deletion failure', async () => {
      store.deleteSnapshot.mockRejectedValueOnce(new Error('boom'));
      const w = await mountCard();
      await button(w, 'Supprimer').trigger('click');
      await flushPromises();
      expect(message(w).text()).toBe('Erreur lors de la suppression du point de restauration');
    });
  });
});
