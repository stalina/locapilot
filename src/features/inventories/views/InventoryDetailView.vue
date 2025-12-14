<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useInventoriesStore } from '@/features/inventories/stores/inventoriesStore';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import Button from '@/shared/components/Button.vue';
import Badge from '@/shared/components/Badge.vue';
import Card from '@/shared/components/Card.vue';
import InventoryPhotoGallery from '@/shared/components/InventoryPhotoGallery.vue';
import InventoryFormModal from '@/features/inventories/components/InventoryFormModal.vue';
import type { Tenant } from '@/db/schema';

const route = useRoute();
const router = useRouter();
const inventoriesStore = useInventoriesStore();
const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();

const showEditModal = ref(false);
const inventoryId = Number(route.params.id);

onMounted(async () => {
  await Promise.all([
    inventoriesStore.fetchInventoryById(inventoryId),
    leasesStore.fetchLeases(),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
  ]);
});

const inventory = computed(() => inventoriesStore.currentInventory);

const lease = computed(() => {
  if (!inventory.value) return null;
  return leasesStore.leases.find(l => l.id === inventory.value!.leaseId) ?? null;
});

const property = computed(() => {
  if (!lease.value) return null;
  return propertiesStore.properties.find(p => p.id === lease.value!.propertyId) ?? null;
});

const tenants = computed(() => {
  if (!lease.value) return [];
  return lease.value.tenantIds
    .map(id => tenantsStore.tenants.find(t => t.id === id))
    .filter((tenant): tenant is Tenant => tenant !== undefined);
});

const tenantsNames = computed(() => {
  if (tenants.value.length === 0) {
    return 'Locataires non renseignés';
  }
  return tenants.value.map(t => `${t.firstName} ${t.lastName}`).join(', ');
});

const typeConfig = computed(() => {
  if (!inventory.value) return null;
  const configs = {
    checkin: {
      label: "État d'entrée",
      variant: 'success' as const,
      icon: 'home-import-outline',
    },
    checkout: {
      label: 'État de sortie',
      variant: 'warning' as const,
      icon: 'home-export-outline',
    },
  };
  return configs[inventory.value.type];
});

const formattedDate = computed(() => {
  if (!inventory.value) return '';
  return new Date(inventory.value.date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

const handleEdit = () => {
  showEditModal.value = true;
};

const handleEditSuccess = async () => {
  await inventoriesStore.fetchInventoryById(inventoryId);
};

const handleDelete = async () => {
  if (!inventory.value?.id) return;

  if (confirm('Êtes-vous sûr de vouloir supprimer cet état des lieux ?')) {
    try {
      await inventoriesStore.deleteInventory(inventory.value.id);
      router.push('/inventories');
    } catch (error) {
      console.error('Failed to delete inventory:', error);
    }
  }
};

const handleGoBack = () => {
  router.push('/inventories');
};
</script>

<template>
  <div class="view-container inventory-detail-view">
    <!-- Loading State -->
    <div v-if="inventoriesStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement...
    </div>

    <!-- Error State -->
    <div v-else-if="!inventory" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      État des lieux introuvable
      <Button variant="primary" @click="handleGoBack"> Retour à la liste </Button>
    </div>

    <!-- Content -->
    <div v-else>
      <!-- Header -->
      <header class="view-header">
        <div>
          <div class="breadcrumb">
            <button @click="handleGoBack" class="breadcrumb-link">
              <i class="mdi mdi-chevron-left"></i>
              États des lieux
            </button>
          </div>
          <h1>{{ typeConfig?.label }}</h1>
          <div class="header-meta">
            {{ property?.name || 'Propriété inconnue' }} • {{ formattedDate }}
          </div>
        </div>
        <div class="header-actions">
          <Button variant="default" icon="pencil" @click="handleEdit"> Modifier </Button>
          <Button variant="danger" icon="delete" @click="handleDelete"> Supprimer </Button>
        </div>
      </header>

      <!-- Main Info Card -->
      <Card class="info-card">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">
              <i class="mdi mdi-home"></i>
              Propriété
            </div>
            <div class="info-value">{{ property?.name || 'Non renseignée' }}</div>
            <div v-if="property?.address" class="info-sub">
              <span v-if="property.postalCode || property.town">
                {{ property.address }}<template v-if="property.address">, </template
                >{{ property.postalCode }} {{ property.town }}
              </span>
              <span v-else>{{ property.address }}</span>
            </div>
          </div>

          <div class="info-item">
            <div class="info-label">
              <i class="mdi mdi-account-multiple"></i>
              Locataire(s)
            </div>
            <div class="info-value">{{ tenantsNames }}</div>
          </div>

          <div class="info-item">
            <div class="info-label">
              <i class="mdi mdi-calendar"></i>
              Date
            </div>
            <div class="info-value">{{ formattedDate }}</div>
          </div>

          <div class="info-item">
            <div class="info-label">
              <i class="mdi mdi-tag"></i>
              Type
            </div>
            <div class="info-value">
              <Badge v-if="typeConfig" :variant="typeConfig.variant" :icon="typeConfig.icon">
                {{ typeConfig.label }}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <!-- Observations -->
      <Card v-if="inventory.observations" class="observations-card">
        <h2 class="card-title">
          <i class="mdi mdi-text"></i>
          Observations
        </h2>
        <p class="observations-text">{{ inventory.observations }}</p>
      </Card>

      <!-- Photos -->
      <Card class="photos-card">
        <h2 class="card-title">
          <i class="mdi mdi-camera"></i>
          Photos
        </h2>
        <InventoryPhotoGallery :inventory-id="inventoryId" :editable="true" :max-photos="20" />
      </Card>
    </div>

    <!-- Edit Modal -->
    <InventoryFormModal
      v-if="inventory"
      v-model="showEditModal"
      :inventory="inventory"
      @success="handleEditSuccess"
    />
  </div>
</template>

<style scoped>
.inventory-detail-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-6, 1.5rem);
}

.breadcrumb {
  margin-bottom: var(--space-2, 0.5rem);
}

.breadcrumb-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 0.25rem);
  color: var(--text-secondary, #64748b);
  font-size: var(--text-sm, 0.875rem);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color var(--transition-base, 0.2s ease);
}

.breadcrumb-link:hover {
  color: var(--primary-600, #4f46e5);
}

.breadcrumb-link i {
  font-size: 1.25rem;
}

.info-card {
  margin-bottom: var(--space-6, 1.5rem);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--space-6, 1.5rem);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.info-label {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary, #64748b);
}

.info-label i {
  font-size: 1.125rem;
  color: var(--text-tertiary, #94a3b8);
}

.info-value {
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.info-sub {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-tertiary, #94a3b8);
}

.observations-card {
  margin-bottom: var(--space-6, 1.5rem);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  margin: 0 0 var(--space-4, 1rem);
}

.card-title i {
  font-size: 1.5rem;
  color: var(--primary-600, #4f46e5);
}

.observations-text {
  font-size: var(--text-base, 1rem);
  line-height: 1.6;
  color: var(--text-secondary, #64748b);
  margin: 0;
  white-space: pre-wrap;
}

.photos-card {
  margin-bottom: var(--space-6, 1.5rem);
}

@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
