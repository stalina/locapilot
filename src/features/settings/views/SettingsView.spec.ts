/* eslint-env vitest */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import SettingsView from './SettingsView.vue';
import { generatePairingQrDataUrl } from '../services/pairingLinkService';

type StatusCb = (status: string, info?: unknown) => void;

// vi.hoisted(): shared state available inside the vi.mock() factories below.
const mocks = await vi.hoisted(async () => {
  const { reactive } = await import('vue');
  const route = reactive({ hash: '' });

  type DataCb = (payload: unknown) => Promise<void>;
  type ManifestCb = (manifest: unknown) => Promise<boolean>;

  class MockPeerSyncService {
    static instances: MockPeerSyncService[] = [];
    onData: DataCb;
    onStatus: StatusCb;
    onManifest: ManifestCb;
    startHosting = vi.fn(async (id: string) => {
      this.onStatus('hosting', id);
    });
    // Like the real service: tearing the peer down reports "stopped".
    stopHosting = vi.fn(() => this.onStatus('stopped'));
    connect = vi.fn(async () => {});
    disconnect = vi.fn(() => {
      this.onStatus('stopped');
    });
    streamTransfer = vi.fn(async () => 'completed');
    constructor(onData: DataCb, onStatus: StatusCb, onManifest: ManifestCb) {
      this.onData = onData;
      this.onStatus = onStatus;
      this.onManifest = onManifest;
      MockPeerSyncService.instances.push(this);
    }
  }

  const syncSource = { appVersion: 'test', totalBytes: 0 };
  const dataTransferStore = {
    isExporting: false,
    isImporting: false,
    exportData: vi.fn(async () => ({ json: '{}' })),
    buildSyncSource: vi.fn(async () => syncSource),
    importFromObject: vi.fn(async (_payload: unknown) => {}),
  };

  return {
    route,
    MockPeerSyncService,
    syncSource,
    dataTransferStore,
    replace: vi.fn(async (to: { hash?: string }) => {
      // Behave like the real router: the fragment is gone once replaced.
      route.hash = to.hash ?? '';
    }),
    push: vi.fn(),
  };
});

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  RouterLink: { template: '<a><slot /></a>' },
}));

vi.mock('../services/peerSyncService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/peerSyncService')>();
  return {
    ...actual,
    default: mocks.MockPeerSyncService,
    PeerSyncService: mocks.MockPeerSyncService,
  };
});

// Keep the real link builder/parser; only QR rendering is mocked.
vi.mock('../services/pairingLinkService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/pairingLinkService')>();
  return { ...actual, generatePairingQrDataUrl: vi.fn() };
});

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: () => ({
    loadSettings: vi.fn(async () => {}),
    fetchSenderInfo: vi.fn(async () => ({})),
    currentDefaultRejectionMessage: '',
    reminderThresholds: [],
  }),
}));

vi.mock('../stores/dataTransferStore', () => ({
  useDataTransferStore: () => mocks.dataTransferStore,
}));

const QR_DATA_URL = 'data:image/png;base64,QRCODE';
const READY_STATUS =
  "Session de synchronisation détectée — vérifiez qu'elle provient de votre appareil puis cliquez sur « Se connecter »";
const PIN_MISSING_STATUS =
  "Session de synchronisation détectée — saisissez le code PIN fourni par l'hôte puis cliquez sur « Se connecter »";

let wrapper: VueWrapper | null = null;
const scrollIntoView = vi.fn();

