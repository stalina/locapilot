<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useTenantsStore } from '../stores/tenantsStore';
import TenantCard from '@/shared/components/TenantCard.vue';
import SearchBox from '@/shared/components/SearchBox.vue';
import Button from '@/shared/components/Button.vue';
import StatCard from '@/shared/components/StatCard.vue';
import TenantFormModal from '../components/TenantFormModal.vue';
import type { Tenant } from '../../../db/types';

const router = useRouter();
const tenantsStore = useTenantsStore();

// Modals
const showTenantForm = ref(false);
const tenantToEdit = ref<Tenant | null>(null);

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

function handleTenantClick(id: number) {
  router.push(`/tenants/${id}`);
}

function handleNewTenant() {
  console.log('[TenantsView] Opening tenant form modal');
  tenantToEdit.value = null;
  showTenantForm.value = true;
  console.log('[TenantsView] showTenantForm.value =', showTenantForm.value);
}

function handleEditTenant(tenant: Tenant, event: Event) {
  event.stopPropagation();
  tenantToEdit.value = tenant;
  showTenantForm.value = true;
}

async function handleDeleteTenant(id: number, event: Event) {
  event.stopPropagation();
  if (confirm('Êtes-vous sûr de vouloir supprimer ce locataire ?')) {
    try {
      await tenantsStore.deleteTenant(id);
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      alert('Erreur lors de la suppression du locataire');
    }
  }
}

function handleFormSuccess() {
  tenantToEdit.value = null;
  tenantsStore.fetchTenants();
}

// Lifecycle
onMounted(async () => {
  await tenantsStore.fetchTenants();
});
</script>

<template>
  <div class="view-container tenants-view">
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
        <Button
          variant="primary"
          icon="account-plus"
          @click="handleNewTenant"
          :testId="'new-tenant-button'"
        >
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
      <Button
        variant="primary"
        icon="account-plus"
        @click="handleNewTenant"
        :testId="'new-tenant-button'"
      >
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
      >
        <template #actions>
          <Button
            variant="default"
            size="sm"
            icon="pencil"
            @click="handleEditTenant(tenant, $event)"
            data-testid="edit-tenant-button"
          >
            Modifier
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon="delete"
            @click="tenant.id && handleDeleteTenant(tenant.id, $event)"
            data-testid="delete-tenant-button"
          >
            Supprimer
          </Button>
        </template>
      </TenantCard>
    </div>

    <!-- Tenant Form Modal -->
    <TenantFormModal v-model="showTenantForm" :tenant="tenantToEdit" @success="handleFormSuccess" />
  </div>
</template>

<style scoped>
/* Grille spécifique pour les locataires */
.tenants-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-6, 1.5rem);
}

@media (max-width: 768px) {
  .tenants-grid {
    grid-template-columns: 1fr;
  }
}
</style>
