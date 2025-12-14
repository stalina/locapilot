<script setup lang="ts">
import { ref, onMounted, unref, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { db } from '@/db/database';
import Button from '@/shared/components/Button.vue';
import { useSettingsStore } from '../stores/settingsStore';
import PeerSyncService from '../services/peerSyncService';
// Read version injected by Vite define into import.meta.env
// @ts-ignore - injected by Vite via `define`
const rawAppVersion = (import.meta as any).__APP_VERSION__ || '0.0.1';
// PeerJS ids can't contain dots, remove them for id portion
const appVersion = String(rawAppVersion).replace(/\./g, '');

const router = useRouter();

// PWA Status
const isPWAInstalled = ref(false);
const canInstall = ref(false);
let deferredPrompt: any = null;

// Export/Import
const isExporting = ref(false);
const isImporting = ref(false);

// PeerJS sync
const isHosting = ref(false);
const hostId = ref<string | null>(null);
const peerStatus = ref('');
const connectId = ref('');
let peerService: PeerSyncService | null = null;

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
  isExporting.value = true;
  try {
    const { json } = await buildExportPayload();

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
  } finally {
    isExporting.value = false;
  }
};

// Build export JSON payload for reuse (returns string JSON and parsed data)
const buildExportPayload = async () => {
  const documentsRaw = await db.documents.toArray();
  const documents: any[] = await Promise.all(
    documentsRaw.map(async d => {
      const copy: any = { ...d };
      try {
        if (d.data instanceof Blob) {
          const text = await d.data.arrayBuffer();
          const uint8 = new Uint8Array(text);
          const b64 = btoa(String.fromCharCode(...uint8));
          copy.data = `data:${d.mimeType};base64,${b64}`;
        } else if (typeof d.data === 'string') {
          copy.data = d.data;
        } else {
          copy.data = null;
        }
      } catch (e) {
        copy.data = null;
      }
      return copy;
    })
  );

  const data = {
    properties: await db.properties.toArray(),
    tenants: await db.tenants.toArray(),
    leases: await db.leases.toArray(),
    rents: await db.rents.toArray(),
    documents,
    inventories: await db.inventories.toArray(),
    exportedAt: new Date().toISOString(),
    version: rawAppVersion,
  };

  const json = JSON.stringify(data, null, 2);
  return { json, data };
};

// Build PeerJS channel id: lcp-<version>-<hh-mm-sss>-<random3>
const buildPeerId = () => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const now = new Date();
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const rand = Math.floor(Math.random() * 900) + 100; // 100-999
  return `lcp-${appVersion}-${hh}-${mm}-${ss}-${rand}`;
};

const startHosting = async () => {
  if (isHosting.value) return;
  isHosting.value = true;
  peerStatus.value = 'Creating peer...';

  // Create service with handlers
  peerService = new PeerSyncService(
    async (data: any) => {
      // host shouldn't receive data in normal flow, but handle defensively
      console.log('Host received data:', data);
    },
    (status, info) => {
      peerStatus.value = String(status) + (info ? ` - ${info}` : '');
      if (status === 'hosting') {
        hostId.value = String(info || '');
        isHosting.value = true;
      }
      if (status === 'connection-open') {
        // a client connected and channel is open - send export
        (async () => {
          try {
            peerStatus.value = 'Connection open - sending export payload';
            const { json } = await buildExportPayload();
            peerService?.sendExport(json);
          } catch (e) {
            console.error('Failed to send export from host', e);
            peerStatus.value = 'Failed to send export';
          }
        })();
      }
      if (status === 'stopped') {
        isHosting.value = false;
        hostId.value = null;
      }
    }
  );

  try {
    const id = buildPeerId();
    await peerService.startHosting(id);
  } catch (e) {
    console.error('startHosting error', e);
    peerStatus.value = 'Failed to host';
    isHosting.value = false;
  }
};

const stopHosting = () => {
  try {
    peerService?.stopHosting();
  } catch (e) {
    console.warn('stopHosting failed', e);
  }
  peerService = null;
  isHosting.value = false;
  hostId.value = null;
  peerStatus.value = '';
};

