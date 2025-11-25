<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePropertiesStore } from '../stores/propertiesStore';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import Button from '@shared/components/Button.vue';
import Badge from '@shared/components/Badge.vue';
import Card from '@shared/components/Card.vue';
import PropertyFormModal from '../components/PropertyFormModal.vue';
import type { Property } from '@/db/types';

const route = useRoute();
const router = useRouter();
const propertiesStore = usePropertiesStore();
const leasesStore = useLeasesStore();
const tenantsStore = useTenantsStore();

const propertyId = computed(() => Number(route.params.id));
const showEditModal = ref(false);

const typeLabels: Record<Property['type'], string> = {
  apartment: 'Appartement',
  house: 'Maison',
  studio: 'Studio',
  commercial: 'Commercial',
  parking: 'Parking',
  other: 'Autre',
};

const statusConfig = computed(() => {
  if (!propertiesStore.currentProperty) return null;
  
  const configs = {
    occupied: { variant: 'success' as const, label: 'Occupé', icon: 'check-circle' },
    vacant: { variant: 'info' as const, label: 'Vacant', icon: 'home-outline' },
    maintenance: { variant: 'warning' as const, label: 'Maintenance', icon: 'wrench' },
  };
  return configs[propertiesStore.currentProperty.status];
});

function handleBack() {
  router.push('/properties');
}

function handleEdit() {
  showEditModal.value = true;
}

function handleDelete() {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette propriété ?')) {
    propertiesStore.deleteProperty(propertyId.value);
    router.push('/properties');
  }
}

function handleEditSuccess() {
  showEditModal.value = false;
  propertiesStore.fetchPropertyById(propertyId.value);
}

// Leases liés à cette propriété
const propertyLeases = computed(() => {
  return leasesStore.leasesByProperty(propertyId.value);
});

// Bail actif (si occupé)
const activeLease = computed(() => {
  return propertyLeases.value.find(l => l.status === 'active');
});

// Locataires actuels
const currentTenants = computed(() => {
  if (!activeLease.value) return [];
  return activeLease.value.tenantIds
    .map(id => tenantsStore.tenants.find(t => t.id === id))
    .filter((tenant): tenant is NonNullable<typeof tenant> => tenant !== undefined);
});

const goToLease = (leaseId: number) => {
  router.push(`/leases/${leaseId}`);
};

const goToTenant = (tenantId: number) => {
  router.push(`/tenants/${tenantId}`);
};

onMounted(async () => {
  await Promise.all([
    propertiesStore.fetchPropertyById(propertyId.value),
    leasesStore.fetchLeases(),
    tenantsStore.fetchTenants(),
  ]);
});
</script>

