<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { usePropertiesStore } from '../stores/propertiesStore';
import PropertyCard from '@/shared/components/PropertyCard.vue';
import SearchBox from '@/shared/components/SearchBox.vue';
import Button from '@/shared/components/Button.vue';
import StatCard from '@/shared/components/StatCard.vue';
import PropertyFormModal from '../components/PropertyFormModal.vue';
import type { Property } from '../../../db/types';

const router = useRouter();
const propertiesStore = usePropertiesStore();

// Modals
const showPropertyForm = ref(false);
const propertyToEdit = ref<Property | null>(null);

// Filters
const searchQuery = ref('');
const filterType = ref<'all' | 'apartment' | 'house' | 'commercial' | 'parking'>('all');
const filterStatus = ref<'all' | 'occupied' | 'vacant' | 'maintenance'>('all');
const sortBy = ref<'name' | 'price' | 'surface'>('name');

// Computed
const filteredProperties = computed(() => {
  let result = [...propertiesStore.properties];

  // Search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      p => p.name.toLowerCase().includes(query) || p.address.toLowerCase().includes(query)
    );
  }

  // Filter by type
  if (filterType.value !== 'all') {
    result = result.filter(p => p.type === filterType.value);
  }

  // Filter by status
  if (filterStatus.value !== 'all') {
    result = result.filter(p => p.status === filterStatus.value);
  }

  // Sort
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'price':
        return b.rent - a.rent;
      case 'surface':
        return b.surface - a.surface;
      default:
        return 0;
    }
  });

  return result;
});

// Handlers
function handleSearch(query: string) {
  searchQuery.value = query;
}

function handlePropertyClick(id: number) {
  router.push(`/properties/${id}`);
}

function handleNewProperty() {
  propertyToEdit.value = null;
  showPropertyForm.value = true;
}

function handleEditProperty(property: Property, event: Event) {
  event.stopPropagation();
  propertyToEdit.value = property;
  showPropertyForm.value = true;
}

async function handleDeleteProperty(id: number, event: Event) {
  event.stopPropagation();
  if (confirm('Êtes-vous sûr de vouloir supprimer cette propriété ?')) {
    try {
      await propertiesStore.deleteProperty(id);
    } catch (error) {
      console.error('Failed to delete property:', error);
      alert('Erreur lors de la suppression de la propriété');
    }
  }
}

function handleFormSuccess() {
  propertyToEdit.value = null;
  propertiesStore.fetchProperties();
}

// Lifecycle
onMounted(async () => {
  await propertiesStore.fetchProperties();
});
</script>

<template>
  <div class="view-container properties-view">
    <!-- Header -->
    <header class="view-header">
      <div>
        <h1>Propriétés</h1>
        <div class="header-meta">
          {{ filteredProperties.length }} propriété{{ filteredProperties.length > 1 ? 's' : '' }}
        </div>
      </div>
      <div class="header-actions">
        <SearchBox
          v-model="searchQuery"
          placeholder="Rechercher une propriété..."
          @search="handleSearch"
        />
        <Button
          variant="primary"
          icon="plus"
          @click="handleNewProperty"
          data-testid="new-property-button"
          aria-label="Nouveau bien"
        >
          Nouvelle propriété
        </Button>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-grid">
      <StatCard
        label="Total propriétés"
        :value="propertiesStore.properties.length"
        icon="home-city"
        icon-color="primary"
      />
      <StatCard
        label="Occupées"
        :value="propertiesStore.occupiedProperties.length"
        icon="check-circle"
        icon-color="success"
      />
      <StatCard
        label="Vacantes"
        :value="propertiesStore.vacantProperties.length"
        icon="home-outline"
        icon-color="accent"
      />
      <StatCard
        label="Revenus mensuels"
        :value="`${propertiesStore.totalRevenue.toLocaleString('fr-FR')} €`"
        icon="currency-eur"
        icon-color="success"
      />
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <label class="filter-label">Type</label>
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
            :class="{ active: filterType === 'apartment' }"
            @click="filterType = 'apartment'"
          >
            Appartements
          </button>
          <button
            class="filter-button"
            :class="{ active: filterType === 'house' }"
            @click="filterType = 'house'"
          >
            Maisons
          </button>
          <button
            class="filter-button"
            :class="{ active: filterType === 'commercial' }"
            @click="filterType = 'commercial'"
          >
            Commercial
          </button>
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-label">Statut</label>
        <div class="filter-buttons">
          <button
            class="filter-button"
            :class="{ active: filterStatus === 'all' }"
            @click="filterStatus = 'all'"
          >
            Tous
          </button>
          <button
            class="filter-button"
            :class="{ active: filterStatus === 'occupied' }"
            @click="filterStatus = 'occupied'"
          >
            Occupées
          </button>
          <button
            class="filter-button"
            :class="{ active: filterStatus === 'vacant' }"
            @click="filterStatus = 'vacant'"
          >
            Vacantes
          </button>
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-label">Trier par</label>
        <select v-model="sortBy" class="sort-select">
          <option value="name">Nom</option>
          <option value="price">Prix (décroissant)</option>
          <option value="surface">Surface (décroissante)</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="propertiesStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement des propriétés...
    </div>

    <!-- Error State -->
    <div v-else-if="propertiesStore.error" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      {{ propertiesStore.error }}
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredProperties.length === 0" class="empty-state">
      <i class="mdi mdi-home-outline"></i>
      <h3>Aucune propriété trouvée</h3>
      <p v-if="searchQuery || filterType !== 'all' || filterStatus !== 'all'">
        Essayez de modifier vos filtres de recherche
      </p>
      <p v-else>Commencez par ajouter votre première propriété</p>
      <Button
        variant="primary"
        icon="plus"
        @click="handleNewProperty"
        data-testid="new-property-button"
        aria-label="Nouveau bien"
      >
        Nouvelle propriété
      </Button>
    </div>

    <!-- Properties Grid -->
    <div v-else class="properties-grid">
      <PropertyCard
        v-for="property in filteredProperties"
        :key="property.id"
        :property="property"
        @click="handlePropertyClick"
      >
        <template #actions>
          <Button
            variant="default"
            size="sm"
            icon="pencil"
            @click="handleEditProperty(property, $event)"
            data-testid="edit-property-button"
          >
            Modifier
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon="delete"
            @click="property.id && handleDeleteProperty(property.id, $event)"
            data-testid="delete-property-button"
          >
            Supprimer
          </Button>
        </template>
      </PropertyCard>
    </div>
  </div>

  <!-- Property Form Modal -->
  <PropertyFormModal
    v-model="showPropertyForm"
    :property="propertyToEdit"
    @success="handleFormSuccess"
  />
</template>

<style scoped>
/* Grille spécifique pour les propriétés */
.properties-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-6, 1.5rem);
}

@media (max-width: 768px) {
  .properties-grid {
    grid-template-columns: 1fr;
  }
}
</style>
