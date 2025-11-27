<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useInventoriesStore } from '../stores/inventoriesStore';
import { useLeasesStore } from '../../leases/stores/leasesStore';
import { usePropertiesStore } from '../../properties/stores/propertiesStore';
import { useTenantsStore } from '../../tenants/stores/tenantsStore';
import Button from '../../../shared/components/Button.vue';
import StatCard from '../../../shared/components/StatCard.vue';
import Badge from '../../../shared/components/Badge.vue';
import InventoryFormModal from '../components/InventoryFormModal.vue';
import type { Inventory } from '../../../db/types';

const router = useRouter();
const inventoriesStore = useInventoriesStore();
const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();

// Modals
const showInventoryForm = ref(false);
const inventoryToEdit = ref<Inventory | null>(null);

// Filters
const typeFilter = ref<'all' | 'checkin' | 'checkout'>('all');
const searchQuery = ref('');

onMounted(async () => {
  await Promise.all([
    inventoriesStore.fetchInventories(),
    leasesStore.fetchLeases(),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
  ]);
});

const filteredInventories = computed(() => {
  let result = [...inventoriesStore.inventories];

  // Filter by type
  if (typeFilter.value !== 'all') {
    result = result.filter(i => i.type === typeFilter.value);
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(inventory => {
      const lease = leasesStore.leases.find(l => l.id === inventory.leaseId);
      if (!lease) return false;

      const property = propertiesStore.properties.find(p => p.id === lease.propertyId);
      const propertyMatch = property?.name.toLowerCase().includes(query) ||
                           property?.address.toLowerCase().includes(query);

      return propertyMatch;
    });
  }

  return result.sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
});

const stats = computed(() => ({
  total: inventoriesStore.inventories.length,
  checkIn: inventoriesStore.checkInInventories.length,
  checkOut: inventoriesStore.checkOutInventories.length,
}));

const getPropertyName = (leaseId: number) => {
  const lease = leasesStore.leases.find(l => l.id === leaseId);
  if (!lease) return 'Propriété inconnue';
  const property = propertiesStore.properties.find(p => p.id === lease.propertyId);
  return property?.name || 'Propriété inconnue';
};

const getTenantName = (leaseId: number) => {
  const lease = leasesStore.leases.find(l => l.id === leaseId);
  if (!lease || !lease.tenantIds || lease.tenantIds.length === 0) return 'Locataire inconnu';
  const tenant = tenantsStore.tenants.find(t => t.id === lease.tenantIds[0]);
  return tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Locataire inconnu';
};

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const typeConfig = (type: Inventory['type']) => {
  const configs = {
    checkin: { variant: 'success' as const, label: 'État d\'entrée', icon: 'home-import-outline' },
    checkout: { variant: 'warning' as const, label: 'État de sortie', icon: 'home-export-outline' },
  };
  return configs[type];
};

const handleNewInventory = () => {
  inventoryToEdit.value = null;
  showInventoryForm.value = true;
};

const handleEditInventory = (inventory: Inventory) => {
  inventoryToEdit.value = inventory;
  showInventoryForm.value = true;
};

const handleDeleteInventory = async (id: number) => {
  if (confirm('Êtes-vous sûr de vouloir supprimer cet état des lieux ?')) {
    try {
      await inventoriesStore.deleteInventory(id);
    } catch (error) {
      console.error('Failed to delete inventory:', error);
      alert('Erreur lors de la suppression de l\'état des lieux');
    }
  }
};

const handleViewDetails = (id: number) => {
  router.push(`/inventories/${id}`);
};

const handleFormSuccess = () => {
  inventoryToEdit.value = null;
  inventoriesStore.fetchInventories();
};
</script>