<template>
  <div class="property-detail">
    <!-- Loading State -->
    <div v-if="propertiesStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement...
    </div>

    <!-- Error State -->
    <div v-else-if="propertiesStore.error" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      <h3>{{ propertiesStore.error }}</h3>
      <Button variant="outline" icon="arrow-left" @click="handleBack">
        Retour à la liste
      </Button>
    </div>

    <!-- Property Detail -->
    <template v-else-if="propertiesStore.currentProperty">
      <!-- Header -->
      <header class="detail-header">
        <Button variant="outline" icon="arrow-left" @click="handleBack">
          Retour
        </Button>
        <div class="header-actions">
          <Button variant="outline" icon="pencil" @click="handleEdit">
            Modifier
          </Button>
          <Button variant="error" icon="delete" @click="handleDelete">
            Supprimer
          </Button>
        </div>
      </header>

      <!-- Hero Section -->
      <div class="hero-section">
        <div class="hero-image">
          <i class="mdi mdi-home-city"></i>
        </div>
        <div class="hero-content">
          <div class="title-row">
            <h1>{{ propertiesStore.currentProperty.name }}</h1>
            <Badge
              v-if="statusConfig"
              :variant="statusConfig.variant"
              :icon="statusConfig.icon"
            >
              {{ statusConfig.label }}
            </Badge>
          </div>
          <div class="subtitle">
            <i class="mdi mdi-map-marker"></i>
            {{ propertiesStore.currentProperty.address }}
          </div>
          <div class="type-label">
            {{ typeLabels[propertiesStore.currentProperty.type] }}
          </div>
        </div>
      </div>

      <!-- Content Grid -->
      <div class="content-grid">
        <!-- Left Column: Info -->
        <div class="left-column">
          <!-- General Info -->
          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-information"></i>
                Informations générales
              </h2>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Surface</span>
                <span class="info-value">
                  {{ propertiesStore.currentProperty.surface }} m²
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Nombre de pièces</span>
                <span class="info-value">
                  {{ propertiesStore.currentProperty.rooms }} pièces
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Loyer mensuel</span>
                <span class="info-value highlight">
                  {{ propertiesStore.currentProperty.rent.toLocaleString('fr-FR') }} €
                </span>
              </div>
              <div v-if="propertiesStore.currentProperty.charges" class="info-item">
                <span class="info-label">Charges</span>
                <span class="info-value">
                  {{ propertiesStore.currentProperty.charges.toLocaleString('fr-FR') }} €
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Type</span>
                <span class="info-value">
                  {{ typeLabels[propertiesStore.currentProperty.type] }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Statut</span>
                <Badge
                  v-if="statusConfig"
                  :variant="statusConfig.variant"
                  :icon="statusConfig.icon"
                >
                  {{ statusConfig.label }}
                </Badge>
              </div>
            </div>
          </Card>

          <!-- Description -->
          <Card v-if="propertiesStore.currentProperty.description">
            <div class="card-header">
              <h2>
                <i class="mdi mdi-text"></i>
                Description
              </h2>
            </div>
            <p class="description">
              {{ propertiesStore.currentProperty.description }}
            </p>
          </Card>
        </div>

        <!-- Right Column: Related Data -->
        <div class="right-column">
          <!-- Current Tenant (if occupied) -->
          <Card v-if="activeLease && currentTenants.length > 0">
            <div class="card-header">
              <h2>
                <i class="mdi mdi-account"></i>
                Locataire{{ currentTenants.length > 1 ? 's' : '' }} actuel{{ currentTenants.length > 1 ? 's' : '' }}
              </h2>
            </div>
            <div class="tenants-list">
              <div 
                v-for="tenant in currentTenants" 
                :key="tenant.id"
                class="tenant-item clickable"
                @click="tenant.id && goToTenant(tenant.id)"
              >
                <i class="mdi mdi-account-circle"></i>
                <div class="tenant-info">
                  <strong>{{ tenant.firstName }} {{ tenant.lastName }}</strong>
                  <span>{{ tenant.email }}</span>
                </div>
                <i class="mdi mdi-chevron-right"></i>
              </div>
            </div>
            <div class="lease-summary" v-if="activeLease">
              <div class="summary-item">
                <span class="label">Loyer mensuel</span>
                <span class="value">{{ (activeLease.rent + activeLease.charges).toLocaleString('fr-FR') }} €</span>
              </div>
              <div class="summary-item">
                <span class="label">Échéance</span>
                <span class="value">{{ activeLease.endDate ? new Date(activeLease.endDate).toLocaleDateString('fr-FR') : 'Indéterminée' }}</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                icon="file-document"
                @click="activeLease.id && goToLease(activeLease.id)"
                class="view-lease-btn"
              >
                Voir le bail
              </Button>
            </div>
          </Card>

          <!-- Leases History -->
          <Card v-if="propertyLeases.length > 0">
            <div class="card-header">
              <h2>
                <i class="mdi mdi-file-document-multiple"></i>
                Historique des baux
              </h2>
              <Badge variant="info">{{ propertyLeases.length }}</Badge>
            </div>
            <div class="leases-list">
              <div 
                v-for="lease in propertyLeases" 
                :key="lease.id"
                :class="['lease-item clickable', lease.status]"
                @click="lease.id && goToLease(lease.id)"
              >
                <div class="lease-header">
                  <Badge 
                    :variant="lease.status === 'active' ? 'success' : lease.status === 'pending' ? 'warning' : 'default'"
                  >
                    {{ lease.status === 'active' ? 'Actif' : lease.status === 'pending' ? 'En attente' : 'Terminé' }}
                  </Badge>
                  <span class="lease-date">{{ new Date(lease.startDate).toLocaleDateString('fr-FR') }}</span>
                </div>
                <div class="lease-amount">{{ lease.rent.toLocaleString('fr-FR') }} € / mois</div>
                <i class="mdi mdi-chevron-right"></i>
              </div>
            </div>
          </Card>

          <!-- Quick Actions -->
          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-lightning-bolt"></i>
                Actions rapides
              </h2>
            </div>
            <div class="quick-actions">
              <Button variant="outline" icon="file-document" @click="() => {}">
                Voir les baux
              </Button>
              <Button variant="outline" icon="currency-eur" @click="() => {}">
                Voir les loyers
              </Button>
              <Button variant="outline" icon="file-multiple" @click="() => {}">
                Documents
              </Button>
              <Button variant="outline" icon="clipboard-check" @click="() => {}">
                États des lieux
              </Button>
            </div>
          </Card>

          <!-- Timeline Placeholder -->
          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-history"></i>
                Historique
              </h2>
            </div>
            <div class="timeline-placeholder">
              <i class="mdi mdi-timeline-clock"></i>
              <p>Aucun événement pour le moment</p>
            </div>
          </Card>
        </div>
      </div>
    </template>

    <!-- Edit Modal -->
    <PropertyFormModal
      v-model="showEditModal"
      :property="propertiesStore.currentProperty"
      @success="handleEditSuccess"
    />
  </div>
</template>

<style scoped>
.property-detail {
  padding: var(--space-8, 2rem);
  max-width: 1400px;
  margin: 0 auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-8, 2rem);
}