const connectToHost = async () => {
  if (!connectId.value) return alert('Entrez un ID de session');

  // validate version in id: expect lcp-<version>-...
  const parts = connectId.value.split('-');
  if (parts.length < 3 || parts[0] !== 'lcp') {
    return alert('ID invalide');
  }
  const remoteVersion = parts[1];
  const localVersion = appVersion;
  if (remoteVersion !== localVersion) {
    return alert(
      `Version mismatch: remote=${remoteVersion} local=${localVersion}. Merci de mettre à jour l'application.`
    );
  }

  try {
    peerStatus.value = 'Connecting...';

    peerService = new PeerSyncService(
      async (data: any) => {
        if (!data || data.type !== 'export' || !data.payload) return;
        try {
          const parsed = JSON.parse(data.payload);
          // confirm with user
          const ok = confirm(
            'Recevoir des données depuis un autre appareil va remplacer vos données locales. Continuer ?'
          );
          if (!ok) {
            peerStatus.value = 'Import cancelled by user';
            return;
          }

          // perform import using existing logic
          await performImportFromObject(parsed);
          alert('Données synchronisées avec succès !');
          peerStatus.value = 'Import complete';
          // cleanup
          try {
            peerService?.disconnect();
          } catch (e) {
            console.warn('disconnect failed', e);
          }
        } catch (err) {
          console.error('Failed to process incoming data', err);
          alert('Erreur lors de la réception des données');
        }
      },
      (status, info) => {
        peerStatus.value = String(status) + (info ? ` - ${info}` : '');
        if (status === 'connection-open') {
          peerStatus.value = 'Connected - waiting for data';
        }
        if (status === 'error') {
          console.error('Peer error', info);
        }
        if (status === 'stopped') {
          peerService = null;
        }
      }
    );

    await peerService.connect(connectId.value);
  } catch (e) {
    console.error('connectToHost error', e);
    peerStatus.value = 'Failed to connect';
  }
};

// Reuse import logic but from an object (parsed JSON)
const performImportFromObject = async (data: any) => {
  // Basic validation
  if (!data.properties || !data.tenants) {
    throw new Error('Format de fichier invalide');
  }

  // Clear existing data
  await db.properties.clear();
  await db.tenants.clear();
  await db.leases.clear();
  await db.rents.clear();
  await db.documents.clear();
  await db.inventories.clear();

  if (data.properties.length) await db.properties.bulkAdd(data.properties);
  if (data.tenants.length) await db.tenants.bulkAdd(data.tenants);
  if (data.leases?.length) await db.leases.bulkAdd(data.leases);
  if (data.rents?.length) await db.rents.bulkAdd(data.rents);

  if (data.documents?.length) {
    const docsToAdd = data.documents.map((d: any) => {
      const copy = { ...d };
      try {
        if (typeof d.data === 'string' && d.data.startsWith('data:')) {
          const matches = d.data.match(/^data:(.+);base64,(.*)$/);
          if (matches) {
            const mime = matches[1];
            const b64 = matches[2];
            const binary = atob(b64);
            const len = binary.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
            copy.data = new Blob([bytes], { type: mime });
            copy.mimeType = mime;
            copy.size = bytes.length;
          } else {
            copy.data = null;
          }
        } else {
          copy.data = null;
        }
      } catch (e) {
        copy.data = null;
      }
      return copy;
    });

    await db.documents.bulkAdd(docsToAdd);
  }

  if (data.inventories?.length) await db.inventories.bulkAdd(data.inventories);
};

