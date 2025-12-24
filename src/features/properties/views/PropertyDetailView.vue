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
import RichTextEditor from '@/shared/components/RichTextEditor.vue';
import { formatAnnoncePlaceholders, defaultAnnonceTemplate } from '@/shared/utils/annonceTemplate';
import { useNotification } from '@/shared/composables/useNotification';
import { getPropertyTypeLabel } from '@/shared/utils/constants';
import PropertyFormModal from '../components/PropertyFormModal.vue';

const route = useRoute();
const router = useRouter();
const propertiesStore = usePropertiesStore();
const leasesStore = useLeasesStore();
const tenantsStore = useTenantsStore();

const propertyId = computed(() => Number(route.params.id));
const showEditModal = ref(false);
const isAnnonceEditing = ref(false);
const annonceDraft = ref('');
const { success: notifySuccess, error: notifyError } = useNotification();

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

// Locataires actuels (agrégés depuis tous les baux actifs de la propriété)
const currentTenants = computed(() => {
  // Collect all active leases for the property
  const activeLeases = propertyLeases.value.filter(l => l.status === 'active');
  if (activeLeases.length === 0) return [];

  // Aggregate tenantIds from all active leases and deduplicate
  const ids: number[] = [];
  activeLeases.forEach(l => {
    if (Array.isArray(l.tenantIds)) {
      l.tenantIds.forEach(id => {
        if (!ids.includes(id)) ids.push(id);
      });
    }
  });

  // Map to tenant records from tenantsStore
  return ids
    .map(id => tenantsStore.tenants.find(t => t.id === id))
    .filter((tenant): tenant is NonNullable<typeof tenant> => tenant !== undefined);
});

const goToLease = (leaseId: number) => {
  router.push(`/leases/${leaseId}`);
};

const goToTenant = (tenantId: number) => {
  router.push(`/tenants/${tenantId}`);
};

// Quick actions navigation
const goToLeasesList = () => {
  router.push({ path: '/leases', query: { propertyId: String(propertyId.value) } });
};

const goToRents = () => {
  router.push({ path: '/rents', query: { propertyId: String(propertyId.value) } });
};

const goToDocuments = () => {
  router.push({
    path: '/documents',
    query: { relatedEntityType: 'property', relatedEntityId: String(propertyId.value) },
  });
};

const goToInventories = () => {
  router.push({ path: '/inventories', query: { propertyId: String(propertyId.value) } });
};

onMounted(async () => {
  await Promise.all([
    propertiesStore.fetchPropertyById(propertyId.value),
    leasesStore.fetchLeases(),
    tenantsStore.fetchTenants(),
  ]);
  // initialize annonceDraft
  annonceDraft.value = propertiesStore.currentProperty?.annonce || '';
});

function startAnnonceEdit() {
  annonceDraft.value = propertiesStore.currentProperty?.annonce || '';
  isAnnonceEditing.value = true;
}

async function saveAnnonce() {
  if (!propertiesStore.currentProperty?.id) return;
  await propertiesStore.updateProperty(propertiesStore.currentProperty.id, {
    annonce: annonceDraft.value,
  });
  isAnnonceEditing.value = false;
}

function cancelAnnonceEdit() {
  annonceDraft.value = propertiesStore.currentProperty?.annonce || '';
  isAnnonceEditing.value = false;
}

