<script setup lang="ts">
import { ref, computed, watch, onMounted, useTemplateRef } from 'vue';
import { useRoute } from 'vue-router';
import { useDocumentsStore } from '../stores/documentsStore';
import {
  loadEntityOptions,
  type EntityOption,
  type FilterableEntityType,
} from '../services/entityOptionsService';
import DocumentCard from '@/shared/components/DocumentCard.vue';
import DocumentPreviewModal from '@/shared/components/DocumentPreviewModal.vue';
import UploadZone from '@/shared/components/UploadZone.vue';
import StatCard from '@/shared/components/StatCard.vue';
import SearchBox from '@/shared/components/SearchBox.vue';
import { useVirtualScroll } from '@/shared/composables/useVirtualScroll';
import type { Document } from '@/db/types';

const documentsStore = useDocumentsStore();

// Filters
const route = useRoute();
const searchQuery = ref('');
const filterType = ref<Document['type'] | 'all'>('all');
const filterEntityType = ref<FilterableEntityType | 'all'>('all');
const filterEntityId = ref<number | 'all'>('all');
const entityOptions = ref<EntityOption[]>([]);

const ENTITY_TYPE_LABELS: Array<{ value: FilterableEntityType; label: string }> = [
  { value: 'property', label: 'Bien' },
  { value: 'tenant', label: 'Locataire' },
  { value: 'lease', label: 'Bail' },
  { value: 'rent', label: 'Loyer' },
  { value: 'inventory', label: 'État des lieux' },
];

// Preview modal
const previewDocument = ref<Document | null>(null);
const isPreviewOpen = ref(false);

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

  // Related-entity filter (UI selects)
  if (filterEntityType.value !== 'all') {
    result = result.filter(d => d.relatedEntityType === filterEntityType.value);
    if (filterEntityId.value !== 'all') {
      result = result.filter(d => d.relatedEntityId === filterEntityId.value);
    }
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

// Viewport virtualization: only mount visible cards once the grid grows large.
// Below the threshold every card is rendered exactly as before.
const DOCUMENT_CARD_HEIGHT = 292; // approx. rendered card height (276) + grid gap (16) in px
const DOCUMENT_VIEWPORT_HEIGHT = 720; // fixed scroll container height when virtualized
const documentsScrollContainer = useTemplateRef<HTMLElement>('documentsScrollContainer');
const {
  isVirtual: isDocumentsVirtual,
  visibleItems: visibleDocuments,
  topSpacerHeight: documentsTopSpacer,
  bottomSpacerHeight: documentsBottomSpacer,
  onScroll: onDocumentsScroll,
} = useVirtualScroll<Document>({
  items: filteredDocuments,
  itemHeight: DOCUMENT_CARD_HEIGHT,
  viewportHeight: DOCUMENT_VIEWPORT_HEIGHT,
  containerRef: documentsScrollContainer,
  // Reset scroll to top whenever a search / filter narrows the grid.
  resetKey: () =>
    `${searchQuery.value}|${filterType.value}|${filterEntityType.value}|${filterEntityId.value}`,
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

async function handleExpiryUpdate(document: Document, date: Date | null) {
  if (!document.id) return;
  await documentsStore.updateDocument(document.id, { expiresAt: date ?? undefined });
}

function handleSearch(query: string) {
  searchQuery.value = query;
}

function handlePreview(document: Document) {
  previewDocument.value = document;
  isPreviewOpen.value = true;
}

async function handlePreviewDownload() {
  if (previewDocument.value?.id) {
    await documentsStore.downloadDocument(previewDocument.value.id);
  }
}

// Reload the specific-entity options whenever the entity type changes
watch(filterEntityType, async entityType => {
  filterEntityId.value = 'all';
  entityOptions.value = [];
  if (entityType === 'all') return;

  const ids = documentsStore.documents
    .filter(d => d.relatedEntityType === entityType && typeof d.relatedEntityId === 'number')
    .map(d => d.relatedEntityId as number);

  try {
    entityOptions.value = await loadEntityOptions(entityType, ids);
  } catch (error) {
    console.error('Failed to load entity options:', error);
    entityOptions.value = [];
  }
});

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

      <div class="filter-group">
        <label class="filter-label">Entité liée</label>
        <div class="entity-filters">
          <select
            v-model="filterEntityType"
            class="entity-select"
            data-testid="entity-type-filter"
            aria-label="Type d'entité liée"
          >
            <option value="all">Toutes les entités</option>
            <option v-for="entity in ENTITY_TYPE_LABELS" :key="entity.value" :value="entity.value">
              {{ entity.label }}
            </option>
          </select>
          <select
            v-if="filterEntityType !== 'all'"
            v-model="filterEntityId"
            class="entity-select"
            data-testid="entity-filter"
            aria-label="Entité liée"
          >
            <option value="all">Tous</option>
            <option v-for="option in entityOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
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
      <p v-if="searchQuery || filterType !== 'all' || filterEntityType !== 'all'">
        Essayez de modifier vos filtres de recherche
      </p>
      <p v-else>Commencez par téléverser vos premiers documents</p>
    </div>

    <!-- Documents Grid -->
    <div
      v-else
      ref="documentsScrollContainer"
      class="documents-grid"
      :class="{ 'is-virtual': isDocumentsVirtual }"
      data-testid="documents-scroll-container"
      @scroll="onDocumentsScroll"
    >
      <div
        v-if="documentsTopSpacer > 0"
        class="virtual-spacer"
        aria-hidden="true"
        :style="{ height: `${documentsTopSpacer}px` }"
      ></div>
      <DocumentCard
        v-for="{ item: document } in visibleDocuments"
        :key="document.id"
        :document="document"
        data-testid="document-card"
        @preview="handlePreview(document)"
        @download="handleDownload(document)"
        @delete="handleDelete(document)"
        @update-expiry="handleExpiryUpdate(document, $event)"
      />
      <div
        v-if="documentsBottomSpacer > 0"
        class="virtual-spacer"
        aria-hidden="true"
        :style="{ height: `${documentsBottomSpacer}px` }"
      ></div>
    </div>

    <!-- Preview Modal -->
    <DocumentPreviewModal
      v-model="isPreviewOpen"
      :document="previewDocument"
      @download="handlePreviewDownload"
    />
  </div>
</template>

<style scoped>
/* Grille spécifique pour les documents (affichage en colonne) */
.documents-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

/* When the grid is large, it becomes the scroll viewport so that only the
   visible cards are mounted (viewport virtualization). */
.documents-grid.is-virtual {
  max-height: 720px;
  overflow-y: auto;
}

/* In the flex column, spacers and cards must keep their intrinsic height so
   the virtual scroll range stays proportional to the full list. */
.documents-grid.is-virtual > * {
  flex-shrink: 0;
}

.virtual-spacer {
  flex-shrink: 0;
}

.entity-filters {
  display: flex;
  gap: var(--space-2, 0.5rem);
  flex-wrap: wrap;
}

.entity-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  background: white;
  font-size: 0.9375rem;
  color: var(--text-primary, #0f172a);
  cursor: pointer;
}

.entity-select:focus {
  outline: none;
  border-color: var(--primary-400, #818cf8);
  box-shadow: 0 0 0 3px var(--primary-100, #e0e7ff);
}
</style>
