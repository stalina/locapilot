<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useLeasesStore } from '../stores/leasesStore';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import LeaseCard from '../components/LeaseCard.vue';
import LeaseFormModal from '../components/LeaseFormModal.vue';
import Button from '@/shared/components/Button.vue';
import SearchBox from '@/shared/components/SearchBox.vue';

const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();

const searchQuery = ref('');
const statusFilter = ref<'all' | 'active' | 'pending' | 'ended'>('all');
const showLeaseForm = ref(false);

onMounted(async () => {
  await Promise.all([
    leasesStore.fetchLeases(),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
  ]);
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

      const propertyMatch = property?.name.toLowerCase().includes(query) ||
                           property?.address.toLowerCase().includes(query);
      const tenantMatch = tenants.some(t => 
        t && (
          t.firstName.toLowerCase().includes(query) ||
          t.lastName.toLowerCase().includes(query) ||
          t.email.toLowerCase().includes(query)
        )
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
  showLeaseForm.value = true;
};

const handleFormSuccess = async () => {
  await leasesStore.fetchLeases();
};
</script>

<template>
  <div class="leases-view">
    <div class="view-header">
      <div class="header-title">
        <h1>Baux</h1>
        <p class="subtitle">Gérez vos contrats de location</p>
      </div>
      <Button @click="handleNewLease" variant="primary">
        Nouveau bail
      </Button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-label">Total</div>
      </div>
      <div class="stat-card active">
        <div class="stat-value">{{ stats.active }}</div>
        <div class="stat-label">Actifs</div>
      </div>
      <div class="stat-card pending">
        <div class="stat-value">{{ stats.pending }}</div>
        <div class="stat-label">En attente</div>
      </div>
      <div class="stat-card ended">
        <div class="stat-value">{{ stats.ended }}</div>
        <div class="stat-label">Terminés</div>
      </div>
      <div class="stat-card expiring" v-if="stats.expiring > 0">
        <div class="stat-value">{{ stats.expiring }}</div>
        <div class="stat-label">Expirent bientôt</div>
      </div>
    </div>

    <div class="filters-section">
      <SearchBox
        v-model="searchQuery"
        placeholder="Rechercher par propriété, locataire..."
      />

      <div class="filter-group">
        <label>Statut</label>
        <select v-model="statusFilter" class="filter-select">
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="pending">En attente</option>
          <option value="ended">Terminés</option>
        </select>
      </div>
    </div>

    <div class="leases-content">
      <div v-if="leasesStore.isLoading" class="loading-state">
        Chargement des baux...
      </div>

      <div v-else-if="leasesStore.error" class="error-state">
        {{ leasesStore.error }}
      </div>

      <div v-else-if="filteredLeases.length === 0" class="empty-state">
        <div class="empty-icon">📄</div>
        <h3>Aucun bail trouvé</h3>
        <p v-if="searchQuery || statusFilter !== 'all'">
          Essayez de modifier vos filtres
        </p>
        <p v-else>
          Commencez par créer votre premier bail
        </p>
        <Button @click="handleNewLease" variant="primary" v-if="!searchQuery && statusFilter === 'all'">
          Créer un bail
        </Button>
      </div>

      <div v-else class="leases-grid">
        <LeaseCard
          v-for="lease in filteredLeases"
          :key="lease.id"
          :lease="lease"
          :property-name="getPropertyName(lease.propertyId)"
          :tenant-names="getTenantNames(lease.tenantIds)"
        />
      </div>
    </div>

    <!-- Lease Form Modal -->
    <LeaseFormModal
      v-model="showLeaseForm"
      @success="handleFormSuccess"
    />
  </div>
</template>

<style scoped>
.leases-view {
  padding: var(--spacing-6);
  max-width: 1400px;
  margin: 0 auto;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-6);
}

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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-6);
}

.stat-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
  text-align: center;
}

.stat-card.active {
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.05);
}

.stat-card.pending {
  border-color: rgba(251, 146, 60, 0.3);
  background: rgba(251, 146, 60, 0.05);
}

.stat-card.ended {
  border-color: rgba(156, 163, 175, 0.3);
  background: rgba(156, 163, 175, 0.05);
}

.stat-card.expiring {
  border-color: rgba(250, 204, 21, 0.3);
  background: rgba(250, 204, 21, 0.05);
}

.stat-value {
  font-size: var(--text-3xl);
  font-weight: 700;
  color: var(--color-text);
  margin-bottom: var(--spacing-1);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filters-section {
  display: flex;
  gap: var(--spacing-4);
  margin-bottom: var(--spacing-6);
  flex-wrap: wrap;
}

.filters-section :deep(.search-box) {
  flex: 1;
  min-width: 300px;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.filter-group label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
}

.filter-select {
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.filter-select:hover {
  border-color: var(--color-primary);
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.leases-content {
  min-height: 400px;
}

.loading-state,
.error-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
}

.error-state {
  color: var(--color-error);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: var(--spacing-4);
  opacity: 0.5;
}

.empty-state h3 {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--spacing-2) 0;
}

.empty-state p {
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-4) 0;
}

.leases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: var(--spacing-4);
}

@media (max-width: 768px) {
  .leases-view {
    padding: var(--spacing-4);
  }

  .view-header {
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .filters-section {
    flex-direction: column;
  }

  .filters-section :deep(.search-box) {
    min-width: 100%;
  }

  .leases-grid {
    grid-template-columns: 1fr;
  }
}
</style>
