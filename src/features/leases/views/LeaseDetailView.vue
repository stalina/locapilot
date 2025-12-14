<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLeasesStore } from '../stores/leasesStore';
import { usePropertiesStore } from '../../properties/stores/propertiesStore';
import { useTenantsStore } from '../../tenants/stores/tenantsStore';
import Button from '@/shared/components/Button.vue';
import Badge from '@/shared/components/Badge.vue';
import Card from '@/shared/components/Card.vue';
import LeaseFormModal from '../components/LeaseFormModal.vue';
import ChargesAdjustmentTable from '../components/ChargesAdjustmentTable.vue';
import type { Tenant } from '@/db/schema';
import {
  prepareKeyHandoverAttestationData,
  generateKeyHandoverAttestation,
} from '@/shared/services/documentGenerator';

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

const statusConfig = computed(() => {
  if (!lease.value) return null;
  const configs = {
    active: { label: 'Actif', variant: 'success', icon: 'check-circle' },
    pending: { label: 'En attente', variant: 'warning', icon: 'clock-outline' },
    ended: { label: 'Terminé', variant: 'default', icon: 'flag-outline' },
  } as const;
  return configs[lease.value.status];
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

const handleGenerateKeyAttestation = async () => {
  if (!lease.value?.id) return;

  try {
    const data = await prepareKeyHandoverAttestationData(lease.value.id);
    await generateKeyHandoverAttestation(data);
  } catch (error) {
    console.error('Failed to generate key handover attestation:', error);
  }
};
</script>

<template>
  <div class="view-container lease-detail-view detail-view">
    <div v-if="leasesStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement du bail...
    </div>

    <div v-else-if="leasesStore.error || !lease" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      {{ leasesStore.error || 'Bail non trouvé' }}
      <Button variant="outline" icon="arrow-left" @click="goBack"> Retour à la liste </Button>
    </div>

    <template v-else>
      <header class="view-header">
        <div>
          <h1>Détail du bail</h1>
          <div class="header-meta">
            <Badge v-if="statusConfig" :variant="statusConfig.variant" :icon="statusConfig.icon">
              {{ statusConfig.label }}
            </Badge>
          </div>
        </div>
        <div class="header-actions">
          <Button variant="outline" icon="arrow-left" @click="goBack"> Retour </Button>
          <Button variant="outline" icon="pencil" @click="handleEdit"> Modifier </Button>
          <Button
            v-if="lease.status === 'active'"
            variant="warning"
            icon="close"
            @click="handleTerminate"
          >
            Terminer
          </Button>
          <Button variant="error" icon="delete" @click="handleDelete"> Supprimer </Button>
        </div>
      </header>

      <section class="hero-section">
        <div class="hero-image">
          <i class="mdi mdi-file-document-outline"></i>
        </div>
        <div class="hero-content">
          <div class="title-row">
            <h1>{{ property?.name || 'Propriété #' + lease.propertyId }}</h1>
            <Badge v-if="statusConfig" :variant="statusConfig.variant" :icon="statusConfig.icon">
              {{ statusConfig.label }}
            </Badge>
          </div>
          <div class="subtitle">
            <i class="mdi mdi-map-marker"></i>
            <span v-if="property?.postalCode || property?.town">
              {{ property.address }}<template v-if="property.address">, </template
              >{{ property.postalCode }} {{ property.town }}
            </span>
            <span v-else>{{ property?.address || 'Adresse non renseignée' }}</span>
          </div>
          <div class="hero-meta">
            <span>
              <i class="mdi mdi-account-multiple-outline"></i>
              {{ tenantsNames }}
            </span>
            <span>
              <i class="mdi mdi-calendar-range"></i>
              {{ formattedStartDate }} - {{ formattedEndDate }}
            </span>
            <span>
              <i class="mdi mdi-cash-multiple"></i>
              Paiement le {{ lease.paymentDay }} du mois
            </span>
          </div>
        </div>
      </section>

      <div class="content-grid">
        <div class="left-column">
          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-information"></i>
                Informations générales
              </h2>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Date de début</span>
                <span class="info-value">{{ formattedStartDate }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Date de fin</span>
                <span class="info-value">{{ formattedEndDate }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Jour de paiement</span>
                <span class="info-value">{{ lease.paymentDay }} du mois</span>
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

          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-currency-eur"></i>
                Informations financières
              </h2>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Loyer mensuel</span>
                <span class="info-value"> {{ lease.rent.toLocaleString('fr-FR') }} € </span>
              </div>
              <div class="info-item">
                <span class="info-label">Charges mensuelles</span>
                <span class="info-value"> {{ lease.charges.toLocaleString('fr-FR') }} € </span>
              </div>
              <div class="info-item">
                <span class="info-label">Total mensuel</span>
                <span class="info-value highlight">
                  {{ totalMonthlyAmount.toLocaleString('fr-FR') }} €
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Dépôt de garantie</span>
                <span class="info-value"> {{ lease.deposit.toLocaleString('fr-FR') }} € </span>
              </div>
            </div>
          </Card>

          <!-- Charges adjustment table -->
          <Card>
            <ChargesAdjustmentTable v-if="lease?.id" :leaseId="lease.id" />
          </Card>

          <Card v-if="lease?.documentId">
            <div class="card-header">
              <h2>
                <i class="mdi mdi-file-document"></i>
                Document
              </h2>
            </div>
            <Button
              variant="outline"
              icon="file-document"
              @click="() => lease && console.log('Voir document', lease.documentId)"
            >
              Voir le contrat de bail
            </Button>
          </Card>
        </div>

        <div class="right-column">
          <Card :clickable="!!property" :hover="!!property" @click="goToProperty">
            <div class="card-header">
              <h2>
                <i class="mdi mdi-home"></i>
                Bien associé
              </h2>
            </div>
            <template v-if="property">
              <div class="property-summary">
                <strong>{{ property.name }}</strong>
                <span class="property-subtitle">
                  <i class="mdi mdi-map-marker"></i>
                  <span v-if="property.postalCode || property.town">
                    {{ property.address }}<template v-if="property.address">, </template
                    >{{ property.postalCode }} {{ property.town }}
                  </span>
                  <span v-else>{{ property.address }}</span>
                </span>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Surface</span>
                  <span class="info-value">{{ property.surface }} m²</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Pièces</span>
                  <span class="info-value">{{ property.rooms }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Type</span>
                  <span class="info-value">{{ property.type }}</span>
                </div>
              </div>
            </template>
            <div v-else class="empty-placeholder">
              <i class="mdi mdi-home-off-outline"></i>
              <p>Propriété non trouvée</p>
            </div>
          </Card>

          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-account-multiple-outline"></i>
                Locataires
              </h2>
            </div>
            <div v-if="tenants.length" class="tenants-list">
              <div
                v-for="tenant in tenants"
                :key="tenant.id"
                class="tenant-item clickable"
                @click="tenant.id && goToTenant(tenant.id)"
              >
                <i class="mdi mdi-account-circle"></i>
                <div class="tenant-info">
                  <strong>{{ tenant.firstName }} {{ tenant.lastName }}</strong>
                  <span>{{ tenant.email }}</span>
                  <span>{{ tenant.phone || 'Téléphone non renseigné' }}</span>
                </div>
                <i class="mdi mdi-chevron-right"></i>
              </div>
            </div>
            <div v-else class="empty-placeholder">
              <i class="mdi mdi-account-off"></i>
              <p>Aucun locataire pour ce bail</p>
            </div>
          </Card>

          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-lightning-bolt"></i>
                Actions rapides
              </h2>
            </div>
            <div class="quick-actions">
              <Button variant="outline" icon="home" @click="goToProperty">
                Voir la propriété
              </Button>
              <Button variant="outline" icon="pencil" @click="handleEdit">
                Modifier le bail
              </Button>
              <Button
                variant="outline"
                icon="stop-circle"
                :disabled="lease.status !== 'active'"
                @click="handleTerminate"
              >
                Terminer le bail
              </Button>
              <Button variant="outline" icon="key" @click="handleGenerateKeyAttestation">
                Attestation remise des clés
              </Button>
            </div>
          </Card>

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

    <LeaseFormModal
      v-if="lease"
      v-model="showEditModal"
      :lease="lease"
      @success="handleEditSuccess"
    />
  </div>
</template>

<style scoped>
.property-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  margin-bottom: var(--space-4, 1rem);
}

.property-subtitle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 0.25rem);
  color: var(--text-secondary, #64748b);
}
</style>
