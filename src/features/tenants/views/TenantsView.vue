<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTenantsStore } from '../stores/tenantsStore';
import TenantCard from '@shared/components/TenantCard.vue';
import SearchBox from '@shared/components/SearchBox.vue';
import Button from '@shared/components/Button.vue';
import StatCard from '@shared/components/StatCard.vue';
import TenantFormModal from '../components/TenantFormModal.vue';

const router = useRouter();
const tenantsStore = useTenantsStore();

// Modals
const showTenantForm = ref(false);

// Filters
const searchQuery = ref('');
const filterStatus = ref<'all' | 'active' | 'candidate' | 'former'>('all');
const sortBy = ref<'name' | 'email'>('name');

// Computed
const filteredTenants = computed(() => {
  let result = [...tenantsStore.tenants];

  // Search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(
      t =>
        t.firstName.toLowerCase().includes(query) ||
        t.lastName.toLowerCase().includes(query) ||
        t.email.toLowerCase().includes(query)
    );
  }

  // Filter by status
  if (filterStatus.value !== 'all') {
    result = result.filter(t => t.status === filterStatus.value);
  }

  // Sort
  result.sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      case 'email':
        return a.email.localeCompare(b.email);
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

function handleTenantClick(id: string) {
  router.push(`/tenants/${id}`);
}

function handleNewTenant() {
  showTenantForm.value = true;
}

function handleFormSuccess() {
  tenantsStore.fetchTenants();
}

// Lifecycle
onMounted(async () => {
  await tenantsStore.fetchTenants();
});
</script>

<template>
  <div class="tenants-view">
    <!-- Header -->
    <header class="view-header">
      <div>
        <h1>Locataires</h1>
        <div class="header-meta">
          {{ filteredTenants.length }} locataire{{ filteredTenants.length > 1 ? 's' : '' }}
        </div>
      </div>
      <div class="header-actions">
        <SearchBox
          v-model="searchQuery"
          placeholder="Rechercher un locataire..."
          @search="handleSearch"
        />
        <Button variant="primary" icon="account-plus" @click="handleNewTenant">
          Nouveau locataire
        </Button>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-grid">
      <StatCard
        label="Total locataires"
        :value="tenantsStore.tenants.length"
        icon="account-group"
        icon-color="primary"
      />
      <StatCard
        label="Locataires actifs"
        :value="tenantsStore.activeTenants.length"
        icon="check-circle"
        icon-color="success"
      />
      <StatCard
        label="Candidats"
        :value="tenantsStore.candidateTenants.length"
        icon="account-clock"
        icon-color="accent"
      />
      <StatCard
        label="Anciens locataires"
        :value="tenantsStore.formerTenants.length"
        icon="account-off"
        icon-color="error"
      />
    </div>

    <!-- Filters -->
    <div class="filters">
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
            :class="{ active: filterStatus === 'active' }"
            @click="filterStatus = 'active'"
          >
            Actifs
          </button>
          <button
            class="filter-button"
            :class="{ active: filterStatus === 'candidate' }"
            @click="filterStatus = 'candidate'"
          >
            Candidats
          </button>
          <button
            class="filter-button"
            :class="{ active: filterStatus === 'former' }"
            @click="filterStatus = 'former'"
          >
            Anciens
          </button>
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-label">Trier par</label>
        <select v-model="sortBy" class="sort-select">
          <option value="name">Nom</option>
          <option value="email">Email</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="tenantsStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement des locataires...
    </div>

    <!-- Error State -->
    <div v-else-if="tenantsStore.error" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      {{ tenantsStore.error }}
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredTenants.length === 0" class="empty-state">
      <i class="mdi mdi-account-outline"></i>
      <h3>Aucun locataire trouvé</h3>
      <p v-if="searchQuery || filterStatus !== 'all'">
        Essayez de modifier vos filtres de recherche
      </p>
      <p v-else>Commencez par ajouter votre premier locataire</p>
      <Button variant="primary" icon="account-plus" @click="handleNewTenant">
        Nouveau locataire
      </Button>
    </div>

    <!-- Tenants Grid -->
    <div v-else class="tenants-grid">
      <TenantCard
        v-for="tenant in filteredTenants"
        :key="tenant.id"
        :tenant="tenant"
        @click="handleTenantClick"
      />
    </div>
  </div>
</template>

<style scoped>
.tenants-view {
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

.header-actions {
  display: flex;
  gap: var(--space-4, 1rem);
  align-items: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-6, 1.5rem);
  margin-bottom: var(--space-8, 2rem);
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
}

.filter-label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary, #64748b);
}

.filter-buttons {
  display: flex;
  gap: var(--space-2, 0.5rem);
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

.sort-select {
  padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
  font-size: var(--text-sm, 0.875rem);
  font-family: inherit;
  color: var(--text-primary, #0f172a);
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  outline: none;
  transition: all var(--transition-base, 0.2s ease);
}

.sort-select:focus {
  border-color: var(--primary-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.tenants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-6, 1.5rem);
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

  .header-actions {
    flex-direction: column;
  }

  .filters {
    flex-direction: column;
  }

  .tenants-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<!-- Tenant Form Modal -->
<TenantFormModal
  v-model="showTenantForm"
  @success="handleFormSuccess"
/>
