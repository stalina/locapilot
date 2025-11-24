<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTenantsStore } from '../stores/tenantsStore';
import Button from '@shared/components/Button.vue';

const route = useRoute();
const router = useRouter();
const tenantsStore = useTenantsStore();

const tenantId = computed(() => route.params.id as string);
const tenant = computed(() => tenantsStore.currentTenant);

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

function handleBack() {
  router.push('/tenants');
}

function handleEdit() {
  console.log('Edit tenant:', tenantId.value);
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
  await tenantsStore.fetchTenantById(tenantId.value);
});
</script>

<template>
  <div class="tenant-detail-view">
    <!-- Header -->
    <header class="view-header">
      <Button variant="ghost" icon="arrow-left" @click="handleBack">
        Retour
      </Button>
      <div class="header-actions">
        <Button variant="default" icon="pencil" @click="handleEdit">
          Modifier
        </Button>
        <Button variant="error" icon="delete" @click="handleDelete">
          Supprimer
        </Button>
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
                  {{ tenant.birthDate ? new Date(tenant.birthDate).toLocaleDateString('fr-FR') : 'Non renseignée' }}
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
        </div>

        <!-- Right Column -->
        <div class="right-column">
          <!-- Current Property Card -->
          <div class="card">
            <h2 class="card-title">
              <i class="mdi mdi-home"></i>
              Bien occupé
            </h2>
            <div class="empty-placeholder">
              <i class="mdi mdi-home-search"></i>
              <p>Aucun bien associé</p>
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
  </div>
</template>

<style scoped>
.tenant-detail-view {
  padding: var(--space-8, 2rem);
  max-width: 1400px;
  margin: 0 auto;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-8, 2rem);
}

.header-actions {
  display: flex;
  gap: var(--space-4, 1rem);
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

/* Content Grid */
.content-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: var(--space-8, 2rem);
}

.left-column,
.right-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 1.5rem);
}

/* Card */
.card {
  background: white;
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  padding: var(--space-6, 1.5rem);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  font-size: var(--text-xl, 1.25rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  margin: 0 0 var(--space-6, 1.5rem);
}

.card-title i {
  font-size: 1.5rem;
  color: var(--primary-500, #6366f1);
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

/* Quick Actions */
.quick-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4, 1rem);
}

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

/* Badge */
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-semibold, 600);
  border-radius: var(--radius-full, 9999px);
  line-height: 1;
}

.badge-success {
  background: linear-gradient(135deg, #d1fae5, #a7f3d0);
  color: #065f46;
}

.badge-accent {
  background: linear-gradient(135deg, #ccfbf1, #99f6e4);
  color: #115e59;
}

.badge-error {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  color: #991b1b;
}

/* Responsive */
@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

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

  .quick-actions {
    grid-template-columns: 1fr;
  }
}
</style>
