<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLeasesStore } from '../stores/leasesStore';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import Button from '@/shared/components/Button.vue';
import LeaseFormModal from '../components/LeaseFormModal.vue';
import type { Tenant } from '@/db/schema';

const route = useRoute();
const router = useRouter();
const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();

const showEditModal = ref(false);
const leaseId = Number(route.params.id);

onMounted(async () => {
  await Promise.all([
    leasesStore.fetchLeaseById(leaseId),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
  ]);
});

const lease = computed(() => leasesStore.currentLease);

const property = computed(() => {
  if (!lease.value) return null;
  return propertiesStore.properties.find(p => p.id === lease.value!.propertyId);
});

const tenants = computed(() => {
  if (!lease.value) return [];
  return lease.value.tenantIds
    .map(id => tenantsStore.tenants.find(t => t.id === id))
    .filter((tenant): tenant is Tenant => tenant !== undefined);
});

const statusLabel = computed(() => {
  if (!lease.value) return '';
  switch (lease.value.status) {
    case 'active': return 'Actif';
    case 'ended': return 'Terminé';
    case 'pending': return 'En attente';
    default: return lease.value.status;
  }
});

const statusClass = computed(() => {
  if (!lease.value) return '';
  switch (lease.value.status) {
    case 'active': return 'status-active';
    case 'ended': return 'status-ended';
    case 'pending': return 'status-pending';
    default: return '';
  }
});

