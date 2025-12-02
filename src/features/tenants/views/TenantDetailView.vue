<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTenantsStore } from '../stores/tenantsStore';
import { useLeasesStore } from '../../leases/stores/leasesStore';
import { usePropertiesStore } from '../../properties/stores/propertiesStore';
import Button from '../../../shared/components/Button.vue';
import TenantFormModal from '../components/TenantFormModal.vue';
import TenantDocumentsList from '../components/TenantDocumentsList.vue';

const route = useRoute();
const router = useRouter();
const tenantsStore = useTenantsStore();
const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();

const tenantId = computed(() => Number(route.params.id));
const tenant = computed(() => tenantsStore.currentTenant);
const showEditModal = ref(false);

const age = computed(() => {
  if (!tenant.value?.birthDate) return null;
  const today = new Date();
  const birth = new Date(tenant.value.birthDate);
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    years--;
  }
  return years;
});

const statusConfig = computed(() => {
  switch (tenant.value?.status) {
    case 'active':
      return { label: 'Actif', color: 'success' };
    case 'candidate':
      return { label: 'Candidat', color: 'accent' };
    case 'former':
      return { label: 'Ancien', color: 'error' };
    default:
      return { label: 'Inconnu', color: 'default' };
  }
});

// Baux liés à ce locataire
const tenantLeases = computed(() => {
  return leasesStore.leasesByTenant(tenantId.value);
});

// Bail actif
const activeLease = computed(() => {
  return tenantLeases.value.find(l => l.status === 'active');
});

// Propriété actuelle
const currentProperty = computed(() => {
  if (!activeLease.value) return null;
  return propertiesStore.properties.find(p => p.id === activeLease.value!.propertyId);
});

const goToLease = (leaseId: number) => {
  router.push(`/leases/${leaseId}`);
};

const goToProperty = (propertyId: number) => {
  router.push(`/properties/${propertyId}`);
};

function handleBack() {
  router.push('/tenants');
}

function handleEdit() {
  console.log('Edit tenant:', tenantId.value);
  showEditModal.value = true;
}

function handleEditSuccess() {
  showEditModal.value = false;
  // Rafraîchir les données du locataire
  tenantsStore.fetchTenantById(tenantId.value);
}

async function handleDelete() {
  if (!confirm('Êtes-vous sûr de vouloir supprimer ce locataire ?')) return;
  try {
    await tenantsStore.deleteTenant(tenantId.value);
    router.push('/tenants');
  } catch (error) {
    console.error('Failed to delete tenant:', error);
  }
}

onMounted(async () => {
  await Promise.all([
    tenantsStore.fetchTenantById(tenantId.value),
    leasesStore.fetchLeases(),
    propertiesStore.fetchProperties(),
  ]);
});

async function validateApplicant() {
  if (!tenant.value?.id) return;
  try {
    await tenantsStore.setTenantStatusWithAudit(tenant.value.id, 'validated', {
      actorId: null,
    });
  } catch (err) {
    console.error('Failed to validate applicant', err);
  }
}

async function refuseApplicant() {
  if (!tenant.value?.id) return;
  const reason = prompt('Raison du refus (facultatif)');
  try {
    await tenantsStore.setTenantStatusWithAudit(tenant.value.id, 'refused', {
      actorId: null,
      reason: reason || undefined,
    });
  } catch (err) {
    console.error('Failed to refuse applicant', err);
  }
}
</script>

