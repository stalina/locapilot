<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useDocumentsStore } from '../stores/documentsStore';
import DocumentCard from '@/shared/components/DocumentCard.vue';
import UploadZone from '@/shared/components/UploadZone.vue';
import StatCard from '@/shared/components/StatCard.vue';
import SearchBox from '@/shared/components/SearchBox.vue';
import type { Document } from '@/db/types';

const documentsStore = useDocumentsStore();

// Filters
const route = useRoute();
const searchQuery = ref('');
const filterType = ref<Document['type'] | 'all'>('all');

// Filtered documents
const filteredDocuments = computed(() => {
  let result = [...documentsStore.documents];

  // If route query asks for a specific related entity, filter by it
  const relatedEntityType = route.query.relatedEntityType as string | undefined;
  const relatedEntityId = route.query.relatedEntityId ? Number(route.query.relatedEntityId) : null;
  // Support legacy propertyId / tenantId query params
  const propertyIdQuery = route.query.propertyId ? Number(route.query.propertyId) : null;
  const tenantIdQuery = route.query.tenantId ? Number(route.query.tenantId) : null;
  if (relatedEntityType && relatedEntityId) {
    result = result.filter(
      d => d.relatedEntityType === relatedEntityType && d.relatedEntityId === relatedEntityId
    );
  }

  // If propertyId passed directly, filter documents related to that property
  if (propertyIdQuery) {
    result = result.filter(
      d => d.relatedEntityType === 'property' && d.relatedEntityId === propertyIdQuery
    );
  }

  // If tenantId passed, filter documents related to that tenant
  if (tenantIdQuery) {
    result = result.filter(
      d => d.relatedEntityType === 'tenant' && d.relatedEntityId === tenantIdQuery
    );
  }

  // Search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(d => d.name.toLowerCase().includes(query));
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
        relatedEntityType: undefined,
        relatedEntityId: undefined,
      });
    } catch (error) {
      console.error('Failed to upload file:', file.name, error);
    }
  }
}

async function handleDownload(document: Document) {
  if (document.id) {
    await documentsStore.downloadDocument(document.id);
  }
}

async function handleDelete(document: Document) {
  if (!confirm(`Êtes-vous sûr de vouloir supprimer "${document.name}" ?`)) return;
  if (document.id) {
    await documentsStore.deleteDocument(document.id);
  }
}

function handleSearch(query: string) {
  searchQuery.value = query;
}

// Lifecycle
onMounted(async () => {
  await documentsStore.fetchDocuments();
  // If a propertyId was passed as query param, map it to relatedEntityType/property
  const propertyIdQuery = route.query.propertyId ? Number(route.query.propertyId) : null;
  if (propertyIdQuery) {
    // Prefill search to limit visible documents to this property by applying the query filter above
  }
});
</script>

<template>
  <div class="view-container documents-view">
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
      <div class="header-actions">
        <SearchBox
          v-model="searchQuery"
          placeholder="Rechercher un document..."
          @search="handleSearch"
        />
      </div>
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
        :value="String(documentsStore.documentCounts.lease ?? 0)"
        icon="file-document"
        icon-color="primary"
      />
      <StatCard
        label="États des lieux"
        :value="String(documentsStore.documentCounts.inventory ?? 0)"
        icon="clipboard-check"
        icon-color="accent"
      />
      <StatCard
        label="Factures"
        :value="String(documentsStore.documentCounts.invoice ?? 0)"
        icon="receipt"
        icon-color="warning"
      />
    </div>

    <!-- Upload Zone -->
    <UploadZone :disabled="documentsStore.isLoading" @upload="handleUpload" />

    <!-- Upload Progress -->
    <div v-if="documentsStore.uploadProgress > 0" class="upload-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${documentsStore.uploadProgress}%` }"></div>
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
            :class="{ active: filterType === 'photo' }"
            @click="filterType = 'photo'"
          >
            Photos
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
      <p v-if="searchQuery || filterType !== 'all'">Essayez de modifier vos filtres de recherche</p>
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
/* Grille spécifique pour les documents (affichage en colonne) */
.documents-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}
</style>