const handleImportData = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.onchange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    isImporting.value = true;
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

      // Clear existing data
      await db.properties.clear();
      await db.tenants.clear();
      await db.leases.clear();
      await db.rents.clear();
      await db.documents.clear();
      await db.inventories.clear();

      // Import new data
      if (data.properties.length) await db.properties.bulkAdd(data.properties);
      if (data.tenants.length) await db.tenants.bulkAdd(data.tenants);
      if (data.leases?.length) await db.leases.bulkAdd(data.leases);
      if (data.rents?.length) await db.rents.bulkAdd(data.rents);
      if (data.documents?.length) {
        // Rebuild Blobs for documents that have data URLs
        const docsToAdd = data.documents.map((d: any) => {
          const copy = { ...d };
          try {
            if (typeof d.data === 'string' && d.data.startsWith('data:')) {
              const matches = d.data.match(/^data:(.+);base64,(.*)$/);
              if (matches) {
                const mime = matches[1];
                const b64 = matches[2];
                const binary = atob(b64);
                const len = binary.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
                copy.data = new Blob([bytes], { type: mime });
                copy.mimeType = mime;
                copy.size = bytes.length;
              } else {
                copy.data = null;
              }
            } else {
              copy.data = null;
            }
          } catch (e) {
            copy.data = null;
          }
          return copy;
        });

        await db.documents.bulkAdd(docsToAdd);
      }

      // Import inventories after documents so referenced document IDs remain valid
      if (data.inventories?.length) await db.inventories.bulkAdd(data.inventories);

      alert('Données importées avec succès !');
      router.push('/');
    } catch (error) {
      console.error('Import error:', error);
      alert("Erreur lors de l'import des données: " + (error as Error).message);
    } finally {
      isImporting.value = false;
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
    await db.properties.clear();
    await db.tenants.clear();
    await db.leases.clear();
    await db.rents.clear();
    await db.documents.clear();
    await db.inventories.clear();

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

onMounted(async () => {
  try {
    const s = await db.settings.where('key').equals('senderAddress').first();
    editingSenderAddress.value = s && s.value ? String(s.value) : '';
  } catch (e) {
    editingSenderAddress.value = '';
  }

  try {
    const s = await db.settings.where('key').equals('senderName').first();
    editingSenderName.value = s && s.value ? String(s.value) : '';
  } catch (e) {
    editingSenderName.value = '';
  }
});

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

// Keep the editor in sync if the store value changes elsewhere
watch(
  () => unref(settingsStore.currentDefaultRejectionMessage),
  v => {
    editingDefaultMsg.value = (v as any) || '';
  }
);
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
        <div class="setting-card">
          <div class="setting-info">
            <h3>Synchronisation Peer-to-peer</h3>
            <p>Transférez vos données directement entre deux navigateurs via une connexion P2P.</p>
            <p style="margin-top: 8px">
              Status: <strong>{{ peerStatus }}</strong>
            </p>
            <p v-if="hostId">
              Share this ID to the other device: <code>{{ hostId }}</code>
            </p>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; min-width: 260px">
            <div style="display: flex; gap: 8px">
              <Button v-if="!isHosting" @click="startHosting" variant="secondary">Héberger</Button>
              <Button v-else @click="stopHosting" variant="outline">Arrêter</Button>
            </div>
            <div style="display: flex; gap: 8px">
              <input
                v-model="connectId"
                placeholder="Entrez l'ID d'hôte"
                style="
                  flex: 1;
                  padding: 8px;
                  border-radius: 6px;
                  border: 1px solid var(--color-border);
                "
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
  gap: var(--spacing-8);
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-4);
}

.settings-section h2 {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding-bottom: var(--spacing-3);
  border-bottom: 2px solid var(--color-border);
}

.settings-section h2 i {
  color: var(--color-primary);
}

.setting-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-4);
  padding: var(--spacing-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
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
  color: var(--color-text);
  margin: 0 0 var(--spacing-1) 0;
}

.setting-info p {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 0;
}

.status-text {
  font-weight: 500;
  margin-top: var(--spacing-2) !important;
}

.status-text.success {
  color: rgb(22, 163, 74);
}

.status-text.info {
  color: rgb(59, 130, 246);
}

.about-text {
  margin-top: var(--spacing-2) !important;
  line-height: 1.6;
}

@media (max-width: 768px) {
  .settings-view {
    padding: var(--spacing-4);
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
