<script setup lang="ts">
import { onMounted, ref } from 'vue';
import Button from '@/shared/components/Button.vue';
import { useBackupStore } from '../stores/backupStore';
import {
  BackupFailedError,
  INVALID_SNAPSHOT_MESSAGE,
  InvalidSnapshotError,
  formatMegabytes,
  runWithRestorePointFallback,
  triggerLabel,
  type StoredBackupSnapshot,
} from '../services/backupService';

const emit = defineEmits<{
  /** The business data was replaced by a restore point. */
  (e: 'restored'): void;
}>();

const backupStore = useBackupStore();

type MessageType = 'success' | 'info' | 'error';
const message = ref<{ type: MessageType; text: string } | null>(null);
const showMessage = (type: MessageType, text: string) => {
  message.value = { type, text };
};

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
});
const formatDate = (date: Date) => dateFormatter.format(new Date(date));

const plural = (count: number, singular: string, pluralForm: string) =>
  `${count} ${count > 1 ? pluralForm : singular}`;

const summary = (snapshot: StoredBackupSnapshot) => {
  const { counts } = snapshot;
  const documents = (counts.documents ?? 0) + (counts.tenantDocuments ?? 0);
  return [
    plural(counts.properties ?? 0, 'bien', 'biens'),
    plural(counts.tenants ?? 0, 'locataire', 'locataires'),
    plural(counts.leases ?? 0, 'bail', 'baux'),
    plural(documents, 'document', 'documents'),
    `${formatMegabytes(snapshot.totalBytes)} Mo`,
  ].join(' · ');
};

onMounted(async () => {
  await backupStore.loadAutoBackupSetting();
  await backupStore.loadSnapshots();
});

const handleToggle = async (event: Event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  try {
    await backupStore.setAutoBackupEnabled(target.checked);
  } catch (error) {
    console.error('Failed to save autoBackupEnabled', error);
    target.checked = !target.checked;
    showMessage('error', 'Erreur lors de la sauvegarde du réglage');
  }
};

const handleCreate = async () => {
  message.value = null;
  try {
    const result = await backupStore.createSnapshot('manual');
    if (result === 'created') showMessage('success', 'Point de restauration créé');
    else showMessage('info', 'Aucune donnée à sauvegarder');
  } catch (error) {
    console.error('Restore point creation failed', error);
    showMessage(
      'error',
      error instanceof BackupFailedError
        ? error.message
        : 'Impossible de créer le point de restauration'
    );
  }
};

const handleRestore = async (snapshot: StoredBackupSnapshot) => {
  message.value = null;
  if (
    !confirm(
      `Vos données actuelles seront remplacées par celles du point de restauration du ${formatDate(snapshot.createdAt)}. Continuer ?`
    )
  ) {
    return;
  }
  try {
    const outcome = await runWithRestorePointFallback(
      skipSnapshot => backupStore.restoreSnapshot(snapshot.id, { skipSnapshot }),
      text => confirm(text)
    );
    if (outcome.status === 'declined') {
      showMessage('info', "Restauration annulée — aucune donnée n'a été modifiée");
      return;
    }
    showMessage('success', 'Données restaurées avec succès');
    emit('restored');
  } catch (error) {
    console.error('Restore failed', error);
    showMessage(
      'error',
      error instanceof InvalidSnapshotError
        ? INVALID_SNAPSHOT_MESSAGE
        : "Erreur lors de la restauration — vos données n'ont pas été modifiées"
    );
  }
};

const handleDownload = async (snapshot: StoredBackupSnapshot) => {
  message.value = null;
  try {
    await backupStore.downloadSnapshot(snapshot.id);
  } catch (error) {
    console.error('Restore point download failed', error);
    showMessage('error', 'Erreur lors du téléchargement du point de restauration');
  }
};

const handleDelete = async (snapshot: StoredBackupSnapshot) => {
  message.value = null;
  if (!confirm('Supprimer ce point de restauration ?')) return;
  try {
    await backupStore.deleteSnapshot(snapshot.id);
  } catch (error) {
    console.error('Restore point deletion failed', error);
    showMessage('error', 'Erreur lors de la suppression du point de restauration');
  }
};
</script>

