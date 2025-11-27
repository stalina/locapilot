<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { db } from '@/db/database';
import Button from '@/shared/components/Button.vue';

const router = useRouter();

// PWA Status
const isPWAInstalled = ref(false);
const canInstall = ref(false);
let deferredPrompt: any = null;

// Export/Import
const isExporting = ref(false);
const isImporting = ref(false);

onMounted(() => {
  // Check if running as installed PWA
  if (window.matchMedia('(display-mode: standalone)').matches) {
    isPWAInstalled.value = true;
  }

  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
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
    // Export all data from IndexedDB
    const data = {
      properties: await db.properties.toArray(),
      tenants: await db.tenants.toArray(),
      leases: await db.leases.toArray(),
      rents: await db.rents.toArray(),
      documents: await db.documents.toArray(),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    const json = JSON.stringify(data, null, 2);
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
    alert('Erreur lors de l\'export des données');
  } finally {
    isExporting.value = false;
  }
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

      // Import new data
      if (data.properties.length) await db.properties.bulkAdd(data.properties);
      if (data.tenants.length) await db.tenants.bulkAdd(data.tenants);
      if (data.leases?.length) await db.leases.bulkAdd(data.leases);
      if (data.rents?.length) await db.rents.bulkAdd(data.rents);
      if (data.documents?.length) await db.documents.bulkAdd(data.documents);

      alert('Données importées avec succès !');
      router.push('/');
    } catch (error) {
      console.error('Import error:', error);
      alert('Erreur lors de l\'import des données: ' + (error as Error).message);
    } finally {
      isImporting.value = false;
    }
  };

  input.click();
};

const handleClearData = async () => {
  if (!confirm('⚠️ Cette action va supprimer TOUTES vos données de façon irréversible. Êtes-vous sûr ?')) {
    return;
  }

  if (!confirm('Dernière confirmation : toutes les propriétés, locataires, baux et documents seront supprimés.')) {
    return;
  }

  try {
    await db.properties.clear();
    await db.tenants.clear();
    await db.leases.clear();
    await db.rents.clear();
    await db.documents.clear();
    
    alert('Toutes les données ont été supprimées');
    router.push('/');
  } catch (error) {
    console.error('Clear data error:', error);
    alert('Erreur lors de la suppression des données');
  }
};

const goBack = () => {
  router.push('/');
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
        <Button variant="outline" icon="arrow-left" @click="goBack">
          Retour
        </Button>
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
            <p v-if="isPWAInstalled" class="status-text success">
              ✓ Application installée
            </p>
            <p v-else-if="canInstall" class="status-text info">
              Installation disponible
            </p>
            <p v-else class="status-text">
              Ouvrez l'application dans un navigateur compatible pour l'installer
            </p>
          </div>
          <Button 
            v-if="canInstall"
            @click="handleInstallPWA"
            variant="primary"
            icon="download"
          >
            Installer l'app
          </Button>
        </div>

        <div class="setting-card">
          <div class="setting-info">
            <h3>Mode hors ligne</h3>
            <p>L'application fonctionne entièrement hors ligne grâce au stockage local</p>
          </div>
          <span class="badge success">Activé</span>
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

        <div class="setting-card danger">
          <div class="setting-info">
            <h3>Effacer toutes les données</h3>
            <p>⚠️ Cette action est irréversible</p>
          </div>
          <Button 
            @click="handleClearData"
            variant="danger"
            icon="delete"
          >
            Tout effacer
          </Button>
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
              Application de gestion locative offline-first développée avec Vue 3, TypeScript et Dexie.js
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