<template>
  <div class="view-container tenant-detail-view">
    <!-- Header -->
    <header class="view-header">
      <Button variant="ghost" icon="arrow-left" @click="handleBack"> Retour </Button>
      <div class="header-actions">
        <Button variant="default" icon="pencil" @click="handleEdit"> Modifier </Button>
        <Button variant="error" icon="delete" @click="handleDelete"> Supprimer </Button>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="tenantsStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement du locataire...
    </div>

    <!-- Error State -->
    <div v-else-if="tenantsStore.error" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      {{ tenantsStore.error }}
    </div>

    <!-- Tenant Details -->
    <div v-else-if="tenant" class="tenant-details">
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="hero-avatar">
          <div class="avatar-gradient">
            <i class="mdi mdi-account-circle"></i>
          </div>
        </div>
        <div class="hero-info">
          <div class="hero-title-row">
            <h1>{{ tenant.firstName }} {{ tenant.lastName }}</h1>
            <span class="badge" :class="`badge-${statusConfig.color}`">
              {{ statusConfig.label }}
            </span>
          </div>
          <div class="hero-meta">
            <span v-if="age" class="meta-item">
              <i class="mdi mdi-calendar"></i>
              {{ age }} ans
            </span>
            <span class="meta-item">
              <i class="mdi mdi-email"></i>
              {{ tenant.email }}
            </span>
            <span v-if="tenant.phone" class="meta-item">
              <i class="mdi mdi-phone"></i>
              {{ tenant.phone }}
            </span>
          </div>
        </div>
      </section>

      <!-- Content Grid -->
      <div class="content-grid">
        <!-- Left Column -->
        <div class="left-column">
          <!-- General Info Card -->
          <div class="card">
            <h2 class="card-title">
              <i class="mdi mdi-information"></i>
              Informations générales
            </h2>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Prénom</span>
                <span class="info-value">{{ tenant.firstName }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Nom</span>
                <span class="info-value">{{ tenant.lastName }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Email</span>
                <span class="info-value">{{ tenant.email }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Téléphone</span>
                <span class="info-value">{{ tenant.phone || 'Non renseigné' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Date de naissance</span>
                <span class="info-value">
                  {{
                    tenant.birthDate
                      ? new Date(tenant.birthDate).toLocaleDateString('fr-FR')
                      : 'Non renseignée'
                  }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Statut</span>
                <span class="badge" :class="`badge-${statusConfig.color}`">
                  {{ statusConfig.label }}
                </span>
              </div>
            </div>
          </div>

          <!-- Notes Card -->
          <div v-if="tenant.notes" class="card">
            <h2 class="card-title">
              <i class="mdi mdi-note-text"></i>
              Notes
            </h2>
            <p class="notes-content">{{ tenant.notes }}</p>
          </div>

          <!-- Documents Card (moved from right column) -->
          <div class="card">
            <h2 class="card-title">
              <i class="mdi mdi-folder-multiple"></i>
              Documents
            </h2>
            <TenantDocumentsList v-if="tenant && tenant.id" :tenantId="tenant.id" />
          </div>
        </div>

        <!-- Right Column -->
        <div class="right-column">
          <!-- Current Property Card -->
          <div class="card" v-if="activeLease && currentProperty">
            <h2 class="card-title">
              <i class="mdi mdi-home"></i>
              Bien occupé
            </h2>
            <div
              class="property-item clickable"
              @click="currentProperty.id && goToProperty(currentProperty.id)"
            >
              <i class="mdi mdi-home-city"></i>
              <div class="property-info">
                <strong>{{ currentProperty.name }}</strong>
                <span>{{ currentProperty.address }}</span>
              </div>
              <i class="mdi mdi-chevron-right"></i>
            </div>
            <div class="lease-summary">
              <div class="summary-item">
                <span class="label">Loyer mensuel</span>
                <span class="value"
                  >{{ (activeLease.rent + activeLease.charges).toLocaleString('fr-FR') }} €</span
                >
              </div>
              <div class="summary-item">
                <span class="label">Début</span>
                <span class="value">{{
                  new Date(activeLease.startDate).toLocaleDateString('fr-FR')
                }}</span>
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
                variant="default"
                size="sm"
                @click="activeLease.id && goToLease(activeLease.id)"
                class="view-lease-btn"
              >
                <i class="mdi mdi-file-document"></i>
                Voir le bail
              </Button>
            </div>
          </div>

          <!-- Leases History -->
          <div class="card" v-if="tenantLeases.length > 0">
            <h2 class="card-title">
              <i class="mdi mdi-file-document-multiple"></i>
              Historique des baux
              <span class="badge">{{ tenantLeases.length }}</span>
            </h2>
            <div class="leases-list">
              <div
                v-for="lease in tenantLeases"
                :key="lease.id"
                :class="['lease-item clickable', lease.status]"
                @click="lease.id && goToLease(lease.id)"
              >
                <div class="lease-header">
                  <span :class="['status-badge', lease.status]">
                    {{
                      lease.status === 'active'
                        ? 'Actif'
                        : lease.status === 'pending'
                          ? 'En attente'
                          : 'Terminé'
                    }}
                  </span>
                  <span class="lease-date">{{
                    new Date(lease.startDate).toLocaleDateString('fr-FR')
                  }}</span>
                </div>
                <div class="lease-amount">{{ lease.rent.toLocaleString('fr-FR') }} € / mois</div>
                <i class="mdi mdi-chevron-right"></i>
              </div>
            </div>
          </div>

          <!-- Quick Actions Card -->
          <div class="card">
            <h2 class="card-title">
              <i class="mdi mdi-lightning-bolt"></i>
              Actions rapides
            </h2>
            <div class="quick-actions">
              <button class="action-button">
                <i class="mdi mdi-file-document"></i>
                <span>Baux</span>
              </button>
              <button class="action-button">
                <i class="mdi mdi-currency-eur"></i>
                <span>Loyers</span>
              </button>
              <button class="action-button">
                <i class="mdi mdi-folder"></i>
                <span>Documents</span>
              </button>
              <button class="action-button">
                <i class="mdi mdi-clipboard-check"></i>
                <span>États des lieux</span>
              </button>
            </div>

            <!-- Validation Actions for candidates -->
            <div class="card" v-if="tenant && tenant.status === 'candidate'">
              <h2 class="card-title">
                <i class="mdi mdi-account-check"></i>
                Validation de la candidature
              </h2>
              <div class="validation-actions">
                <Button variant="success" @click="validateApplicant">Valider</Button>
                <Button variant="error" @click="refuseApplicant">Refuser</Button>
              </div>
            </div>
          </div>

          <!-- Timeline Card -->
          <div class="card">
            <h2 class="card-title">
              <i class="mdi mdi-timeline"></i>
              Historique
            </h2>
            <div class="empty-placeholder">
              <i class="mdi mdi-timeline-clock"></i>
              <p>Aucun événement pour le moment</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Not Found State -->
    <div v-else class="error-state">
      <i class="mdi mdi-account-off"></i>
      Locataire non trouvé
    </div>

    <!-- Edit Modal -->
    <TenantFormModal
      v-if="tenant"
      v-model="showEditModal"
      :tenant="tenant"
      @success="handleEditSuccess"
    />
  </div>
</template>

<style scoped>
/* Styles spécifiques à la vue de détail d'un locataire */

/* Hero Section */
.hero-section {
  display: flex;
  align-items: flex-start;
  gap: var(--space-8, 2rem);
  padding: var(--space-8, 2rem);
  background: white;
  border-radius: var(--radius-2xl, 1.5rem);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  margin-bottom: var(--space-8, 2rem);
}

.hero-avatar {
  flex-shrink: 0;
}

.avatar-gradient {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-xl, 0 20px 25px rgba(0, 0, 0, 0.15));
}

.avatar-gradient i {
  font-size: 6rem;
  color: white;
}

.hero-info {
  flex: 1;
  padding-top: var(--space-4, 1rem);
}

.hero-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  margin-bottom: var(--space-4, 1rem);
}

.hero-title-row h1 {
  margin: 0;
  font-size: var(--text-4xl, 2.25rem);
  font-weight: var(--font-weight-bold, 700);
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6, 1.5rem);
  color: var(--text-secondary, #64748b);
  font-size: var(--text-base, 1rem);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.meta-item i {
  font-size: 1.25rem;
}

/* Content Grid spécifique à cette vue */
.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 1.5rem);
}

/* Info Grid */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-6, 1.5rem);
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}

.info-label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-tertiary, #94a3b8);
}

