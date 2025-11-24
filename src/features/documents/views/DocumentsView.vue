<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDocumentsStore } from '../stores/documentsStore';
import DocumentCard from '@shared/components/DocumentCard.vue';
import UploadZone from '@shared/components/UploadZone.vue';
import StatCard from '@shared/components/StatCard.vue';
import SearchBox from '@shared/components/SearchBox.vue';
import type { Document } from '@/db/types';

const documentsStore = useDocumentsStore();

// Filters
const searchQuery = ref('');
const filterType = ref<Document['type'] | 'all'>('all');

// Filtered documents
const filteredDocuments = computed(() => {
  let result = [...documentsStore.documents];

  // Search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      d =>
        d.name.toLowerCase().includes(query) ||
        d.description?.toLowerCase().includes(query)
    );
  }

  // Filter by type
  if (filterType.value !== 'all') {
    result = result.filter(d => d.type === filterType.value);
  }

  // Sort by date (most recent first)
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return result;
});

// Handlers
async function handleUpload(files: File[]) {
  for (const file of files) {
    try {
      await documentsStore.uploadDocument(file, {
        type: 'other',
        description: '',
        entityType: null,
        entityId: null,
      });
    } catch (error) {
      console.error('Failed to upload file:', file.name, error);
    }
  }
}

async function handleDownload(document: Document) {
  await documentsStore.downloadDocument(document.id);
}

async function handleDelete(document: Document) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer "${document.name}" ?`)) return;
  await documentsStore.deleteDocument(document.id);
}

function handleSearch(query: string) {
  searchQuery.value = query;
}

// Lifecycle
onMounted(async () => {
  await documentsStore.fetchDocuments();
});
</script>

<template>
  <div class="documents-view">
    <!-- Header -->
    <header class="view-header">
      <div>
        <h1>Documents</h1>
        <div class="header-meta">
          {{ filteredDocuments.length }} document{{ filteredDocuments.length > 1 ? 's' : '' }}
          <span v-if="documentsStore.totalSize > 0">
            • {{ documentsStore.formatFileSize(documentsStore.totalSize) }}
          </span>
        </div>
      </div>
      <SearchBox
        v-model="searchQuery"
        placeholder="Rechercher un document..."
        @search="handleSearch"
      />
    </header>

    <!-- Stats -->
    <div class="stats-grid">
      <StatCard
        label="Total documents"
        :value="documentsStore.documents.length"
        icon="file-multiple"
        icon-color="primary"
      />
      <StatCard
        label="Baux"
        :value="documentsStore.documentCounts.lease"
        icon="file-document"
        icon-color="primary"
      />
      <StatCard
        label="États des lieux"
        :value="documentsStore.documentCounts.inventory"
        icon="clipboard-check"
        icon-color="accent"
      />
      <StatCard
        label="Factures"
        :value="documentsStore.documentCounts.invoice"
        icon="receipt"
        icon-color="warning"
      />
    </div>

    <!-- Upload Zone -->
    <UploadZone
      :disabled="documentsStore.isLoading"
      @upload="handleUpload"
    />

    <!-- Upload Progress -->
    <div v-if="documentsStore.uploadProgress > 0" class="upload-progress">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${documentsStore.uploadProgress}%` }"
        ></div>
      </div>
      <span class="progress-text">{{ documentsStore.uploadProgress }}%</span>
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <label class="filter-label">Type de document</label>
        <div class="filter-buttons">
          <button
            class="filter-button"
            :class="{ active: filterType === 'all' }"
            @click="filterType = 'all'"
          >
            Tous
          </button>
          <button
            class="filter-button"
            :class="{ active: filterType === 'lease' }"
            @click="filterType = 'lease'"
          >
            Baux
          </button>
          <button
            class="filter-button"
            :class="{ active: filterType === 'inventory' }"
            @click="filterType = 'inventory'"
          >
            États des lieux
          </button>
          <button
            class="filter-button"
            :class="{ active: filterType === 'invoice' }"
            @click="filterType = 'invoice'"
          >
            Factures
          </button>
          <button
            class="filter-button"
            :class="{ active: filterType === 'insurance' }"
            @click="filterType = 'insurance'"
          >
            Assurances
          </button>
          <button
            class="filter-button"
            :class="{ active: filterType === 'other' }"
            @click="filterType = 'other'"
          >
            Autres
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="documentsStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement des documents...
    </div>

    <!-- Error State -->
    <div v-else-if="documentsStore.error" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      {{ documentsStore.error }}
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredDocuments.length === 0" class="empty-state">
      <i class="mdi mdi-file-outline"></i>
      <h3>Aucun document trouvé</h3>
      <p v-if="searchQuery || filterType !== 'all'">
        Essayez de modifier vos filtres de recherche
      </p>
      <p v-else>Commencez par téléverser vos premiers documents</p>
    </div>

    <!-- Documents Grid -->
    <div v-else class="documents-grid">
      <DocumentCard
        v-for="document in filteredDocuments"
        :key="document.id"
        :document="document"
        @download="handleDownload(document)"
        @delete="handleDelete(document)"
      />
    </div>
  </div>
</template>

<style scoped>
.documents-view {
  padding: var(--space-8, 2rem);
  max-width: 1400px;
  margin: 0 auto;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-8, 2rem);
  gap: var(--space-6, 1.5rem);
}

.view-header h1 {
  margin-bottom: var(--space-2, 0.5rem);
}

.header-meta {
  color: var(--text-secondary, #64748b);
  font-size: var(--text-base, 1rem);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-6, 1.5rem);
  margin-bottom: var(--space-8, 2rem);
}

.upload-progress {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  margin: var(--space-6, 1.5rem) 0;
  padding: var(--space-4, 1rem);
  background: white;
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-secondary, #f1f5f9);
  border-radius: var(--radius-full, 9999px);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-500, #6366f1), var(--primary-600, #4f46e5));
  border-radius: var(--radius-full, 9999px);
  transition: width var(--transition-base, 0.2s ease);
}

.progress-text {
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--primary-600, #4f46e5);
  min-width: 50px;
  text-align: right;
}

.filters {
  display: flex;
  gap: var(--space-8, 2rem);
  margin-bottom: var(--space-8, 2rem);
  padding: var(--space-6, 1.5rem);
  background: white;
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  flex: 1;
}

.filter-label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary, #64748b);
}

.filter-buttons {
  display: flex;
  gap: var(--space-2, 0.5rem);
  flex-wrap: wrap;
}

.filter-button {
  padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary, #64748b);
  background: var(--bg-secondary, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.filter-button:hover {
  background: var(--bg-primary, #ffffff);
  color: var(--text-primary, #0f172a);
}

.filter-button.active {
  background: linear-gradient(135deg, var(--primary-50, #eef2ff), var(--primary-100, #e0e7ff));
  color: var(--primary-600, #4f46e5);
  border-color: var(--primary-200, #c7d2fe);
  font-weight: var(--font-weight-semibold, 600);
}

.documents-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16, 4rem);
  text-align: center;
  gap: var(--space-4, 1rem);
}

.loading-state i,
.error-state i,
.empty-state i {
  font-size: 4rem;
  color: var(--text-tertiary, #94a3b8);
}

.loading-state {
  color: var(--text-secondary, #64748b);
}

.error-state {
  color: var(--error-600, #dc2626);
}

.empty-state h3 {
  margin: 0;
  color: var(--text-primary, #0f172a);
}

.empty-state p {
  margin: 0;
  color: var(--text-secondary, #64748b);
}

@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
    align-items: stretch;
  }

  .filters {
    flex-direction: column;
  }
}
</style>
