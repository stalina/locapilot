<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDocumentsStore } from '@/features/documents/stores/documentsStore';
import DocumentCard from '@/shared/components/DocumentCard.vue';
import DocumentPreviewModal from '@/shared/components/DocumentPreviewModal.vue';
import Button from '@/shared/components/Button.vue';
import type { Document } from '@/db/types';

const props = defineProps<{ propertyId: number }>();

const documentsStore = useDocumentsStore();

const showUploadForm = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedCategory = ref('dpe');
const selectedFile = ref<File | null>(null);
const expiresAtInput = ref('');
const isUploading = ref(false);

const CATEGORIES: Array<{ value: string; label: string; type: Document['type'] }> = [
  { value: 'dpe', label: 'DPE', type: 'diagnostic' },
  { value: 'amiante', label: 'Amiante', type: 'diagnostic' },
  { value: 'plomb', label: 'Plomb', type: 'diagnostic' },
  { value: 'electricite', label: 'Électricité', type: 'diagnostic' },
  { value: 'gaz', label: 'Gaz', type: 'diagnostic' },
  { value: 'erp', label: 'ERP', type: 'diagnostic' },
  { value: 'assurance-pno', label: 'Assurance PNO', type: 'insurance' },
  { value: 'titre', label: 'Titre de propriété', type: 'other' },
  { value: 'reglement', label: 'Règlement de copropriété', type: 'other' },
  { value: 'taxe', label: 'Taxe foncière', type: 'invoice' },
  { value: 'autre', label: 'Autre', type: 'other' },
];

const selectedCategoryIsDiagnostic = computed(
  () => CATEGORIES.find(c => c.value === selectedCategory.value)?.type === 'diagnostic'
);

const propertyDocuments = computed(() =>
  documentsStore
    .documentsByEntity('property', props.propertyId)
    .filter(d => d.type !== 'photo')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
);

onMounted(() => documentsStore.fetchDocuments());

function openUploadForm() {
  showUploadForm.value = true;
  selectedCategory.value = 'dpe';
  selectedFile.value = null;
  expiresAtInput.value = '';
}

function cancelUpload() {
  showUploadForm.value = false;
  selectedFile.value = null;
  expiresAtInput.value = '';
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
      relatedEntityType: 'property',
      relatedEntityId: props.propertyId,
      description: category.label,
      expiresAt: expiresAtInput.value ? new Date(expiresAtInput.value) : undefined,
    });
    cancelUpload();
  } finally {
    isUploading.value = false;
  }
}

async function handleExpiryUpdate(doc: Document, date: Date | null) {
  if (!doc.id) return;
  await documentsStore.updateDocument(doc.id, { expiresAt: date ?? undefined });
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

const previewDocument = ref<Document | null>(null);
const isPreviewOpen = ref(false);

function handlePreview(doc: Document) {
  previewDocument.value = doc;
  isPreviewOpen.value = true;
}

async function handlePreviewDownload() {
  if (!previewDocument.value?.id) return;
  await documentsStore.downloadDocument(previewDocument.value.id);
}
</script>

<template>
  <div class="property-documents">
    <!-- Upload Form -->
    <div v-if="showUploadForm" class="upload-form">
      <div class="upload-form-fields">
        <div class="field">
          <label class="field-label">Catégorie</label>
          <select v-model="selectedCategory" class="field-select">
            <option v-for="cat in CATEGORIES" :key="cat.value" :value="cat.value">
              {{ cat.label }}
            </option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">Fichier</label>
          <input ref="fileInput" type="file" class="field-file" @change="handleFileChange" />
        </div>
        <div v-if="selectedCategoryIsDiagnostic" class="field">
          <label class="field-label">Date d'expiration (optionnelle)</label>
          <input
            v-model="expiresAtInput"
            type="date"
            class="field-date"
            data-testid="document-expiresAt"
          />
        </div>
      </div>
      <div class="upload-form-actions">
        <Button variant="outline" size="sm" @click="cancelUpload">Annuler</Button>
        <Button
          variant="primary"
          size="sm"
          :disabled="!selectedFile || isUploading"
          @click="handleUpload"
        >
          {{ isUploading ? 'Envoi…' : 'Ajouter' }}
        </Button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!propertyDocuments.length" class="empty-state">
      <i class="mdi mdi-file-certificate-outline"></i>
      <p>Aucun document officiel</p>
      <Button variant="primary" icon="plus" @click="openUploadForm">Ajouter un document</Button>
    </div>

    <!-- Documents List -->
    <template v-else>
      <div class="documents-list">
        <DocumentCard
          v-for="doc in propertyDocuments"
          :key="doc.id"
          :document="doc"
          @preview="handlePreview(doc)"
          @download="handleDownload(doc)"
          @delete="handleDelete(doc)"
          @update-expiry="handleExpiryUpdate(doc, $event)"
        />
      </div>
      <div class="list-footer">
        <Button variant="outline" icon="plus" size="sm" @click="openUploadForm">
          Ajouter un document
        </Button>
      </div>
    </template>

    <!-- Preview Modal -->
    <DocumentPreviewModal
      v-model="isPreviewOpen"
      :document="previewDocument"
      @download="handlePreviewDownload"
    />
  </div>
</template>

<style scoped>
.property-documents {
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

.field-date {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  background: white;
  font-size: 0.9375rem;
  color: var(--text-primary, #0f172a);
}

.field-date:focus {
  outline: none;
  border-color: var(--primary-400, #818cf8);
  box-shadow: 0 0 0 3px var(--primary-100, #e0e7ff);
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