.info-value {
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #0f172a);
}

/* Notes */
.notes-content {
  margin: 0;
  line-height: 1.6;
  color: var(--text-secondary, #64748b);
  white-space: pre-wrap;
}

/* Property Item */
.property-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-3, 0.75rem);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  transition: all 0.2s ease;
  margin-bottom: var(--space-3, 0.75rem);
}

.property-item.clickable:hover {
  border-color: var(--primary-400, #818cf8);
  background: var(--primary-50, #eef2ff);
  cursor: pointer;
  transform: translateX(4px);
}

.property-item > i:first-child {
  font-size: 2rem;
  color: var(--primary-600, #4f46e5);
}

.property-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}

.property-info strong {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.property-info span {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.property-item > i:last-child {
  color: var(--text-tertiary, #94a3b8);
}

/* Lease Summary */
.lease-summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
  padding-top: var(--space-3, 0.75rem);
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
  margin-top: var(--space-2, 0.5rem);
}

/* Leases List */
.leases-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

.lease-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  position: relative;
  padding: var(--space-3, 0.75rem);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  transition: all 0.2s ease;
}

.lease-item.clickable:hover {
  border-color: var(--primary-400, #818cf8);
  background: var(--primary-50, #eef2ff);
  cursor: pointer;
  transform: translateX(4px);
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
  margin-bottom: var(--space-2, 0.5rem);
}

.status-badge {
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-weight-semibold, 600);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-badge.active {
  background: var(--success-100, #dcfce7);
  color: var(--success-700, #15803d);
}

.status-badge.pending {
  background: var(--warning-100, #fef3c7);
  color: var(--warning-700, #a16207);
}

.status-badge.ended {
  background: var(--gray-100, #f1f5f9);
  color: var(--gray-700, #334155);
}

.lease-date {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.lease-amount {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--primary-600, #4f46e5);
  padding-right: var(--space-8, 2rem);
}

/* Quick Actions spécifiques */
.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-6, 1.5rem);
  background: linear-gradient(135deg, var(--primary-50, #eef2ff), var(--primary-100, #e0e7ff));
  border: 1px solid var(--primary-200, #c7d2fe);
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
  font-family: inherit;
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--primary-600, #4f46e5);
}

.action-button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
}

.action-button i {
  font-size: 1.5rem;
}

/* Empty Placeholder */
.empty-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8, 2rem);
  text-align: center;
  gap: var(--space-2, 0.5rem);
}

.empty-placeholder i {
  font-size: 3rem;
  color: var(--text-tertiary, #94a3b8);
}

.empty-placeholder p {
  margin: 0;
  color: var(--text-secondary, #64748b);
}

/* Badge spécifique */
.badge-accent {
  background: linear-gradient(135deg, #ccfbf1, #99f6e4);
  color: #115e59;
}

/* Responsive */
@media (max-width: 768px) {
  .hero-section {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .hero-title-row {
    flex-direction: column;
    align-items: center;
  }

  .hero-meta {
    flex-direction: column;
    align-items: center;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
