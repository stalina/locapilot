<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePropertiesStore } from '../stores/propertiesStore';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import Button from '@/shared/components/Button.vue';
import Badge from '@/shared/components/Badge.vue';
import Card from '@/shared/components/Card.vue';
import PhotoGallery from '@/shared/components/PhotoGallery.vue';
import RichTextDisplay from '@/shared/components/RichTextDisplay.vue';
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
  <div class="view-container property-detail detail-view">
    <!-- Loading State -->
    <div v-if="propertiesStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement...
    </div>

    <!-- Error State -->
    <div v-else-if="propertiesStore.error" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      <h3>{{ propertiesStore.error }}</h3>
      <Button variant="outline" icon="arrow-left" @click="handleBack"> Retour à la liste </Button>
    </div>

    <!-- Property Detail -->
    <template v-else-if="propertiesStore.currentProperty">
      <!-- Header -->
      <header class="view-header">
        <div>
          <h1>{{ propertiesStore.currentProperty.name }}</h1>
          <div class="header-meta">
            <Badge v-if="statusConfig" :variant="statusConfig.variant" :icon="statusConfig.icon">
              {{ statusConfig.label }}
            </Badge>
          </div>
        </div>
        <div class="header-actions">
          <Button variant="outline" icon="arrow-left" @click="handleBack"> Retour </Button>
          <Button variant="outline" icon="pencil" @click="handleEdit"> Modifier </Button>
          <Button variant="error" icon="delete" @click="handleDelete"> Supprimer </Button>
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
            <Badge v-if="statusConfig" :variant="statusConfig.variant" :icon="statusConfig.icon">
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
                <span class="info-value"> {{ propertiesStore.currentProperty.surface }} m² </span>
              </div>
              <div class="info-item">
                <span class="info-label">Nombre de pièces</span>
                <span class="info-value"> {{ propertiesStore.currentProperty.rooms }} pièces </span>
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
            <RichTextDisplay :content="propertiesStore.currentProperty.description" />
          </Card>

          <!-- Photos Gallery -->
          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-image-multiple"></i>
                Photos du logement
              </h2>
            </div>
            <PhotoGallery
              :property-id="propertyId"
              :editable="true"
              @update="() => propertiesStore.fetchPropertyById(propertyId)"
            />
          </Card>
        </div>

        <!-- Right Column: Related Data -->
        <div class="right-column">
          <!-- Current Tenant (if occupied) -->
          <Card v-if="activeLease && currentTenants.length > 0">
            <div class="card-header">
              <h2>
                <i class="mdi mdi-account"></i>
                Locataire{{ currentTenants.length > 1 ? 's' : '' }} actuel{{
                  currentTenants.length > 1 ? 's' : ''
                }}
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
                <span class="value"
                  >{{ (activeLease.rent + activeLease.charges).toLocaleString('fr-FR') }} €</span
                >
              </div>
              <div class="summary-item">
                <span class="label">Échéance</span>
                <span class="value">{{
                  activeLease.endDate
                    ? new Date(activeLease.endDate).toLocaleDateString('fr-FR')
                    : 'Indéterminée'
                }}</span>
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
                    :variant="
                      lease.status === 'active'
                        ? 'success'
                        : lease.status === 'pending'
                          ? 'warning'
                          : 'default'
                    "
                  >
                    {{
                      lease.status === 'active'
                        ? 'Actif'
                        : lease.status === 'pending'
                          ? 'En attente'
                          : 'Terminé'
                    }}
                  </Badge>
                  <span class="lease-date">{{
                    new Date(lease.startDate).toLocaleDateString('fr-FR')
                  }}</span>
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
              <Button variant="outline" icon="file-multiple" @click="() => {}"> Documents </Button>
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
