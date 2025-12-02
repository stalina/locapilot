<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useLeasesStore } from '../stores/leasesStore';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import LeaseCard from '../components/LeaseCard.vue';
import LeaseFormModal from '../components/LeaseFormModal.vue';
import Button from '@/shared/components/Button.vue';
import SearchBox from '@/shared/components/SearchBox.vue';
import StatCard from '@/shared/components/StatCard.vue';
import type { Lease } from '../../../db/types';

const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();

const route = useRoute();
const searchQuery = ref('');
const statusFilter = ref<'all' | 'active' | 'pending' | 'ended'>('all');
const showLeaseForm = ref(false);
const leaseToEdit = ref<Lease | null>(null);

onMounted(async () => {
  await Promise.all([
    leasesStore.fetchLeases(),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
  ]);
  // If route query contains propertyId, pre-fill search to that property filter
  const propertyIdQuery = route.query.propertyId ? Number(route.query.propertyId) : null;
  if (propertyIdQuery) {
    // Narrow results by propertyId by setting searchQuery to property name
    const prop = propertiesStore.properties.find(p => p.id === propertyIdQuery);
    if (prop) searchQuery.value = prop.name;
  }
});

const filteredLeases = computed(() => {
  let leases = leasesStore.leases;

  // Filter by status
  if (statusFilter.value !== 'all') {
    leases = leases.filter(l => l.status === statusFilter.value);
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    leases = leases.filter(lease => {
      const property = propertiesStore.properties.find(p => p.id === lease.propertyId);
      const tenants = lease.tenantIds
        .map(id => tenantsStore.tenants.find(t => t.id === id))
        .filter(Boolean);

      const propertyMatch =
        property?.name.toLowerCase().includes(query) ||
        property?.address.toLowerCase().includes(query);
      const tenantMatch = tenants.some(
        t =>
          t &&
          (t.firstName.toLowerCase().includes(query) ||
            t.lastName.toLowerCase().includes(query) ||
            t.email.toLowerCase().includes(query))
      );

      return propertyMatch || tenantMatch;
    });
  }

  return leases.sort((a, b) => {
    // Active first, then pending, then ended
    const statusOrder = { active: 0, pending: 1, ended: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;

    // Then by start date (newest first)
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });
});

const stats = computed(() => ({
  total: leasesStore.leases.length,
  active: leasesStore.activeLeases.length,
  pending: leasesStore.pendingLeases.length,
  ended: leasesStore.endedLeases.length,
  expiring: leasesStore.expiringLeases.length,
}));

const getPropertyName = (propertyId: number) => {
  const property = propertiesStore.properties.find(p => p.id === propertyId);
  return property?.name;
};

const getTenantNames = (tenantIds: number[]) => {
  if (!tenantIds || !Array.isArray(tenantIds)) {
    return [];
  }

  return tenantIds
    .map(id => {
      const tenant = tenantsStore.tenants.find(t => t.id === id);
      return tenant ? `${tenant.firstName} ${tenant.lastName}` : null;
    })
    .filter(Boolean) as string[];
};

const handleNewLease = () => {
  leaseToEdit.value = null;
  showLeaseForm.value = true;
};

const handleEditLease = (lease: Lease, event: Event) => {
  event.stopPropagation();
  leaseToEdit.value = lease;
  showLeaseForm.value = true;
};

const handleDeleteLease = async (id: number, event: Event) => {
  event.stopPropagation();
  if (confirm('Êtes-vous sûr de vouloir supprimer ce bail ?')) {
    try {
      await leasesStore.deleteLease(id);
    } catch (error) {
      console.error('Failed to delete lease:', error);
      alert('Erreur lors de la suppression du bail');
    }
  }
};

const handleFormSuccess = async () => {
  leaseToEdit.value = null;
  await leasesStore.fetchLeases();
};
</script>

<template>
  <div class="view-container leases-view">
    <!-- Header -->
    <header class="view-header">
      <div>
        <h1>Baux</h1>
        <div class="header-meta">
          {{ filteredLeases.length }} {{ filteredLeases.length > 1 ? 'baux' : 'bail' }}
        </div>
      </div>
      <div class="header-actions">
        <SearchBox v-model="searchQuery" placeholder="Rechercher par propriété, locataire..." />
        <Button variant="primary" icon="plus" @click="handleNewLease"> Nouveau bail </Button>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-grid">
      <StatCard label="Total" :value="stats.total" icon="file-document" icon-color="primary" />
      <StatCard label="Actifs" :value="stats.active" icon="check-circle" icon-color="success" />
      <StatCard
        label="En attente"
        :value="stats.pending"
        icon="clock-outline"
        icon-color="warning"
      />
      <StatCard label="Terminés" :value="stats.ended" icon="close-circle" icon-color="error" />
    </div>

    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <label class="filter-label">Statut</label>
        <div class="filter-buttons">
          <button
            class="filter-button"
            :class="{ active: statusFilter === 'all' }"
            @click="statusFilter = 'all'"
          >
            Tous
          </button>
          <button
            class="filter-button"
            :class="{ active: statusFilter === 'active' }"
            @click="statusFilter = 'active'"
          >
            Actifs
          </button>
          <button
            class="filter-button"
            :class="{ active: statusFilter === 'pending' }"
            @click="statusFilter = 'pending'"
          >
            En attente
          </button>
          <button
            class="filter-button"
            :class="{ active: statusFilter === 'ended' }"
            @click="statusFilter = 'ended'"
          >
            Terminés
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="leasesStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement des baux...
    </div>

    <!-- Error State -->
    <div v-else-if="leasesStore.error" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      {{ leasesStore.error }}
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredLeases.length === 0" class="empty-state">
      <i class="mdi mdi-file-document-outline"></i>
      <h3>Aucun bail trouvé</h3>
      <p v-if="searchQuery || statusFilter !== 'all'">
        Essayez de modifier vos filtres de recherche
      </p>
      <p v-else>Commencez par créer votre premier bail</p>
      <Button
        variant="primary"
        icon="plus"
        @click="handleNewLease"
        v-if="!searchQuery && statusFilter === 'all'"
      >
        Nouveau bail
      </Button>
    </div>

    <!-- Leases Grid -->
    <div v-else class="leases-grid">
      <LeaseCard
        v-for="lease in filteredLeases"
        :key="lease.id"
        :lease="lease"
        :property-name="getPropertyName(lease.propertyId)"
        :tenant-names="getTenantNames(lease.tenantIds)"
      >
        <template #actions>
          <Button
            variant="default"
            size="sm"
            icon="pencil"
            @click="handleEditLease(lease, $event)"
            data-testid="edit-lease-button"
          >
            Modifier
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon="delete"
            @click="lease.id && handleDeleteLease(lease.id, $event)"
            data-testid="delete-lease-button"
          >
            Supprimer
          </Button>
        </template>
      </LeaseCard>
    </div>

    <!-- Lease Form Modal -->
    <LeaseFormModal
      v-model="showLeaseForm"
      :lease="leaseToEdit ?? undefined"
      @success="handleFormSuccess"
    />
  </div>
</template>

<style scoped>
/* Grille spécifique pour les baux */
.leases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-6, 1.5rem);
}

/* Styles spécifiques aux baux uniquement */
.header-title h1 {
  font-size: var(--text-3xl);
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 var(--spacing-1) 0;
}

.subtitle {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  margin: 0;
}

.filters-section {
  display: flex;
  gap: var(--space-4, 1rem);
  margin-bottom: var(--space-8, 2rem);
  flex-wrap: wrap;
}

.filters-section :deep(.search-box) {
  flex: 1;
  min-width: 300px;
}

@media (max-width: 768px) {
  .leases-grid {
    grid-template-columns: 1fr;
  }

  .filters-section {
    flex-direction: column;
  }

  .filters-section :deep(.search-box) {
    min-width: 100%;
  }
}
</style>