.header-actions {
  display: flex;
  gap: var(--space-3, 0.75rem);
}

.hero-section {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: var(--space-8, 2rem);
  margin-bottom: var(--space-8, 2rem);
  padding: var(--space-8, 2rem);
  background: white;
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
}

.hero-image {
  height: 300px;
  background: linear-gradient(135deg, var(--primary-600, #4f46e5), var(--primary-700, #4338ca));
  border-radius: var(--radius-lg, 0.75rem);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero-image i {
  font-size: 6rem;
  color: rgba(255, 255, 255, 0.8);
}

.hero-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--space-4, 1rem);
}

.title-row {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
}

.title-row h1 {
  margin: 0;
  font-size: var(--text-3xl, 1.875rem);
  color: var(--text-primary, #0f172a);
}

.subtitle {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-lg, 1.125rem);
  color: var(--text-secondary, #64748b);
}

.subtitle i {
  font-size: 1.25rem;
  color: var(--text-tertiary, #94a3b8);
}

.type-label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-6, 1.5rem);
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 1.5rem);
}

.card-header {
  padding-bottom: var(--space-4, 1rem);
  border-bottom: 2px solid var(--border-color, #e2e8f0);
  margin-bottom: var(--space-4, 1rem);
}

.card-header h2 {
  margin: 0;
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
}

.card-header h2 i {
  color: var(--primary-600, #4f46e5);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4, 1rem);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}

.info-label {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.info-value {
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.info-value.highlight {
  color: var(--primary-600, #4f46e5);
  font-size: var(--text-lg, 1.125rem);
}

.description {
  margin: 0;
  line-height: 1.7;
  color: var(--text-secondary, #64748b);
}

.tenants-list,
.leases-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

.tenant-item,
.lease-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-3, 0.75rem);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  transition: all 0.2s ease;
}

.tenant-item.clickable:hover,
.lease-item.clickable:hover {
  border-color: var(--primary-400, #818cf8);
  background: var(--primary-50, #eef2ff);
  cursor: pointer;
  transform: translateX(4px);
}

.tenant-item > i:first-child {
  font-size: 2rem;
  color: var(--primary-600, #4f46e5);
}

.tenant-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}

.tenant-info strong {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.tenant-info span {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.lease-summary {
  margin-top: var(--space-4, 1rem);
  padding-top: var(--space-4, 1rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-item .label {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.summary-item .value {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.view-lease-btn {
  width: 100%;
}

.lease-item {
  flex-direction: column;
  align-items: stretch;
  position: relative;
}

.lease-item > i:last-child {
  position: absolute;
  right: var(--space-3, 0.75rem);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary, #94a3b8);
}

.lease-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.lease-date {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.lease-amount {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--primary-600, #4f46e5);
}

.tenant-placeholder,
.timeline-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8, 2rem);
  text-align: center;
  gap: var(--space-3, 0.75rem);
}

.tenant-placeholder i,
.timeline-placeholder i {
  font-size: 3rem;
  color: var(--text-tertiary, #94a3b8);
}

.tenant-placeholder p,
.timeline-placeholder p {
  margin: 0;
  color: var(--text-secondary, #64748b);
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16, 4rem);
  text-align: center;
  gap: var(--space-4, 1rem);
}

.loading-state i,
.error-state i {
  font-size: 4rem;
  color: var(--text-tertiary, #94a3b8);
}

.loading-state {
  color: var(--text-secondary, #64748b);
}

.error-state {
  color: var(--error-600, #dc2626);
}

.error-state h3 {
  margin: 0;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .hero-section {
    grid-template-columns: 1fr;
  }

  .hero-image {
    height: 200px;
  }
}

@media (max-width: 768px) {
  .detail-header {
    flex-direction: column;
    gap: var(--space-4, 1rem);
    align-items: stretch;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions button {
    flex: 1;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
