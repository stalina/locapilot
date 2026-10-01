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

  class MockPeerSyncService {
    static instances: MockPeerSyncService[] = [];
    onStatus: StatusCb;
    startHosting = vi.fn(async (id: string) => {
      this.onStatus('hosting', id);
    });
    stopHosting = vi.fn();
    connect = vi.fn(async () => {});
    disconnect = vi.fn();
    sendExport = vi.fn();
    constructor(_onData: unknown, onStatus: StatusCb) {
      this.onStatus = onStatus;
      MockPeerSyncService.instances.push(this);
    }
  }

  return {
    route,
    MockPeerSyncService,
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
  useDataTransferStore: () => ({
    isExporting: false,
    isImporting: false,
    exportData: vi.fn(async () => ({ json: '{}' })),
    importFromObject: vi.fn(async () => {}),
  }),
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
const lastPeerService = () => {
  const { instances } = mocks.MockPeerSyncService;
  const instance = instances[instances.length - 1];
  if (!instance) throw new Error('no PeerSyncService instance');
  return instance;
};

describe('SettingsView — P2P pairing QR code (#118)', () => {
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