<template>
  <div class="view-container inventories-view">
    <!-- Header -->
    <header class="view-header">
      <div>
        <h1>États des lieux</h1>
        <div class="header-meta">
          {{ filteredInventories.length }} état{{ filteredInventories.length > 1 ? 's' : '' }} des lieux
        </div>
      </div>
      <div class="header-actions">
        <Button variant="primary" icon="plus" @click="handleNewInventory" data-testid="new-inventory-button">
          Nouvel état des lieux
        </Button>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-grid">
      <StatCard
        label="Total"
        :value="stats.total"
        icon="clipboard-list"
        icon-color="primary"
      />
      <StatCard
        label="États d'entrée"
        :value="stats.checkIn"
        icon="home-import-outline"
        icon-color="success"
      />
      <StatCard
        label="États de sortie"
        :value="stats.checkOut"
        icon="home-export-outline"
        icon-color="warning"
      />
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <label class="filter-label">Type</label>
        <div class="filter-buttons">
          <button
            class="filter-button"
            :class="{ active: typeFilter === 'all' }"
            @click="typeFilter = 'all'"
          >
            Tous
          </button>
          <button
            class="filter-button"
            :class="{ active: typeFilter === 'checkin' }"
            @click="typeFilter = 'checkin'"
          >
            Entrées
          </button>
          <button
            class="filter-button"
            :class="{ active: typeFilter === 'checkout' }"
            @click="typeFilter = 'checkout'"
          >
            Sorties
          </button>
        </div>
      </div>

      <div class="search-group">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Rechercher par propriété..."
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="inventoriesStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement des états des lieux...
    </div>

    <!-- Error State -->
    <div v-else-if="inventoriesStore.error" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      {{ inventoriesStore.error }}
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredInventories.length === 0" class="empty-state">
      <i class="mdi mdi-clipboard-list-outline"></i>
      <h3>Aucun état des lieux trouvé</h3>
      <p v-if="searchQuery || typeFilter !== 'all'">
        Essayez de modifier vos filtres de recherche
      </p>
      <p v-else>
        Commencez par créer votre premier état des lieux
      </p>
      <Button variant="primary" icon="plus" @click="handleNewInventory">
        Nouvel état des lieux
      </Button>
    </div>

    <!-- Inventories Grid -->
    <div v-else class="inventories-grid">
      <div
        v-for="inventory in filteredInventories"
        :key="inventory.id"
        class="inventory-card"
      >
        <div class="inventory-header">
          <Badge
            :variant="typeConfig(inventory.type).variant"
            :icon="typeConfig(inventory.type).icon"
          >
            {{ typeConfig(inventory.type).label }}
          </Badge>
          <span class="inventory-date">{{ formatDate(inventory.date) }}</span>
        </div>

        <div class="inventory-content">
          <h3 class="property-name">{{ getPropertyName(inventory.leaseId) }}</h3>
          <div class="tenant-name">
            <i class="mdi mdi-account"></i>
            {{ getTenantName(inventory.leaseId) }}
          </div>

          <div v-if="inventory.observations" class="observations">
            <i class="mdi mdi-text"></i>
            {{ inventory.observations.substring(0, 100) }}{{ inventory.observations.length > 100 ? '...' : '' }}
          </div>

          <div v-if="inventory.photos && inventory.photos.length > 0" class="photos-count">
            <i class="mdi mdi-camera"></i>
            {{ inventory.photos.length }} photo{{ inventory.photos.length > 1 ? 's' : '' }}
          </div>
        </div>

        <div class="inventory-actions">
          <Button
            variant="default"
            size="sm"
            icon="eye"
            @click="handleViewDetails(inventory.id!)"
            data-testid="view-inventory-button"
          >
            Voir
          </Button>
          <Button
            variant="default"
            size="sm"
            icon="pencil"
            @click="handleEditInventory(inventory)"
            data-testid="edit-inventory-button"
          >
            Modifier
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon="delete"
            @click="inventory.id && handleDeleteInventory(inventory.id)"
            data-testid="delete-inventory-button"
          >
            Supprimer
          </Button>
        </div>
      </div>
    </div>
  </div>

  <!-- Inventory Form Modal -->
  <InventoryFormModal
    v-model="showInventoryForm"
    :inventory="inventoryToEdit"
    @success="handleFormSuccess"
  />
</template>

<style scoped>
.inventories-view {
  padding: var(--space-6, 1.5rem);
}

.inventories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: var(--space-6, 1.5rem);
}

.inventory-card {
  background: white;
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  overflow: hidden;
  transition: all var(--transition-base, 0.2s ease);
}

.inventory-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
}

.inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  background: var(--neutral-50, #f9fafb);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.inventory-date {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
  font-weight: var(--font-weight-medium, 500);
}

.inventory-content {
  padding: var(--space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

.property-name {
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  margin: 0;
}

.tenant-name {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.tenant-name i {
  font-size: 1rem;
  color: var(--text-tertiary, #94a3b8);
}

.observations {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
  line-height: 1.5;
}

.observations i {
  font-size: 1rem;
  color: var(--text-tertiary, #94a3b8);
  margin-top: 0.125rem;
}

.photos-count {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--primary-600, #4f46e5);
  font-weight: var(--font-weight-medium, 500);
}

.photos-count i {
  font-size: 1rem;
}

.inventory-actions {
  padding: var(--space-4, 1rem) var(--space-6, 1.5rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  gap: var(--space-2, 0.5rem);
}

.search-group {
  flex: 1;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  font-size: var(--text-base, 1rem);
  color: var(--text-primary, #0f172a);
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  outline: none;
  transition: all var(--transition-base, 0.2s ease);
}

.search-input:focus {
  border-color: var(--primary-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

@media (max-width: 768px) {
  .inventories-grid {
    grid-template-columns: 1fr;
  }

  .inventory-actions {
    flex-wrap: wrap;
  }
}
</style>