async function mountView(hash = '') {
  mocks.route.hash = hash;
  wrapper = mount(SettingsView, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const p2pCard = (w: VueWrapper) => w.get('[data-testid="p2p-sync-card"]');
const sessionInput = (w: VueWrapper) =>
  p2pCard(w).get<HTMLInputElement>('input[placeholder*="ID de session"]');
const pinInput = (w: VueWrapper) =>
  p2pCard(w).get<HTMLInputElement>('input[placeholder*="Code PIN"]');
const buttonByText = (w: VueWrapper, text: string) => {
  const button = p2pCard(w)
    .findAll('button')
    .find(b => b.text().trim() === text);
  if (!button) throw new Error(`button "${text}" not found`);
  return button;
};
/** The host session (session ID, PIN, QR code, "Arrêter") is displayed. */
const hasHostSession = (w: VueWrapper) => {
  const info = w.find('.peer-session-info');
  return (
    info.exists() &&
    info.find('code').text().startsWith('LP') &&
    /^\d{6}$/.test(info.find('.peer-pin').text()) &&
    w.find('[data-testid="p2p-qr-code"]').exists() &&
    p2pCard(w)
      .findAll('button')
      .some(b => b.text().trim() === 'Arrêter')
  );
};
const lastPeerService = () => {
  const { instances } = mocks.MockPeerSyncService;
  const instance = instances[instances.length - 1];
  if (!instance) throw new Error('no PeerSyncService instance');
  return instance;
};

beforeEach(() => {
  mocks.MockPeerSyncService.instances = [];
  mocks.route.hash = '';
  vi.mocked(generatePairingQrDataUrl).mockResolvedValue(QR_DATA_URL);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  );
  vi.stubGlobal('alert', vi.fn());
  Element.prototype.scrollIntoView = scrollIntoView;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.unstubAllGlobals();
});

describe('SettingsView — P2P pairing QR code (#118)', () => {
  describe('client side — reading a pairing link', () => {
    it('leaves the fields empty and shows no status without a pairing link', async () => {
      const w = await mountView('');

      expect(sessionInput(w).element.value).toBe('');
      expect(pinInput(w).element.value).toBe('');
      expect(p2pCard(w).text()).not.toContain('Statut');
      expect(mocks.replace).not.toHaveBeenCalled();
    });

    it('ignores an unrelated hash', async () => {
      const w = await mountView('#section');

      expect(sessionInput(w).element.value).toBe('');
      expect(mocks.replace).not.toHaveBeenCalled();
    });

    it('pre-fills the session id and PIN, invites to connect, strips the fragment', async () => {
      const w = await mountView('#p2p=LP7K4MQ2XB&pin=482913');

      expect(sessionInput(w).element.value).toBe('LP7K4MQ2XB');
      expect(pinInput(w).element.value).toBe('482913');
      expect(p2pCard(w).text()).toContain(READY_STATUS);
      expect(mocks.replace).toHaveBeenCalledWith({ name: 'settings', hash: '' });
      expect(scrollIntoView).toHaveBeenCalled();
    });

    it('never connects automatically and never stores the PIN', async () => {
      await mountView('#p2p=LP7K4MQ2XB&pin=482913');

      // No PeerSyncService is even created until "Se connecter" is clicked.
      expect(mocks.MockPeerSyncService.instances).toHaveLength(0);
      expect(JSON.stringify({ ...localStorage })).not.toContain('482913');
      expect(JSON.stringify({ ...sessionStorage })).not.toContain('482913');
    });

    it('connects with the pre-filled values only when "Se connecter" is clicked', async () => {
      const w = await mountView('#p2p=LP7K4MQ2XB&pin=482913');

      await buttonByText(w, 'Se connecter').trigger('click');
      await flushPromises();

      expect(lastPeerService().connect).toHaveBeenCalledWith('LP7K4MQ2XB', '482913');
    });

    it('normalises a lower-case, dashed session id', async () => {
      const w = await mountView('#p2p=lp7k-4mq2-xb&pin=482913');

      expect(sessionInput(w).element.value).toBe('LP7K4MQ2XB');
    });

    it('pre-fills only the session id when the PIN is missing or invalid', async () => {
      const w = await mountView('#p2p=LP7K4MQ2XB&pin=12345');

      expect(sessionInput(w).element.value).toBe('LP7K4MQ2XB');
      expect(pinInput(w).element.value).toBe('');
      expect(p2pCard(w).text()).toContain(PIN_MISSING_STATUS);
      expect(mocks.replace).toHaveBeenCalledWith({ name: 'settings', hash: '' });
    });

    it('shows "Lien de synchronisation invalide" and pre-fills nothing for an invalid id', async () => {
      const w = await mountView('#p2p=BAD&pin=123456');

      expect(sessionInput(w).element.value).toBe('');
      expect(pinInput(w).element.value).toBe('');
      expect(p2pCard(w).text()).toContain('Lien de synchronisation invalide');
      expect(mocks.replace).toHaveBeenCalledWith({ name: 'settings', hash: '' });
      expect(mocks.MockPeerSyncService.instances).toHaveLength(0);
    });

    it('reads a pairing link arriving while Settings is already open', async () => {
      const w = await mountView('');

      mocks.route.hash = '#p2p=LP23456789&pin=111222';
      await flushPromises();

      expect(sessionInput(w).element.value).toBe('LP23456789');
      expect(pinInput(w).element.value).toBe('111222');
      expect(mocks.replace).toHaveBeenCalledWith({ name: 'settings', hash: '' });
    });
  });

  describe('host side — displaying the QR code', () => {
    async function startHosting(w: VueWrapper) {
      await buttonByText(w, 'Héberger').trigger('click');
      await flushPromises();
    }

    it('shows the QR code of the pairing link next to the session id and PIN', async () => {
      const w = await mountView();
      await startHosting(w);

      const info = w.get('.peer-session-info');
      const sessionId = info.get('code').text();
      const pin = info.get('.peer-pin').text();
      const img = info.get<HTMLImageElement>('[data-testid="p2p-qr-code"]');

      expect(img.attributes('src')).toBe(QR_DATA_URL);
      expect(img.attributes('alt')).toBe('QR code de synchronisation');
      expect(info.text()).toContain("Scannez ce QR code avec l'appareil photo de l'autre appareil");

      const appRootUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
      expect(generatePairingQrDataUrl).toHaveBeenCalledWith(
        `${appRootUrl}#p2p=${sessionId}&pin=${pin}`
      );
    });

    it('hides the QR code when hosting is stopped', async () => {
      const w = await mountView();
      await startHosting(w);
      expect(w.find('[data-testid="p2p-qr-code"]').exists()).toBe(true);

      await buttonByText(w, 'Arrêter').trigger('click');
      await flushPromises();

      expect(w.find('[data-testid="p2p-qr-code"]').exists()).toBe(false);
      expect(w.find('.peer-session-info').exists()).toBe(false);
    });

    it('hides the QR code when the host peer reports "stopped"', async () => {
      const w = await mountView();
      await startHosting(w);

      lastPeerService().onStatus('stopped');
      await flushPromises();

      expect(w.find('[data-testid="p2p-qr-code"]').exists()).toBe(false);
    });

    it('hides the QR code when the host is locked out', async () => {
      const w = await mountView();
      await startHosting(w);

      lastPeerService().onStatus('locked-out', { retryAfterMs: 30_000 });
      await flushPromises();

      expect(w.find('[data-testid="p2p-qr-code"]').exists()).toBe(false);
      expect(p2pCard(w).text()).toContain('Session verrouillée');
    });

    it('keeps the session id and PIN usable when QR generation fails', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(generatePairingQrDataUrl).mockRejectedValueOnce(new Error('no canvas'));
      const w = await mountView();
      await startHosting(w);

      expect(w.find('[data-testid="p2p-qr-code"]').exists()).toBe(false);
      expect(w.get('.peer-session-info code').text()).toMatch(/^LP/);
      expect(w.get('.peer-session-info .peer-pin').text()).toMatch(/^\d{6}$/);
      expect(buttonByText(w, 'Arrêter').exists()).toBe(true);
      expect(warn).toHaveBeenCalledWith('Pairing QR code generation failed', expect.any(Error));
      expect(window.alert).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('drops a QR code of a previous session that finishes rendering late', async () => {
      const STALE_QR = 'data:image/png;base64,STALE';
      let resolveStaleQr: (url: string) => void = () => {};
      vi.mocked(generatePairingQrDataUrl).mockImplementationOnce(
        () => new Promise<string>(resolve => (resolveStaleQr = resolve))
      );
      const w = await mountView();

      // Session 1: QR still rendering when hosting is stopped.
      await startHosting(w);
      await buttonByText(w, 'Arrêter').trigger('click');
      await flushPromises();

      // Session 2 starts and gets its own QR code.
      await startHosting(w);
      expect(w.get('[data-testid="p2p-qr-code"]').attributes('src')).toBe(QR_DATA_URL);

      // Session 1's late result must not replace session 2's QR code.
      resolveStaleQr(STALE_QR);
      await flushPromises();

      expect(w.get('[data-testid="p2p-qr-code"]').attributes('src')).toBe(QR_DATA_URL);
    });
  });
});

describe('SettingsView — P2P host session lifecycle', () => {
  async function host() {
    const w = await mountView();
    await buttonByText(w, 'Héberger').trigger('click');
    await flushPromises();
    expect(hasHostSession(w)).toBe(true);
    return { w, service: lastPeerService() };
  }

  async function connectAsClient(w: VueWrapper) {
    await sessionInput(w).setValue('LP7K4MQ2XB');
    await pinInput(w).setValue('482913');
    await buttonByText(w, 'Se connecter').trigger('click');
    await flushPromises();
    return lastPeerService();
  }

  describe('host side', () => {
    it('keeps the session id, PIN, QR code and "Arrêter" when a client disconnects', async () => {
      const { w, service } = await host();

      service.onStatus('client-connected');
      service.onStatus('client-disconnected');
      await flushPromises();

      expect(hasHostSession(w)).toBe(true);
      expect(p2pCard(w).text()).toContain(
        "Appareil déconnecté — en attente d'une nouvelle connexion"
      );
      expect(service.stopHosting).not.toHaveBeenCalled();
    });

    it('keeps the host session after a rejected PIN', async () => {
      const { w, service } = await host();

      service.onStatus('auth-failed', { attempts: 1 });
      await flushPromises();

      expect(hasHostSession(w)).toBe(true);
      expect(p2pCard(w).text()).toContain('Connexion rejetée — PIN incorrect');
      expect(p2pCard(w).text()).not.toContain('stopped');
    });

    it('ends the host session once the transfer is complete', async () => {
      const { w, service } = await host();

      service.onStatus('transfer-complete');
      await flushPromises();

      expect(w.find('.peer-session-info').exists()).toBe(false);
      expect(w.find('[data-testid="p2p-qr-code"]').exists()).toBe(false);
      expect(buttonByText(w, 'Héberger').exists()).toBe(true);
      expect(p2pCard(w).text()).toContain('Données envoyées — session de synchronisation terminée');
    });

    it('hosts a fresh session after a completed transfer', async () => {
      const { w, service } = await host();
      service.onStatus('transfer-complete');
      await flushPromises();

      await buttonByText(w, 'Héberger').trigger('click');
      await flushPromises();

      expect(mocks.MockPeerSyncService.instances).toHaveLength(2);
      expect(lastPeerService()).not.toBe(service);
      expect(hasHostSession(w)).toBe(true);
    });

    it('releases a client peer before hosting', async () => {
      const w = await mountView();
      const client = await connectAsClient(w);

      await buttonByText(w, 'Héberger').trigger('click');
      await flushPromises();

      expect(client.disconnect).toHaveBeenCalledTimes(1);
      expect(lastPeerService()).not.toBe(client);
      expect(hasHostSession(w)).toBe(true);
    });

    it('releases the host peer and ends the host session before connecting as a client', async () => {
      const { w, service } = await host();

      const client = await connectAsClient(w);

      expect(service.disconnect).toHaveBeenCalledTimes(1);
      expect(client).not.toBe(service);
      expect(client.connect).toHaveBeenCalledWith('LP7K4MQ2XB', '482913');
      expect(w.find('.peer-session-info').exists()).toBe(false);
      expect(buttonByText(w, 'Héberger').exists()).toBe(true);
    });
  });

  describe('client side', () => {
    it('keeps "Authentification échouée — PIN incorrect" once the client peer stops', async () => {
      const w = await mountView();
      const client = await connectAsClient(w);

      client.onStatus('auth-failed');
      client.onStatus('stopped');
      await flushPromises();

      expect(p2pCard(w).text()).toContain('Authentification échouée — PIN incorrect');
      expect(p2pCard(w).text()).not.toContain('stopped');
    });

    it('keeps "Synchronisation terminée" after a successful sync disconnects the peer', async () => {
      vi.stubGlobal(
        'confirm',
        vi.fn(() => true)
      );
      const w = await mountView();
      const client = await connectAsClient(w);

      await client.onData({ properties: [], tenants: [], version: '1.2.0' });
      await flushPromises();

      expect(client.disconnect).toHaveBeenCalledTimes(1);
      expect(p2pCard(w).text()).toContain('Synchronisation terminée');
      expect(p2pCard(w).text()).not.toContain('stopped');
    });
  });
});

// Issue #122 — streamed P2P transfer wired into the view.
describe('SettingsView — streamed P2P transfer (#122)', () => {
  const MO = 1024 * 1024;
  const manifest = (totalBytes: number, documents = 900) => ({
    protocolVersion: 2,
    appVersion: '1.2.0',
    exportedAt: '2026-01-01T00:00:00.000Z',
    counts: {},
    documents,
    totalBytes,
    totalChunks: 10,
  });
  const progress = (w: VueWrapper) => w.find('[data-testid="p2p-transfer-progress"]');

  function stubStorage(storage: Record<string, unknown> | undefined) {
    Object.defineProperty(navigator, 'storage', { configurable: true, value: storage });
  }

  async function startClient(w: VueWrapper) {
    await sessionInput(w).setValue('LP7K4MQ2XB');
    await pinInput(w).setValue('482913');
    await buttonByText(w, 'Se connecter').trigger('click');
    await flushPromises();
    return lastPeerService();
  }

  async function startHost(w: VueWrapper) {
    await buttonByText(w, 'Héberger').trigger('click');
    await flushPromises();
    return lastPeerService();
  }

  beforeEach(() => {
    mocks.MockPeerSyncService.instances = [];
    mocks.route.hash = '';
    vi.mocked(generatePairingQrDataUrl).mockResolvedValue(QR_DATA_URL);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false }))
    );
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    Element.prototype.scrollIntoView = scrollIntoView;
    mocks.dataTransferStore.importFromObject.mockImplementation(async () => {});
    stubStorage(undefined);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'storage');
  });

  describe('host side', () => {
    it('streams the sync source (no JSON export) once the user confirms', async () => {
      const w = await mountView();
      const svc = await startHost(w);

      svc.onStatus('auth-ok');
      await flushPromises();

      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Envoyer la synchronisation ?')
      );
      expect(mocks.dataTransferStore.buildSyncSource).toHaveBeenCalled();
      expect(svc.streamTransfer).toHaveBeenCalledWith(mocks.syncSource);
      expect(mocks.dataTransferStore.exportData).not.toHaveBeenCalled();
    });

    it('does not stream anything when the host declines', async () => {
      vi.mocked(window.confirm).mockReturnValue(false);
      const w = await mountView();
      const svc = await startHost(w);

      svc.onStatus('auth-ok');
      await flushPromises();

      expect(svc.streamTransfer).not.toHaveBeenCalled();
      expect(p2pCard(w).text()).toContain("Transfert annulé par l'hôte");
    });

    it('shows the sending progress', async () => {
      const w = await mountView();
      const svc = await startHost(w);

      svc.onStatus('transfer-progress', { transferredBytes: 1 * MO, totalBytes: 2 * MO });
      await flushPromises();

      expect(progress(w).text()).toBe('Envoi des données… 50 % (1 Mo / 2 Mo)');
      expect(progress(w).get('progress').attributes('value')).toBe('50');
    });

    it('keeps the session and "Transfert refusé par l\'appareil distant" after the client leaves', async () => {
      const w = await mountView();
      const svc = await startHost(w);

      svc.onStatus('client-connected');
      svc.onStatus('transfer-pending', { totalBytes: 2 * MO });
      svc.onStatus('transfer-cancelled');
      svc.onStatus('client-disconnected');
      await flushPromises();

      expect(p2pCard(w).text()).toContain("Transfert refusé par l'appareil distant");
      expect(p2pCard(w).text()).not.toContain('Appareil déconnecté');
      expect(hasHostSession(w)).toBe(true);
      expect(svc.stopHosting).not.toHaveBeenCalled();
    });

    it.each([
      ['interrupted', "Transfert interrompu — aucune donnée n'a été modifiée"],
      ['timeout', 'aucune réponse depuis 60 s'],
      ['corrupted', 'Transfert interrompu — données corrompues'],
    ])('keeps the session and the %s outcome after the client leaves', async (reason, text) => {
      const w = await mountView();
      const svc = await startHost(w);

      svc.onStatus('client-connected');
      svc.onStatus('transfer-progress', { transferredBytes: 1 * MO, totalBytes: 2 * MO });
      svc.onStatus('transfer-error', { reason });
      svc.onStatus('client-disconnected');
      await flushPromises();

      expect(p2pCard(w).text()).toContain(text);
      expect(progress(w).exists()).toBe(false);
      expect(hasHostSession(w)).toBe(true);
    });

    it('reports a later client leaving normally once a new attempt started', async () => {
      const w = await mountView();
      const svc = await startHost(w);

      svc.onStatus('client-connected');
      svc.onStatus('transfer-cancelled');
      svc.onStatus('client-disconnected');
      svc.onStatus('client-connected');
      svc.onStatus('client-disconnected');
      await flushPromises();

      expect(p2pCard(w).text()).toContain(
        "Appareil déconnecté — en attente d'une nouvelle connexion"
      );
      expect(hasHostSession(w)).toBe(true);
    });

    it('ends the session when the client leaves after a completed stream', async () => {
      const w = await mountView();
      const svc = await startHost(w);

      svc.onStatus('transfer-progress', { transferredBytes: 2 * MO, totalBytes: 2 * MO });
      svc.onStatus('transfer-complete');
      await flushPromises();

      expect(p2pCard(w).text()).toContain('Données envoyées — session de synchronisation terminée');
      expect(progress(w).exists()).toBe(false);
      expect(w.find('.peer-session-info').exists()).toBe(false);
      expect(w.find('[data-testid="p2p-qr-code"]').exists()).toBe(false);
    });
  });

  describe('client side — consent on the manifest', () => {
    it('shows the announced size and number of documents before any bulk transfer', async () => {
      const w = await mountView();
      const svc = await startClient(w);

      const ok = await svc.onManifest(manifest(612 * MO));

      expect(ok).toBe(true);
      expect(window.confirm).toHaveBeenCalledWith(
        'Recevoir des données depuis un autre appareil va remplacer vos données locales (≈ 612 Mo, 900 document(s)). Continuer ?'
      );
    });

    it('refuses with a clear message when the storage quota is insufficient', async () => {
      const persist = vi.fn(async () => true);
      stubStorage({ estimate: vi.fn(async () => ({ quota: 700 * MO, usage: 200 * MO })), persist });
      const w = await mountView();
      const svc = await startClient(w);

      const ok = await svc.onManifest(manifest(612 * MO));
      await flushPromises();

      expect(ok).toBe(false);
      expect(window.confirm).not.toHaveBeenCalled();
      expect(persist).not.toHaveBeenCalled();
      expect(p2pCard(w).text()).toContain(
        'Espace de stockage insuffisant sur cet appareil pour recevoir 612 Mo'
      );
    });

    it('asks for persistent storage when the quota is enough', async () => {
      const persist = vi.fn(async () => true);
      stubStorage({ estimate: vi.fn(async () => ({ quota: 10_000 * MO, usage: 0 })), persist });
      const w = await mountView();
      const svc = await startClient(w);

      expect(await svc.onManifest(manifest(612 * MO))).toBe(true);
      expect(window.confirm).toHaveBeenCalled();
      expect(persist).toHaveBeenCalled();
    });

    it('skips the quota check when storage.estimate is unavailable', async () => {
      const w = await mountView();
      const svc = await startClient(w);

      expect(await svc.onManifest(manifest(612 * MO))).toBe(true);
      expect(window.confirm).toHaveBeenCalled();
    });

    it('cancels when the user declines the replacement', async () => {
      vi.mocked(window.confirm).mockReturnValue(false);
      const w = await mountView();
      const svc = await startClient(w);

      expect(await svc.onManifest(manifest(612 * MO))).toBe(false);
      svc.onStatus('transfer-cancelled');
      svc.onStatus('stopped');
      await flushPromises();

      expect(p2pCard(w).text()).toContain('Import annulé');
      expect(mocks.dataTransferStore.importFromObject).not.toHaveBeenCalled();
    });
  });

  describe('client side — transfer and import', () => {
    it('shows the receiving progress', async () => {
      const w = await mountView();
      const svc = await startClient(w);
      await svc.onManifest(manifest(612 * MO));

      svc.onStatus('transfer-progress', { transferredBytes: 276 * MO, totalBytes: 612 * MO });
      await flushPromises();

      expect(progress(w).text()).toBe('Réception des données… 45 % (276 Mo / 612 Mo)');
    });

    it('imports the received data through importFromObject, then reports success', async () => {
      const w = await mountView();
      const svc = await startClient(w);
      const payload = { properties: [], tenants: [], version: '1.2.0' };

      await svc.onData(payload);
      await flushPromises();

      expect(mocks.dataTransferStore.importFromObject).toHaveBeenCalledWith(payload);
      expect(window.alert).toHaveBeenCalledWith('Données synchronisées avec succès !');
      expect(svc.disconnect).toHaveBeenCalled();
      expect(p2pCard(w).text()).toContain('Synchronisation terminée');
      expect(pinInput(w).element.value).toBe('');
    });

    it('reports an import failure without claiming success', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mocks.dataTransferStore.importFromObject.mockRejectedValueOnce(new Error('invalide'));
      const w = await mountView();
      const svc = await startClient(w);

      await svc.onData({ properties: [], tenants: [], version: '1.2.0' });
      await flushPromises();

      expect(window.alert).toHaveBeenCalledWith('Erreur lors de la réception des données');
      expect(window.alert).not.toHaveBeenCalledWith('Données synchronisées avec succès !');
      expect(p2pCard(w).text()).toContain("aucune donnée n'a été modifiée");
    });

    it.each([
      ['corrupted', 'Transfert interrompu — données corrompues'],
      ['interrupted', "Transfert interrompu — aucune donnée n'a été modifiée"],
      ['timeout', 'aucune réponse depuis 60 s'],
    ])('shows the %s error status, kept after the connection closes', async (reason, text) => {
      const w = await mountView();
      const svc = await startClient(w);
      await svc.onManifest(manifest(10 * MO));
      svc.onStatus('transfer-progress', { transferredBytes: 1 * MO, totalBytes: 10 * MO });

      svc.onStatus('transfer-error', { reason });
      svc.onStatus('stopped');
      await flushPromises();

      expect(p2pCard(w).text()).toContain(text);
      expect(progress(w).exists()).toBe(false);
    });

    it('shows the incompatible protocol version status', async () => {
      const w = await mountView();
      const svc = await startClient(w);

      svc.onStatus('protocol-mismatch', { local: 2, remote: 1 });
      svc.onStatus('stopped');
      await flushPromises();

      expect(p2pCard(w).text()).toContain(
        'Version de synchronisation incompatible — mettez à jour les deux appareils'
      );
    });
  });
});
