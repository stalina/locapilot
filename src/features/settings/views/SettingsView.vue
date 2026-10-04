<script setup lang="ts">
import { ref, onMounted, unref, watch, onBeforeUnmount, computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '@/shared/components/Button.vue';
import { useSettingsStore } from '../stores/settingsStore';
import { useDataTransferStore } from '../stores/dataTransferStore';
import PeerSyncService, {
  generateSessionId,
  generatePin,
  normalizeSessionId,
  SESSION_ID_PREFIX,
  type PeerStatus,
  type ReceivedSyncPayload,
  type TransferManifest,
} from '../services/peerSyncService';
import {
  buildPairingUrl,
  generatePairingQrDataUrl,
  parsePairingFragment,
} from '../services/pairingLinkService';
// Version injected by Vite `define`; typed via the ImportMeta augmentation in
// src/vite-env.d.ts, so no `@ts-ignore`/`as any` is needed.
const rawAppVersion = import.meta.__APP_VERSION__ || '0.0.1';

const router = useRouter();
const route = useRoute();

// PWA Status
const isPWAInstalled = ref(false);
const canInstall = ref(false);
let deferredPrompt: any = null;

// Export/Import
const dataTransferStore = useDataTransferStore();
const isExporting = computed(() => dataTransferStore.isExporting);
const isImporting = computed(() => dataTransferStore.isImporting);

// PeerJS sync
const isHosting = ref(false);
const hostId = ref<string | null>(null);
const generatedPin = ref('');
const peerStatus = ref('');
const connectId = ref('');
const pairingPin = ref('');
let peerService: PeerSyncService | null = null;
const p2pCard = ref<HTMLElement | null>(null);

// Streamed P2P transfer (issue #122): progress of the document bytes and a
// terminal outcome message that a later `stopped` status must not overwrite.
type TransferDirection = 'send' | 'receive';
const transferProgress = ref<{
  direction: TransferDirection;
  transferredBytes: number;
  totalBytes: number;
} | null>(null);
let transferOutcomeShown = false;

const TRANSFER_CORRUPTED_STATUS = 'Transfert interrompu — données corrompues';
const TRANSFER_INTERRUPTED_STATUS = "Transfert interrompu — aucune donnée n'a été modifiée";
const TRANSFER_TIMEOUT_STATUS =
  "Transfert interrompu (aucune réponse depuis 60 s) — aucune donnée n'a été modifiée. Relancez la synchronisation.";
const TRANSFER_REFUSED_STATUS = "Transfert refusé par l'appareil distant";
const PROTOCOL_MISMATCH_STATUS =
  'Version de synchronisation incompatible — mettez à jour les deux appareils';
const SYNC_SUCCESS_MESSAGE = 'Données synchronisées avec succès !';
const HOST_SESSION_COMPLETE_STATUS = 'Données envoyées — session de synchronisation terminée';

/** Bytes → "Mo" for display (e.g. 612, 3,5, 0). */
const formatMegabytes = (bytes: number): string => {
  const mb = bytes / (1024 * 1024);
  return mb.toLocaleString('fr-FR', { maximumFractionDigits: mb < 10 ? 1 : 0 });
};

const transferPercent = computed(() => {
  const p = transferProgress.value;
  if (!p) return 0;
  if (p.totalBytes <= 0) return 100;
  return Math.min(100, Math.floor((p.transferredBytes / p.totalBytes) * 100));
});

const transferProgressLabel = computed(() => {
  const p = transferProgress.value;
  if (!p) return '';
  const action = p.direction === 'send' ? 'Envoi des données…' : 'Réception des données…';
  return `${action} ${transferPercent.value} % (${formatMegabytes(p.transferredBytes)} Mo / ${formatMegabytes(p.totalBytes)} Mo)`;
});

const readProgress = (info: unknown) => {
  if (typeof info !== 'object' || info === null) return null;
  const transferredBytes = 'transferredBytes' in info ? Number(info.transferredBytes) : NaN;
  const totalBytes = 'totalBytes' in info ? Number(info.totalBytes) : NaN;
  if (!Number.isFinite(transferredBytes) || !Number.isFinite(totalBytes)) return null;
  return { transferredBytes, totalBytes };
};

const transferErrorStatus = (info: unknown): string => {
  const reason = typeof info === 'object' && info !== null && 'reason' in info ? info.reason : '';
  if (reason === 'corrupted') return TRANSFER_CORRUPTED_STATUS;
  if (reason === 'timeout') return TRANSFER_TIMEOUT_STATUS;
  return TRANSFER_INTERRUPTED_STATUS;
};

/**
 * Show a final transfer message. It is not replaced by the teardown that
 * follows: `client-disconnected` on the host, `stopped` on the client.
 */
const showTransferOutcome = (message: string) => {
  peerStatus.value = message;
  transferProgress.value = null;
  transferOutcomeShown = true;
};

/**
 * Handle the statuses shared by host and client for the streamed transfer.
 * Returns true when the status was handled.
 */
const handleTransferStatus = (
  status: PeerStatus,
  info: unknown,
  direction: TransferDirection
): boolean => {
  switch (status) {
    case 'transfer-progress': {
      const progress = readProgress(info);
      if (progress) transferProgress.value = { direction, ...progress };
      peerStatus.value = 'Synchronisation en cours — gardez cette page ouverte';
      return true;
    }
    case 'transfer-error':
      showTransferOutcome(transferErrorStatus(info));
      return true;
    case 'protocol-mismatch':
      showTransferOutcome(PROTOCOL_MISMATCH_STATUS);
      return true;
    default:
      return false;
  }
};

/**
 * Client consent on the manifest, BEFORE any bulk data is transferred: storage
 * quota check, then confirmation with the announced size.
 */
const confirmIncomingTransfer = async (manifest: TransferManifest): Promise<boolean> => {
  const sizeMo = formatMegabytes(manifest.totalBytes);
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;

  if (storage && typeof storage.estimate === 'function') {
    try {
      const { quota, usage } = await storage.estimate();
      if (typeof quota === 'number' && quota - (usage ?? 0) < manifest.totalBytes) {
        showTransferOutcome(
          `Espace de stockage insuffisant sur cet appareil pour recevoir ${sizeMo} Mo`
        );
        return false;
      }
    } catch (e) {
      console.warn('storage.estimate failed', e);
    }
  }

  const ok = confirm(
    `Recevoir des données depuis un autre appareil va remplacer vos données locales (≈ ${sizeMo} Mo, ${manifest.documents} document(s)). Continuer ?`
  );
  if (!ok) {
    showTransferOutcome('Import annulé');
    return false;
  }

  if (storage && typeof storage.persist === 'function') {
    try {
      await storage.persist();
    } catch (e) {
      console.warn('storage.persist failed', e);
    }
  }
  transferProgress.value = {
    direction: 'receive',
    transferredBytes: 0,
    totalBytes: manifest.totalBytes,
  };
  return true;
};

/** Client: import the reassembled data through the single validated path. */
const importReceivedData = async (payload: ReceivedSyncPayload) => {
  try {
    peerStatus.value = 'Import des données…';
    await dataTransferStore.importFromObject(payload);
    await settingsStore.loadSettings();
    await reloadSenderInfo();
    showTransferOutcome('Synchronisation terminée');
    alert(SYNC_SUCCESS_MESSAGE);
    pairingPin.value = '';
  } catch (err) {
    console.error('Failed to process incoming data', err);
    showTransferOutcome("Erreur lors de la réception des données — aucune donnée n'a été modifiée");
    alert('Erreur lors de la réception des données');
  } finally {
    try {
      peerService?.disconnect();
    } catch (e) {
      console.warn('disconnect failed', e);
    }
  }
};

// Pairing QR code (issue #118): generated locally while hosting. It encodes the
// pairing link `<origin><BASE_URL>#p2p=<id>&pin=<pin>`, i.e. exactly the session
// id + PIN already displayed in plain text, credentials in the fragment only.
const qrDataUrl = ref<string | null>(null);

// Single source of truth: every path that clears hostId/generatedPin (Arrêter,
// `stopped`, `locked-out`, startHosting failure) clears the QR code through this
// watcher, before the next render.
watch([hostId, generatedPin], async ([id, pin]) => {
  qrDataUrl.value = null;
  if (!id || !pin) return;
  try {
    const appRootUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    const dataUrl = await generatePairingQrDataUrl(buildPairingUrl(id, pin, appRootUrl));
    // Drop a stale result: hosting stopped, failed or restarted while rendering.
    if (hostId.value === id && generatedPin.value === pin) {
      qrDataUrl.value = dataUrl;
    }
  } catch (e) {
    // Non-blocking: the session id and PIN stay usable for manual entry.
    console.warn('Pairing QR code generation failed', e);
  }
});

const PAIRING_LINK_READY_STATUS =
  "Session de synchronisation détectée — vérifiez qu'elle provient de votre appareil puis cliquez sur « Se connecter »";
const PAIRING_LINK_PIN_MISSING_STATUS =
  "Session de synchronisation détectée — saisissez le code PIN fourni par l'hôte puis cliquez sur « Se connecter »";
const PAIRING_LINK_INVALID_STATUS = 'Lien de synchronisation invalide';

/**
 * Read a pairing link fragment (`#p2p=…&pin=…`) opened on this device: only
 * pre-fill the client fields (never connect automatically, never persist the
 * PIN), then strip the fragment from the address bar and the current history
 * entry so a reload, back or bookmark cannot replay it.
 */
const consumePairingFragment = (hash: string) => {
  const link = parsePairingFragment(hash);
  if (link.status === 'none') return;

  if (link.status === 'invalid') {
    peerStatus.value = PAIRING_LINK_INVALID_STATUS;
  } else {
    connectId.value = link.sessionId;
    pairingPin.value = link.pin ?? '';
    peerStatus.value = link.pin ? PAIRING_LINK_READY_STATUS : PAIRING_LINK_PIN_MISSING_STATUS;
  }

  void router.replace({ name: 'settings', hash: '' });
  void nextTick(() => {
    p2pCard.value?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  });
};

onMounted(() => consumePairingFragment(route.hash));
watch(() => route.hash, consumePairingFragment);

onMounted(() => {
  // Check if running as installed PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    isPWAInstalled.value = true;
  }

  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    canInstall.value = true;
  });

  // Check if already installed
  window.addEventListener('appinstalled', () => {
    isPWAInstalled.value = true;
    canInstall.value = false;
  });
});