const formattedStartDate = computed(() => {
  if (!lease.value) return '';
  return new Date(lease.value.startDate).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

const formattedEndDate = computed(() => {
  if (!lease.value?.endDate) return 'Indéterminée';
  return new Date(lease.value.endDate).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

const totalMonthlyAmount = computed(() => {
  if (!lease.value) return 0;
  return lease.value.rent + lease.value.charges;
});

const handleEdit = () => {
  showEditModal.value = true;
};

const handleEditSuccess = async () => {
  await leasesStore.fetchLeaseById(leaseId);
};

const handleDelete = async () => {
  if (!lease.value?.id) return;
  
  if (confirm('Êtes-vous sûr de vouloir supprimer ce bail ?')) {
    try {
      await leasesStore.deleteLease(lease.value.id);
      router.push('/leases');
    } catch (error) {
      console.error('Failed to delete lease:', error);
    }
  }
};

const handleTerminate = async () => {
  if (!lease.value?.id) return;
  
  if (confirm('Êtes-vous sûr de vouloir terminer ce bail ?')) {
    try {
      await leasesStore.terminateLease(lease.value.id);
    } catch (error) {
      console.error('Failed to terminate lease:', error);
    }
  }
};

const goBack = () => {
  router.push('/leases');
};

const goToProperty = () => {
  if (property.value?.id) {
    router.push(`/properties/${property.value.id}`);
  }
};

const goToTenant = (tenantId: number) => {
  router.push(`/tenants/${tenantId}`);
};
</script>

<template>
  <div class="view-container lease-detail-view">
    <div v-if="leasesStore.isLoading" class="loading-state">
      Chargement du bail...
    </div>

    <div v-else-if="leasesStore.error || !lease" class="error-state">
      {{ leasesStore.error || 'Bail non trouvé' }}
      <Button @click="goBack" variant="secondary">
        Retour à la liste
      </Button>
    </div>

    <div v-else class="lease-content">
      <div class="header-section">
        <Button @click="goBack" variant="text" class="back-button">
          ← Retour
        </Button>

        <div class="header-title">
          <div class="title-row">
            <h1>Bail {{ property?.name || '#' + lease.propertyId }}</h1>
            <span :class="['status-badge', statusClass]">{{ statusLabel }}</span>
          </div>
          <p class="subtitle">
            {{ tenants.map(t => `${t?.firstName} ${t?.lastName}`).join(', ') }}
          </p>
        </div>

        <div class="header-actions">
          <Button @click="handleEdit" variant="secondary">
            Modifier
          </Button>
          <Button 
            v-if="lease.status === 'active'" 
            @click="handleTerminate" 
            variant="warning"
          >
            Terminer
          </Button>
          <Button @click="handleDelete" variant="danger">
            Supprimer
          </Button>
        </div>
      </div>

      <div class="details-grid">
        <!-- Property Section -->
        <section class="detail-section">
          <h2>Propriété</h2>
          <div class="detail-card clickable" @click="goToProperty" v-if="property">
            <div class="card-header">
              <h3>{{ property.name }}</h3>
              <span class="link-icon">→</span>
            </div>
            <p class="card-subtitle">{{ property.address }}</p>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Type</span>
                <span class="value">{{ property.type }}</span>
              </div>
              <div class="info-item">
                <span class="label">Surface</span>
                <span class="value">{{ property.surface }} m²</span>
              </div>
              <div class="info-item">
                <span class="label">Pièces</span>
                <span class="value">{{ property.rooms }}</span>
              </div>
            </div>
          </div>
          <div v-else class="detail-card">
            <p class="empty-state">Propriété non trouvée</p>
          </div>
        </section>

        <!-- Tenants Section -->
        <section class="detail-section">
          <h2>Locataires</h2>
          <div class="tenants-list">
            <div 
              v-for="tenant in tenants" 
              :key="tenant.id"
              class="detail-card clickable"
              @click="tenant.id && goToTenant(tenant.id)"
            >
              <div class="card-header">
                <h3>{{ tenant.firstName }} {{ tenant.lastName }}</h3>
                <span class="link-icon">→</span>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">Email</span>
                  <span class="value">{{ tenant.email }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Téléphone</span>
                  <span class="value">{{ tenant.phone }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Dates Section -->
        <section class="detail-section">
          <h2>Période</h2>
          <div class="detail-card">
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Date de début</span>
                <span class="value">{{ formattedStartDate }}</span>
              </div>
              <div class="info-item">
                <span class="label">Date de fin</span>
                <span class="value">{{ formattedEndDate }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Financial Section -->
        <section class="detail-section">
          <h2>Informations financières</h2>
          <div class="detail-card">
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Loyer mensuel</span>
                <span class="value">{{ lease.rent.toLocaleString('fr-FR') }} €</span>
              </div>
              <div class="info-item">
                <span class="label">Charges</span>
                <span class="value">{{ lease.charges.toLocaleString('fr-FR') }} €</span>
              </div>
              <div class="info-item highlight">
                <span class="label">Total mensuel</span>
                <span class="value">{{ totalMonthlyAmount.toLocaleString('fr-FR') }} €</span>
              </div>
              <div class="info-item">
                <span class="label">Dépôt de garantie</span>
                <span class="value">{{ lease.deposit.toLocaleString('fr-FR') }} €</span>
              </div>
              <div class="info-item">
                <span class="label">Jour de paiement</span>
                <span class="value">{{ lease.paymentDay }} du mois</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Document Section (if exists) -->
        <section class="detail-section" v-if="lease?.documentId">
          <h2>Document</h2>
          <div class="detail-card">
            <Button variant="secondary" @click="() => lease && console.log('View document', lease.documentId)">
              Voir le contrat de bail
            </Button>
          </div>
        </section>
      </div>
    </div>

    <!-- Edit Lease Modal -->
    <LeaseFormModal
      v-if="lease"
      v-model="showEditModal"
      :lease="lease"
      @success="handleEditSuccess"
    />
  </div>
</template>

<style scoped>
/* Styles spécifiques à la vue de détail d'un bail */

.header-section {
  margin-bottom: var(--spacing-6);
}

.back-button {
  margin-bottom: var(--spacing-4);
}

.header-title {
  margin-bottom: var(--spacing-4);
}

.title-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  margin-bottom: var(--spacing-2);
}

.title-row h1 {
  font-size: var(--text-3xl);
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.status-badge {
  padding: var(--spacing-1) var(--spacing-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-active {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(22, 163, 74);
}

.status-ended {
  background: rgba(156, 163, 175, 0.1);
  color: rgb(107, 114, 128);
}

.status-pending {
  background: rgba(251, 146, 60, 0.1);
  color: rgb(234, 88, 12);
}

.subtitle {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: var(--spacing-3);
  flex-wrap: wrap;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: var(--spacing-6);
}

.detail-section h2 {
  font-size: var(--text-xl);
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--spacing-3) 0;
}

.detail-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
  transition: all 0.2s ease;
}

.detail-card.clickable {
  cursor: pointer;
}

.detail-card.clickable:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-2);
}

.card-header h3 {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.link-icon {
  font-size: var(--text-xl);
  color: var(--color-primary);
  transition: transform 0.2s ease;
}

.detail-card.clickable:hover .link-icon {
  transform: translateX(4px);
}

.card-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  margin: 0 0 var(--spacing-3) 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-3);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.info-item.highlight {
  grid-column: span 2;
  padding-top: var(--spacing-2);
  border-top: 1px solid var(--color-border);
}

.info-item .label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.info-item .value {
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--color-text);
}

.info-item.highlight .value {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-primary);
}

.tenants-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.empty-state {
  text-align: center;
  color: var(--color-text-secondary);
  margin: 0;
}

@media (max-width: 768px) {
  .lease-detail-view {
    padding: var(--spacing-4);
  }

  .details-grid {
    grid-template-columns: 1fr;
  }

  .header-actions {
    flex-direction: column;
  }

  .header-actions :deep(button) {
    width: 100%;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .info-item.highlight {
    grid-column: span 1;
  }
}
</style>
