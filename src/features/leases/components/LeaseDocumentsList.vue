<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDocumentsStore } from '@/features/documents/stores/documentsStore';
import DocumentCard from '@/shared/components/DocumentCard.vue';
import Button from '@/shared/components/Button.vue';
import type { Document } from '@/db/types';

const props = defineProps<{ leaseId: number }>();

const documentsStore = useDocumentsStore();

const showUploadForm = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedCategory = ref('bail');
const selectedFile = ref<File | null>(null);
const isUploading = ref(false);

const CATEGORIES: Array<{ value: string; label: string; type: Document['type'] }> = [
  { value: 'bail', label: 'Bail signé', type: 'lease' },
  { value: 'garant', label: 'Garant', type: 'other' },
  { value: 'assurance', label: 'Assurance', type: 'insurance' },
  { value: 'autre', label: 'Autre', type: 'other' },
];

const leaseDocuments = computed(() =>
  documentsStore
    .documentsByEntity('lease', props.leaseId)
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
);

onMounted(() => documentsStore.fetchDocuments());

function openUploadForm() {
  showUploadForm.value = true;
  selectedCategory.value = 'bail';
  selectedFile.value = null;
}

function cancelUpload() {
  showUploadForm.value = false;
  selectedFile.value = null;
  if (fileInput.value) fileInput.value.value = '';
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
}

async function handleUpload() {
  if (!selectedFile.value) return;

  const category = CATEGORIES.find(c => c.value === selectedCategory.value);
  if (!category) return;

  isUploading.value = true;
  try {
    await documentsStore.uploadDocument(selectedFile.value, {
      type: category.type,
      relatedEntityType: 'lease',
      relatedEntityId: props.leaseId,
      description: category.label,
    });
    cancelUpload();
  } finally {
    isUploading.value = false;
  }
}

async function handleDelete(doc: Document) {
  if (!doc.id) return;
  if (!confirm('Supprimer ce document ?')) return;
  await documentsStore.deleteDocument(doc.id);
}

async function handleDownload(doc: Document) {
  if (!doc.id) return;
  await documentsStore.downloadDocument(doc.id);
}
</script>

<template>
  <div class="lease-documents" data-testid="lease-documents">
    <!-- Upload Form -->
    <div v-if="showUploadForm" class="upload-form" data-testid="lease-documents-upload-form">
      <div class="upload-form-fields">
        <div class="field">
          <label class="field-label">Catégorie</label>
          <select
            v-model="selectedCategory"
            class="field-select"
            data-testid="lease-document-category"
          >
            <option v-for="cat in CATEGORIES" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">Fichier</label>
          <input
            ref="fileInput"
            type="file"
            class="field-file"
            data-testid="lease-document-file"
            @change="handleFileChange"
          />
        </div>
      </div>
      <div class="upload-form-actions">
        <Button variant="outline" size="sm" @click="cancelUpload">Annuler</Button>
        <Button
          variant="primary"
          size="sm"
          data-testid="lease-document-submit"
          :disabled="!selectedFile || isUploading"
          @click="handleUpload"
        >
          {{ isUploading ? 'Envoi…' : 'Ajouter' }}
        </Button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!leaseDocuments.length" class="empty-state" data-testid="lease-documents-empty">
      <i class="mdi mdi-file-document-outline"></i>
      <p>Aucun document attaché à ce bail</p>
      <Button variant="primary" icon="plus" @click="openUploadForm">Ajouter un document</Button>
    </div>

    <!-- Documents List -->
    <template v-else>
      <div class="documents-list" data-testid="lease-documents-list">
        <DocumentCard
          v-for="doc in leaseDocuments"
          :key="doc.id"
          :document="doc"
          @download="handleDownload(doc)"
          @delete="handleDelete(doc)"
        />
      </div>
      <div class="list-footer">
        <Button variant="outline" icon="plus" size="sm" @click="openUploadForm">
          Ajouter un document
        </Button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lease-documents {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary, #f1f5f9);
  border-radius: var(--radius-lg, 0.75rem);
  border: 1px solid var(--border-color, #e2e8f0);
}

.upload-form-fields {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
}

.field-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  background: white;
  font-size: 0.9375rem;
  color: var(--text-primary, #0f172a);
  cursor: pointer;
}

.field-select:focus {
  outline: none;
  border-color: var(--primary-400, #818cf8);
  box-shadow: 0 0 0 3px var(--primary-100, #e0e7ff);
}

.field-file {
  font-size: 0.9rem;
  color: var(--text-primary, #0f172a);
}

.upload-form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.list-footer {
  display: flex;
  justify-content: flex-end;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  color: var(--text-tertiary, #94a3b8);
  text-align: center;
}

.empty-state i {
  font-size: 3rem;
}

.empty-state p {
  margin: 0;
  font-size: 0.9375rem;
}
</style>