const handleInstallPWA = async () => {
  if (!deferredPrompt) return;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    console.log('PWA installed');
  }

  deferredPrompt = null;
  canInstall.value = false;
};

const handleExportData = async () => {
  try {
    const { json } = await dataTransferStore.exportData(rawAppVersion);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `locapilot-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Données exportées avec succès !');
  } catch (error) {
    console.error('Export error:', error);
    alert("Erreur lors de l'export des données");
  }
};

// Session id and PIN are generated with crypto.getRandomValues via the service
// (generateSessionId / generatePin) — no timestamp, no Math.random.

// The view drives at most one Peer at a time (host or client): release the
// current one before starting another, so no Peer keeps listening unseen.
const releasePeerService = () => {
  const previous = peerService;
  peerService = null;
  try {
    previous?.disconnect();
  } catch (e) {
    console.warn('peer release failed', e);
  }
};

const clearHostSession = () => {
  isHosting.value = false;
  hostId.value = null;
  generatedPin.value = '';
};

const startHosting = async () => {
  if (isHosting.value) return;
  releasePeerService();
  isHosting.value = true;
  peerStatus.value = 'Creating peer...';
  generatedPin.value = generatePin();
  transferOutcomeShown = false;
  transferProgress.value = null;

  // Create service with handlers
  peerService = new PeerSyncService(
    async () => {
      // Host does not receive data payloads in the normal flow.
    },
    (status: PeerStatus, info?: unknown) => {
      if (status === 'stopped') {
        // Explicit stop ("Arrêter" or release): the Peer is destroyed.
        transferProgress.value = null;
        clearHostSession();
        return;
      }
      if (handleTransferStatus(status, info, 'send')) return;
      if (status === 'client-disconnected') {
        // A device leaving (also after a refused or interrupted transfer) does
        // not end the hosting session. A transfer outcome stays visible.
        transferProgress.value = null;
        if (transferOutcomeShown) {
          transferOutcomeShown = false;
        } else {
          peerStatus.value = "Appareil déconnecté — en attente d'une nouvelle connexion";
        }
        return;
      }
      peerStatus.value = String(status) + (typeof info === 'string' ? ` - ${info}` : '');
      if (status === 'transfer-pending') {
        peerStatus.value = "En attente de la confirmation de l'appareil distant…";
      }
      if (status === 'transfer-cancelled') {
        showTransferOutcome(TRANSFER_REFUSED_STATUS);
      }
      if (status === 'hosting') {
        hostId.value = typeof info === 'string' ? info : '';
        isHosting.value = true;
      }
      if (status === 'locked-out') {
        // Brute-force protection: the host peer is destroyed after too many wrong
        // PINs. Surface the throttling so the human confirm() is not the sole barrier.
        const retryAfterMs =
          typeof info === 'object' && info !== null && 'retryAfterMs' in info
            ? Number((info as { retryAfterMs?: unknown }).retryAfterMs)
            : 0;
        const seconds = Math.ceil((Number.isFinite(retryAfterMs) ? retryAfterMs : 0) / 1000);
        peerStatus.value = `Session verrouillée — trop de tentatives de PIN. Réessayez dans ${seconds}s.`;
        clearHostSession();
        peerService = null;
      }
      if (status === 'auth-ok') {
        // Client authenticated — ask user before sending data
        (async () => {
          try {
            const ok = confirm(
              "Un appareil vient de s'authentifier et souhaite recevoir vos données. Envoyer la synchronisation ?"
            );
            if (!ok) {
              peerStatus.value = "Transfert annulé par l'hôte";
              return;
            }
            peerStatus.value = 'Préparation des données…';
            // Streamed transfer (issue #122): raw tables + Blobs, never one JSON.
            const source = await dataTransferStore.buildSyncSource(rawAppVersion);
            await peerService?.streamTransfer(source);
          } catch (e) {
            console.error('Failed to send export from host', e);
            peerStatus.value = "Échec de l'envoi";
          }
        })();
      }
      // A device leaving (or rejected for a wrong PIN) does not end the hosting
      // session: the Peer still listens, so the session ID, PIN, QR code and
      // "Arrêter" stay displayed until stopped, locked out or transfer complete.
      if (status === 'auth-failed') {
        peerStatus.value = 'Connexion rejetée — PIN incorrect';
      }
      if (status === 'client-connected') {
        // A new attempt: the previous outcome no longer needs protecting.
        transferOutcomeShown = false;
      }
      if (status === 'transfer-complete') {
        // The client acknowledged the end of the stream, then disconnected: the
        // session is single-use and ends here (Peer destroyed by the service).
        showTransferOutcome(HOST_SESSION_COMPLETE_STATUS);
        clearHostSession();
        peerService = null;
      }
    }
  );

  try {
    const id = generateSessionId();
    await peerService.startHosting(id, generatedPin.value);
  } catch (e) {
    console.error('startHosting error', e);
    peerStatus.value = 'Failed to host';
    isHosting.value = false;
    generatedPin.value = '';
  }
};

const stopHosting = () => {
  try {
    peerService?.stopHosting();
  } catch (e) {
    console.warn('stopHosting failed', e);
  }
  peerService = null;
  clearHostSession();
  peerStatus.value = '';
  transferProgress.value = null;
};

const connectToHost = async () => {
  if (!connectId.value) return alert('Entrez un ID de session');
  if (!pairingPin.value) return alert("Entrez le code PIN fourni par l'hôte");

  // Normalise the typed id (uppercase, strip spaces/dashes) then sanity-check
  // the short crypto-random format `<prefix><chars>` (no version, no timestamp).
  const normalizedId = normalizeSessionId(connectId.value);
  if (
    !normalizedId.startsWith(SESSION_ID_PREFIX) ||
    normalizedId.length <= SESSION_ID_PREFIX.length
  ) {
    return alert('ID de session invalide');
  }

  releasePeerService();
  try {
    peerStatus.value = 'Connexion en cours...';
    transferOutcomeShown = false;
    transferProgress.value = null;

    peerService = new PeerSyncService(
      importReceivedData,
      (status: PeerStatus, info?: unknown) => {
        if (status === 'stopped') {
          // Local teardown after a sync, a rejected PIN or a release: keep the
          // last meaningful status instead of replacing it with "stopped".
          transferProgress.value = null;
          peerService = null;
          return;
        }
        if (handleTransferStatus(status, info, 'receive')) return;
        if (status === 'transfer-cancelled' || status === 'importing') {
          // Message already set by the consent prompt / the import handler.
          return;
        }
        peerStatus.value = String(status) + (typeof info === 'string' ? ` - ${info}` : '');
        if (status === 'auth-pending') {
          peerStatus.value = 'Authentification en cours...';
        }
        if (status === 'auth-ok') {
          peerStatus.value = 'Authentifié — en attente des données...';
        }
        if (status === 'auth-failed') {
          peerStatus.value = 'Authentification échouée — PIN incorrect';
          pairingPin.value = '';
        }
        if (status === 'error') {
          console.error('Peer error', info);
        }
      },
      confirmIncomingTransfer
    );

    await peerService.connect(normalizedId, pairingPin.value);
  } catch (e) {
    console.error('connectToHost error', e);
    peerStatus.value = 'Échec de la connexion';
  }
};

const handleImportData = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate data structure
      if (!data.properties || !data.tenants || !data.version) {
        throw new Error('Format de fichier invalide');
      }

      // Confirm before importing
      if (!confirm('Cette action va remplacer toutes vos données actuelles. Continuer ?')) {
        return;
      }

      await dataTransferStore.importFromObject(data);

      alert('Données importées avec succès !');
      router.push('/');
    } catch (error) {
      console.error('Import error:', error);
      alert("Erreur lors de l'import des données: " + (error as Error).message);
    }
  };

  input.click();
};

const handleClearData = async () => {
  if (
    !confirm(
      '⚠️ Cette action va supprimer TOUTES vos données de façon irréversible. Êtes-vous sûr ?'
    )
  ) {
    return;
  }

  if (
    !confirm(
      'Dernière confirmation : toutes les propriétés, locataires, baux et documents seront supprimés.'
    )
  ) {
    return;
  }

  try {
    await dataTransferStore.clearAllBusinessData();

    alert('Toutes les données ont été supprimées');
    router.push('/');
  } catch (error) {
    console.error('Clear data error:', error);
    alert('Erreur lors de la suppression des données');
  }
};

onBeforeUnmount(() => {
  try {
    peerService?.stopHosting();
  } catch (e) {
    /* ignore */
  }
  try {
    peerService?.disconnect();
  } catch (e) {
    /* ignore */
  }
});

const goBack = () => {
  router.push('/');
};

// Settings store for editable default message
const settingsStore = useSettingsStore();
const editingDefaultMsg = ref<string>('');

onMounted(async () => {
  await settingsStore.loadSettings();
  // Use the store-computed string value to avoid pinia ref unwrapping issues
  editingDefaultMsg.value = (unref(settingsStore.currentDefaultRejectionMessage) as any) || '';
});

const saveDefaultRejectionMessage = async () => {
  try {
    console.log('[SettingsView] saving defaultRejectionMessage:', editingDefaultMsg.value);
    await settingsStore.updateDefaultRejectionMessage(editingDefaultMsg.value);
    alert('Message de refus par défaut enregistré');
  } catch (err) {
    console.error('Failed to save default message:', err);
    alert("Erreur lors de l'enregistrement du message");
  }
};

// Sender address editing
const editingSenderAddress = ref<string>('');
const editingSenderName = ref<string>('');
const editingSenderPhone = ref<string>('');
const editingSenderEmail = ref<string>('');

const reloadSenderInfo = async () => {
  try {
    const info = await settingsStore.fetchSenderInfo();
    editingSenderAddress.value = String(info.senderAddress || '');
    editingSenderName.value = String(info.senderName || '');
    editingSenderPhone.value = String(info.senderPhone || '');
    editingSenderEmail.value = String(info.senderEmail || '');
  } catch {
    editingSenderAddress.value = '';
    editingSenderName.value = '';
    editingSenderPhone.value = '';
    editingSenderEmail.value = '';
  }
};

onMounted(reloadSenderInfo);

const saveSenderAddress = async () => {
  try {
    await settingsStore.updateSenderAddress(editingSenderAddress.value);
    alert("Adresse d'expéditeur sauvegardée");
  } catch (e) {
    console.error('Failed to save sender address', e);
    alert('Erreur lors de la sauvegarde');
  }
};

const saveSenderName = async () => {
  try {
    await settingsStore.updateSenderName(editingSenderName.value);
    alert('Nom du propriétaire sauvegardé');
  } catch (e) {
    console.error('Failed to save sender name', e);
    alert('Erreur lors de la sauvegarde');
  }
};

const saveSenderPhone = async () => {
  try {
    await settingsStore.updateSenderPhone(editingSenderPhone.value);
    alert('Numéro de téléphone sauvegardé');
  } catch (e) {
    console.error('Failed to save sender phone', e);
    alert('Erreur lors de la sauvegarde');
  }
};

const saveSenderEmail = async () => {
  try {
    await settingsStore.updateSenderEmail(editingSenderEmail.value);
    alert('Adresse email sauvegardée');
  } catch (e) {
    console.error('Failed to save sender email', e);
    alert('Erreur lors de la sauvegarde');
  }
};

// Keep the editor in sync if the store value changes elsewhere
watch(
  () => unref(settingsStore.currentDefaultRejectionMessage),
  v => {
    editingDefaultMsg.value = (v as any) || '';
  }
);

// Reminder thresholds editing (issue #40)
const REMINDER_LEVEL_LABELS: Record<string, string> = {
  amiable: 'Relance amiable',
  recommandee: 'Relance recommandée',
  'mise-en-demeure': 'Mise en demeure',
};
const editingReminderThresholds = ref(settingsStore.reminderThresholds.map(t => ({ ...t })));

// Keep the editing form in sync with the store, including after the async
// loadSettings() resolves (which runs in a separate onMounted hook).
watch(
  () => settingsStore.reminderThresholds,
  value => {
    editingReminderThresholds.value = value.map(t => ({ ...t }));
  },
  { immediate: true, deep: true }
);

const saveReminderThresholds = async () => {
  try {
    await settingsStore.updateReminderThresholds(
      editingReminderThresholds.value.map(t => ({ ...t }))
    );
    alert('Configuration des relances enregistrée');
  } catch (e) {
    console.error('Failed to save reminder thresholds', e);
    alert('Erreur lors de la sauvegarde');
  }
};
</script>

<template>
  <div class="view-container settings-view">
    <!-- Header -->
    <header class="view-header">
      <div>
        <h1>Paramètres</h1>
        <div class="header-meta">Configuration de l'application</div>
      </div>
      <div class="header-actions">
        <Button variant="outline" icon="arrow-left" @click="goBack"> Retour </Button>
      </div>
    </header>

    <div class="settings-content">
      <!-- PWA Section -->
      <section class="settings-section">
        <h2>
          <i class="mdi mdi-application"></i>
          Application Progressive (PWA)
        </h2>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Installation</h3>
            <p v-if="isPWAInstalled" class="status-text success">✓ Application installée</p>
            <p v-else-if="canInstall" class="status-text info">Installation disponible</p>
            <p v-else class="status-text">
              Ouvrez l'application dans un navigateur compatible pour l'installer
            </p>
          </div>
          <Button v-if="canInstall" @click="handleInstallPWA" variant="primary" icon="download">
            Installer l'app
          </Button>
        </div>

        <div class="setting-card">
          <!-- (removed - communications moved into dedicated Communications section below) -->

          <div class="setting-info">
            <h3>Mode hors ligne</h3>
            <p>L'application fonctionne entièrement hors ligne grâce au stockage local</p>
          </div>
          <span class="badge success">Activé</span>
        </div>
      </section>

      <!-- Communications -->
      <section class="settings-section">
        <h2>
          <i class="mdi mdi-email"></i>
          Communications
        </h2>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Nom du propriétaire</h3>
            <p>Éditez le nom du propriétaire utilisé pour les communications</p>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
            <input
              v-model="editingSenderName"
              type="text"
              placeholder="Ex: Jean Dupont"
              style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px"
            />
            <div style="display: flex; gap: 8px; justify-content: flex-end">
              <Button @click="saveSenderName" variant="primary">Enregistrer</Button>
            </div>
          </div>
        </div>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Numéro de téléphone</h3>
            <p>Éditez le numéro de téléphone utilisé pour les communications</p>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
            <input
              v-model="editingSenderPhone"
              type="tel"
              placeholder="Ex: 06 12 34 56 78"
              style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px"
            />
            <div style="display: flex; gap: 8px; justify-content: flex-end">
              <Button @click="saveSenderPhone" variant="primary">Enregistrer</Button>
            </div>
          </div>
        </div>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Adresse email</h3>
            <p>Éditez l'adresse email utilisée pour les communications</p>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
            <input
              v-model="editingSenderEmail"
              type="email"
              placeholder="Ex: contact@exemple.fr"
              style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px"
            />
            <div style="display: flex; gap: 8px; justify-content: flex-end">
              <Button @click="saveSenderEmail" variant="primary">Enregistrer</Button>
            </div>
          </div>
        </div>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Adresse d'expéditeur</h3>
            <p>Éditez l'adresse d'expéditeur utilisée pour les communications</p>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
            <textarea
              v-model="editingSenderAddress"
              rows="5"
              style="width: 100%; resize: vertical"
            ></textarea>
            <div style="display: flex; gap: 8px; justify-content: flex-end">
              <Button @click="saveSenderAddress" variant="primary">Enregistrer</Button>
            </div>
          </div>
        </div>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Message de refus par défaut</h3>
            <p>Éditez le message standard proposé lors du refus d'une candidature</p>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px">
            <textarea
              v-model="editingDefaultMsg"
              rows="6"
              style="width: 100%; resize: vertical"
            ></textarea>
            <div style="display: flex; gap: 8px; justify-content: flex-end">
              <Button @click="saveDefaultRejectionMessage" variant="primary">Enregistrer</Button>
            </div>
          </div>
        </div>
      </section>

      <!-- Relances des impayés -->
      <section class="settings-section">
        <h2>
          <i class="mdi mdi-bell-alert"></i>
          Relances des impayés
        </h2>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Échéancier de relance</h3>
            <p>
              Configurez le nombre de jours de retard déclenchant chaque niveau de relance, et
              activez ou désactivez chaque niveau.
            </p>
          </div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 12px">
            <div
              v-for="threshold in editingReminderThresholds"
              :key="threshold.level"
              style="display: flex; align-items: center; gap: 8px"
            >
              <label style="display: flex; align-items: center; gap: 6px">
                <input v-model="threshold.enabled" type="checkbox" />
                {{ REMINDER_LEVEL_LABELS[threshold.level] }}
              </label>
              <input
                v-model.number="threshold.days"
                type="number"
                min="1"
                style="width: 80px; padding: 8px; border: 1px solid #ccc; border-radius: 4px"
              />
              <span>jours de retard</span>
            </div>
            <div style="display: flex; gap: 8px; justify-content: flex-end">
              <Button @click="saveReminderThresholds" variant="primary">Enregistrer</Button>
            </div>
          </div>
        </div>
      </section>

      <!-- Data Management -->
      <section class="settings-section">
        <h2>
          <i class="mdi mdi-database"></i>
          Gestion des données
        </h2>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Exporter les données</h3>
            <p>Téléchargez toutes vos données au format JSON</p>
          </div>
          <Button
            @click="handleExportData"
            :disabled="isExporting"
            variant="secondary"
            icon="download"
          >
            {{ isExporting ? 'Export...' : 'Exporter' }}
          </Button>
        </div>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Importer les données</h3>
            <p>Restaurez vos données depuis un fichier JSON</p>
          </div>
          <Button
            @click="handleImportData"
            :disabled="isImporting"
            variant="secondary"
            icon="upload"
          >
            {{ isImporting ? 'Import...' : 'Importer' }}
          </Button>
        </div>

        <!-- Peer-to-peer Sync -->
        <div ref="p2pCard" class="setting-card" data-testid="p2p-sync-card">
          <div class="setting-info">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
              <h3 style="margin: 0">Synchronisation Peer-to-peer</h3>
              <span class="badge-experimental">Expérimental</span>
            </div>
            <p>
              Transférez vos données directement entre deux navigateurs. La connexion est chiffrée
              (AES-GCM) avec une clé de session propre à chaque appairage, dérivée du code PIN —
              elle ne dépend d'aucun secret intégré à l'application.
            </p>
            <p class="experimental-warning">
              ⚠️ Fonctionnalité expérimentale. Vérifiez toujours l'identité de l'appareil connecté
              avant d'accepter un transfert.
            </p>
            <p v-if="peerStatus" style="margin-top: 8px">
              Statut : <strong>{{ peerStatus }}</strong>
            </p>
            <div
              v-if="transferProgress"
              class="peer-transfer-progress"
              data-testid="p2p-transfer-progress"
            >
              <progress
                :value="transferPercent"
                max="100"
                :aria-label="transferProgressLabel"
              ></progress>
              <span>{{ transferProgressLabel }}</span>
            </div>
            <div v-if="hostId" class="peer-session-info">
              <p>
                ID de session : <code>{{ hostId }}</code>
              </p>
              <p>
                Code PIN : <strong class="peer-pin">{{ generatedPin }}</strong>
              </p>
              <p style="font-size: 0.8em; color: var(--text-tertiary)">
                Communiquez ce code PIN verbalement à l'autre appareil
              </p>
              <div v-if="qrDataUrl" class="peer-qr">
                <img
                  data-testid="p2p-qr-code"
                  :src="qrDataUrl"
                  alt="QR code de synchronisation"
                  width="220"
                  height="220"
                />
                <p class="peer-qr-hint">
                  Scannez ce QR code avec l'appareil photo de l'autre appareil
                </p>
              </div>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; min-width: 260px">
            <div style="display: flex; gap: 8px">
              <Button v-if="!isHosting" @click="startHosting" variant="secondary">Héberger</Button>
              <Button v-else @click="stopHosting" variant="outline">Arrêter</Button>
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px">
              <input
                v-model="connectId"
                placeholder="ID de session de l'hôte"
                style="padding: 8px; border-radius: 6px; border: 1px solid var(--border-color)"
              />
              <input
                v-model="pairingPin"
                placeholder="Code PIN (6 chiffres)"
                maxlength="6"
                style="padding: 8px; border-radius: 6px; border: 1px solid var(--border-color)"
              />
              <Button @click="connectToHost" variant="secondary">Se connecter</Button>
            </div>
          </div>
        </div>

        <div class="setting-card danger">
          <div class="setting-info">
            <h3>Effacer toutes les données</h3>
            <p>⚠️ Cette action est irréversible</p>
          </div>
          <Button @click="handleClearData" variant="danger" icon="delete"> Tout effacer </Button>
        </div>
      </section>

      <!-- About -->
      <section class="settings-section">
        <h2>
          <i class="mdi mdi-information"></i>
          À propos
        </h2>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Locapilot</h3>
            <p>Version 1.0.0</p>
            <p class="about-text">
              Application de gestion locative offline-first développée avec Vue 3, TypeScript et
              Dexie.js
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Styles spécifiques aux paramètres */
.settings-view {
  max-width: 900px;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.settings-section h2 {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-bottom: var(--space-3);
  border-bottom: 2px solid var(--border-color);
}

.settings-section h2 i {
  color: var(--primary-600);
}

.setting-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
}

.setting-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.setting-card.danger {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.02);
}

.setting-info {
  flex: 1;
}

.setting-info h3 {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-1) 0;
}

.setting-info p {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.status-text {
  font-weight: 500;
  margin-top: var(--space-2) !important;
}

.status-text.success {
  color: rgb(22, 163, 74);
}

.status-text.info {
  color: rgb(59, 130, 246);
}

.about-text {
  margin-top: var(--space-2) !important;
  line-height: 1.6;
}

.badge-experimental {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.7em;
  font-weight: 600;
  background: rgba(245, 158, 11, 0.15);
  color: rgb(180, 120, 0);
  border: 1px solid rgba(245, 158, 11, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.experimental-warning {
  margin-top: var(--space-2) !important;
  color: rgb(180, 120, 0) !important;
  font-size: 0.8em !important;
}

.peer-session-info {
  margin-top: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.peer-session-info p {
  margin: 0;
}

.peer-pin {
  font-size: 1.3em;
  letter-spacing: 0.15em;
  color: var(--primary-600);
  font-family: monospace;
}

.peer-transfer-progress {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
  margin-top: var(--spacing-2);
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.peer-transfer-progress progress {
  width: 100%;
  height: 8px;
  accent-color: var(--color-primary);
}

/* Uses the global design tokens (variables.css). */
.peer-qr {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.peer-qr img {
  width: 220px;
  max-width: 100%;
  height: auto;
  /* Keep the quiet zone white in dark mode so phone cameras can read it. */
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  image-rendering: pixelated;
}

.peer-qr .peer-qr-hint {
  font-size: 0.8em;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .settings-view {
    padding: var(--space-4);
  }

  .setting-card {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-card button {
    width: 100%;
  }
}
</style>