<template>
  <div class="setting-card restore-points-card" data-testid="restore-points-card">
    <div class="restore-points-header">
      <div class="restore-points-intro">
        <h3>Points de restauration</h3>
        <p>
          Copies de vos données conservées sur cet appareil : une par jour automatiquement, et une
          avant chaque import, synchronisation, effacement ou restauration.
        </p>
      </div>
      <Button
        v-if="!backupStore.unavailable"
        variant="secondary"
        icon="backup-restore"
        :loading="backupStore.isCreating"
        :disabled="backupStore.isCreating || backupStore.isRestoring"
        @click="handleCreate"
      >
        Créer un point de restauration
      </Button>
    </div>

    <p
      v-if="backupStore.unavailable"
      class="restore-points-alert"
      data-testid="restore-points-unavailable"
    >
      Points de restauration indisponibles sur ce navigateur
    </p>

    <template v-else>
      <label class="restore-points-toggle">
        <input
          type="checkbox"
          data-testid="auto-backup-toggle"
          :checked="backupStore.autoBackupEnabled"
          @change="handleToggle"
        />
        Points de restauration automatiques
      </label>

      <p
        v-if="backupStore.lastAutoError"
        class="restore-points-alert"
        role="status"
        data-testid="restore-points-auto-error"
      >
        ⚠️ {{ backupStore.lastAutoError }}
      </p>

      <p
        v-if="message"
        :class="['restore-points-message', `restore-points-message--${message.type}`]"
        role="status"
        data-testid="restore-points-message"
      >
        {{ message.text }}
      </p>

      <p
        v-if="backupStore.snapshots.length === 0"
        class="restore-points-empty"
        data-testid="restore-points-empty"
      >
        Aucun point de restauration pour le moment
      </p>
      <ul v-else class="restore-points-list" data-testid="restore-points-list">
        <li
          v-for="snapshot in backupStore.snapshots"
          :key="snapshot.id"
          class="restore-point"
          data-testid="restore-point"
        >
          <div class="restore-point-info">
            <div class="restore-point-title">
              <strong>{{ formatDate(snapshot.createdAt) }}</strong>
              <span class="restore-point-trigger" data-testid="restore-point-trigger">
                {{ triggerLabel(snapshot.trigger) }}
              </span>
            </div>
            <span class="restore-point-summary">{{ summary(snapshot) }}</span>
          </div>
          <div class="restore-point-actions">
            <Button
              size="sm"
              variant="secondary"
              icon="restore"
              :disabled="backupStore.isRestoring || backupStore.isCreating"
              @click="handleRestore(snapshot)"
            >
              Restaurer
            </Button>
            <Button size="sm" variant="outline" icon="download" @click="handleDownload(snapshot)">
              Télécharger
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon="delete"
              :disabled="backupStore.isRestoring"
              @click="handleDelete(snapshot)"
            >
              Supprimer
            </Button>
          </div>
        </li>
      </ul>
    </template>

    <p
      :class="[
        'restore-points-hint',
        { 'restore-points-hint--emphasis': backupStore.persisted === false },
      ]"
      data-testid="restore-points-hint"
    >
      <template v-if="backupStore.persisted === false">
        ⚠️ Votre navigateur peut supprimer les données locales en cas de manque d'espace.
      </template>
      Les points de restauration restent dans ce navigateur : ils disparaissent si ses données sont
      effacées ou si l'appareil est perdu. Exportez aussi régulièrement vos données dans un fichier
      (« Exporter les données »).
    </p>
  </div>
</template>

<style scoped>
/* Uses the global design tokens (variables.css). Doubled class: the parent's
   scoped `.setting-card` rule (a row, centred) must not win. */
.setting-card.restore-points-card {
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-3);
}

.restore-points-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
}

.restore-points-intro {
  flex: 1;
}

.restore-points-intro h3 {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-1) 0;
}

.restore-points-card p {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.restore-points-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.restore-points-card .restore-points-alert {
  color: var(--warning-600);
}

.restore-points-card .restore-points-message--success {
  color: var(--success-600);
}

.restore-points-card .restore-points-message--error {
  color: var(--error-600);
}

.restore-points-card .restore-points-empty {
  font-style: italic;
}

.restore-points-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.restore-point {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.restore-point-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}

.restore-point-title {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.restore-point-trigger {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: var(--text-xs);
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.restore-point-summary {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.restore-point-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}

.restore-points-card .restore-points-hint {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.restore-points-card .restore-points-hint--emphasis {
  color: var(--warning-600);
  font-weight: 500;
}

@media (max-width: 768px) {
  .restore-points-header,
  .restore-point {
    flex-direction: column;
    align-items: stretch;
  }

  .restore-point-actions {
    justify-content: flex-start;
  }
}
</style>
