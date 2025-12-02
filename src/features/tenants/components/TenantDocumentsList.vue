<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useTenantDocuments } from '../composables/useTenantDocuments';
import Button from '../../../shared/components/Button.vue';
import type { TenantDocument } from '../../../db/types';

const props = defineProps<{ tenantId: number }>();
const {
  isLoading,
  error,
  getTenantDocuments,
  addTenantDocument,
  removeTenantDocument,
  createDocUrl,
  revokeDocUrl,
} = useTenantDocuments();

const documents = ref<TenantDocument[]>([]);
const docUrls = ref<Map<number, string>>(new Map());
const fileInput = ref<HTMLInputElement | null>(null);

async function load() {
  documents.value = await getTenantDocuments(props.tenantId);
  // create URLs
  docUrls.value.forEach(url => revokeDocUrl(url));
  docUrls.value.clear();
  documents.value.forEach(doc => {
    if (doc.id && doc.data) {
      const url = createDocUrl(doc.data as unknown);
      if (url) docUrls.value.set(doc.id, url);
    }
  });
}

onMounted(load);

onUnmounted(() => {
  docUrls.value.forEach(url => revokeDocUrl(url));
  docUrls.value.clear();
});

function triggerUpload() {
  fileInput.value?.click();
}

async function handleFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files && input.files[0];
  if (!file) return;
  await addTenantDocument(props.tenantId, file);
  await load();
  if (fileInput.value) fileInput.value.value = '';
}

async function handleRemove(id?: number) {
  if (!id) return;
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;
  await removeTenantDocument(id);
  await load();
}

function getDocUrlSafe(doc: TenantDocument): string | undefined {
  if (doc.id && docUrls.value.has(doc.id)) return docUrls.value.get(doc.id);
  if (doc.data) return createDocUrl(doc.data as unknown);
  return undefined;
}

function download(doc: TenantDocument) {
  const url = getDocUrlSafe(doc);
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    a.click();
    // If URL was created ad-hoc from data (not in docUrls), revoke it
    if (!doc.id || !docUrls.value.has(doc.id)) revokeDocUrl(url);
  } else {
    alert('Pas de fichier disponible pour téléchargement');
  }
}
</script>

<template>
  <div class="tenant-documents">
    <div v-if="error" class="error-message">
      <i class="mdi mdi-alert-circle"></i>
      {{ error }}
    </div>

    <div v-if="!documents.length && !isLoading" class="empty-state">
      <i class="mdi mdi-file-document-outline"></i>
      <p>Aucun document</p>
      <Button variant="primary" icon="plus" @click="triggerUpload">Ajouter un document</Button>
    </div>

    <div v-else class="documents-grid">
      <div v-for="doc in documents" :key="doc.id" class="doc-item">
        <div class="doc-preview" @click="download(doc)">
          <img
            v-if="doc.id && docUrls.get(doc.id) && doc.mimeType.startsWith('image/')"
            :src="docUrls.get(doc.id)"
            :alt="doc.name"
          />
          <div v-else class="doc-icon">
            <i class="mdi mdi-file-document"></i>
          </div>
        </div>
        <div class="doc-meta">
          <div class="doc-name">{{ doc.name }}</div>
          <div class="doc-actions">
            <button class="action-button download" @click.stop="download(doc)" title="Télécharger">
              <i class="mdi mdi-download"></i>
            </button>
            <button
              class="action-button delete"
              @click.stop="handleRemove(doc.id)"
              title="Supprimer"
            >
              <i class="mdi mdi-delete"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="doc-item add-doc" @click="triggerUpload">
        <div class="add-placeholder">
          <i class="mdi mdi-plus"></i>
          <span>Ajouter</span>
        </div>
      </div>
    </div>

    <input ref="fileInput" type="file" style="display: none" @change="handleFiles" />
  </div>
</template>

<style scoped>
.tenant-documents {
  width: 100%;
}
.documents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}
.doc-item {
  background: white;
  border-radius: 0.75rem;
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.06));
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.doc-preview {
  aspect-ratio: 4/3;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-muted, #f8fafc);
  cursor: pointer;
}
.doc-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.doc-icon {
  font-size: 2rem;
  color: var(--text-tertiary, #94a3b8);
}
.doc-meta {
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.doc-name {
  font-size: 0.95rem;
  color: var(--text-primary, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.doc-actions {
  display: flex;
  gap: 0.5rem;
}
.action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--primary-600, #4f46e5);
}
.action-btn.danger {
  color: var(--error-600, #dc2626);
}
.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--bg-secondary, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
  font-size: 1.25rem;
}
.action-button:hover {
  transform: scale(1.1);
}
.action-button.download {
  color: var(--primary-600, #4f46e5);
}
.action-button.download:hover {
  background: var(--primary-50, #eef2ff);
  border-color: var(--primary-300, #a5b4fc);
}
.action-button.delete {
  color: var(--error-600, #dc2626);
}
.action-button.delete:hover {
  background: var(--error-50, #fef2f2);
  border-color: var(--error-300, #fca5a5);
}
.add-doc {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 2px dashed var(--border-color, #e2e8f0);
}
.add-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--text-tertiary, #94a3b8);
}
</style>

<script lang="ts">
export default {};
</script>