async function copyAnnonce() {
  try {
    // Get source HTML or default template
    const rawHtml = propertiesStore.currentProperty?.annonce ?? defaultAnnonceTemplate();
    // Replace placeholders first
    const withPlaceholders = formatAnnoncePlaceholders(rawHtml, {
      LOYER: propertiesStore.currentProperty?.rent,
      CHARGES: propertiesStore.currentProperty?.charges,
      GARANTIE: propertiesStore.currentProperty?.deposit,
    });

    // Convert HTML to plain text while preserving line breaks
    function htmlToPlainText(html: string) {
      if (!html) return '';
      // remove script/style blocks
      const cleaned = html
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
      // replace <br> and closing block tags with newlines
      const withBreaks = cleaned
        .replace(/<br\s*\/*>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|table|section|article)>/gi, '\n')
        .replace(/<(\/)?td[^>]*>/gi, '\t');
      // strip remaining tags
      const stripped = withBreaks.replace(/<[^>]+>/g, '');
      // decode HTML entities
      const txt = document.createElement('textarea');
      txt.innerHTML = stripped;
      let decoded = txt.value;
      // Normalize line endings and collapse multiple blank lines
      decoded = decoded
        .replace(/\r/g, '')
        .split('\n')
        .map(l => l.trimEnd())
        .join('\n');
      decoded = decoded.replace(/\n{3,}/g, '\n\n').trim();
      return decoded;
    }

    const plain = htmlToPlainText(withPlaceholders);
    await navigator.clipboard.writeText(plain);
    notifySuccess('Annonce copiée dans le presse-papier');
  } catch (err) {
    console.error('Clipboard copy failed', err);
    notifyError?.("Impossible de copier l'annonce");
  }
}
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
            <span
              v-if="
                propertiesStore.currentProperty.postalCode || propertiesStore.currentProperty.town
              "
            >
              {{ propertiesStore.currentProperty.address
              }}<template v-if="propertiesStore.currentProperty.address">, </template
              >{{ propertiesStore.currentProperty.postalCode }}
              {{ propertiesStore.currentProperty.town }}
            </span>
            <span v-else>{{ propertiesStore.currentProperty.address }}</span>
          </div>
          <div class="type-label">
            {{ getPropertyTypeLabel(propertiesStore.currentProperty.type) }}
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
                  {{ getPropertyTypeLabel(propertiesStore.currentProperty.type) }}
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

          <!-- Annonce Type -->
          <Card>
            <div class="card-header annonce-header">
              <h2>
                <i class="mdi mdi-bullhorn"></i>
                Annonce type
              </h2>
              <div class="annonce-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  icon="content-copy"
                  @click="copyAnnonce"
                  title="Copier l'annonce"
                />
                <Button
                  variant="outline"
                  size="sm"
                  @click="startAnnonceEdit"
                  v-if="!isAnnonceEditing"
                >
                  Modifier
                </Button>
              </div>
            </div>

            <div class="card-body">
              <div v-if="isAnnonceEditing">
                <RichTextEditor v-model="annonceDraft" placeholder="Rédigez l'annonce type..." />
                <div class="actions-row">
                  <Button variant="outline" size="sm" @click="cancelAnnonceEdit">Annuler</Button>
                  <Button variant="primary" size="sm" @click="saveAnnonce">Enregistrer</Button>
                </div>
              </div>
              <div v-else>
                <RichTextDisplay
                  :content="
                    formatAnnoncePlaceholders(propertiesStore.currentProperty.annonce || '', {
                      LOYER: propertiesStore.currentProperty.rent,
                      CHARGES: propertiesStore.currentProperty.charges,
                      GARANTIE: propertiesStore.currentProperty.deposit,
                    })
                  "
                />
              </div>
            </div>
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
            <!-- lease-summary removed: duplicate of Leases History below -->
          </Card>

          <!-- Leases History -->
          <Card v-if="propertyLeases.length > 0">
            <div class="card-header leases-header">
              <h2>
                <i class="mdi mdi-file-document-multiple"></i>
                Historique des baux
              </h2>
              <div class="leases-count">
                <Badge variant="info">{{ propertyLeases.length }}</Badge>
              </div>
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
              <Button variant="outline" icon="file-document" @click="goToLeasesList">
                Voir les baux
              </Button>
              <Button variant="outline" icon="currency-eur" @click="goToRents">
                Voir les loyers
              </Button>
              <Button variant="outline" icon="file-multiple" @click="goToDocuments">
                Documents
              </Button>
              <Button variant="outline" icon="clipboard-check" @click="goToInventories">
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
.detail-view .annonce-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap;
}

.detail-view .annonce-header h2 {
  margin: 0;
  flex: 1 1 auto;
}

.detail-view .annonce-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex: 0 0 auto;
}

.detail-view .actions-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

/* Align lease count badge to the right of the leases header */
.leases-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.leases-header h2 {
  margin: 0;
  flex: 1 1 auto;
}

.leases-count {
  flex: 0 0 auto;
}
</style>
