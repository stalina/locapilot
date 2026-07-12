<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useLeasesStore } from '../stores/leasesStore';
import { usePropertiesStore } from '../../properties/stores/propertiesStore';
import { useTenantsStore } from '../../tenants/stores/tenantsStore';
import { useDocumentsStore } from '../../documents/stores/documentsStore';
import { useConfirm } from '@/shared/composables/useConfirm';
import Button from '@/shared/components/Button.vue';
import Badge from '@/shared/components/Badge.vue';
import Card from '@/shared/components/Card.vue';
import LeaseFormModal from '../components/LeaseFormModal.vue';
import ChargesAdjustmentTable from '../components/ChargesAdjustmentTable.vue';
import RentRevisionCard from '@/features/indexation/components/RentRevisionCard.vue';
import CommunicationsTimeline from '@/features/communications/components/CommunicationsTimeline.vue';
import LeaseDocumentsList from '../components/LeaseDocumentsList.vue';
import type { Tenant } from '@/db/schema';
import { getPropertyTypeLabel } from '@/shared/utils/constants';
import {
  prepareKeyHandoverAttestationData,
  generateKeyHandoverAttestation,
  saveKeyHandoverAttestationToDb,
  prepareMandatLocationData,
  generateMandatLocation,
  saveMandatLocationToDb,
  prepareDepositReceptionData,
  generateDepositReceptionReceipt,
  saveDepositReceptionToDb,
  prepareDepositRestitutionData,
  generateDepositRestitutionDocument,
  saveDepositRestitutionToDb,
  downloadBlob,
} from '@/shared/services/documentGenerator';

const route = useRoute();
const router = useRouter();
const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();
const documentsStore = useDocumentsStore();
const { confirm } = useConfirm();

const showEditModal = ref(false);
const leaseId = Number(route.params.id);

onMounted(async () => {
  await Promise.all([
    leasesStore.fetchLeaseById(leaseId),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
    documentsStore.fetchDocuments(),
  ]);
});

const lease = computed(() => leasesStore.currentLease);

const property = computed(() => {
  if (!lease.value) return null;
  return propertiesStore.properties.find(p => p.id === lease.value!.propertyId) ?? null;
});

const propertyTypeLabel = computed(() => {
  if (!property.value) return '—';

  return getPropertyTypeLabel(property.value.type);
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

  const confirmed = await confirm({
    title: 'Supprimer le bail',
    message: 'Êtes-vous sûr de vouloir supprimer ce bail ?',
    type: 'danger',
    confirmText: 'Supprimer',
  });

  if (confirmed) {
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

  const confirmed = await confirm({
    title: 'Terminer le bail',
    message: 'Êtes-vous sûr de vouloir terminer ce bail ?',
    type: 'warning',
    confirmText: 'Terminer',
  });

  if (confirmed) {
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

// Computed pour vérifier si une attestation de remise des clés existe déjà pour ce bail
const existingKeyAttestationDocument = computed(() => {
  if (!lease.value?.id) return null;
  return documentsStore.documents.find(
    doc =>
      doc.type === 'lease' &&
      doc.relatedEntityType === 'lease' &&
      doc.relatedEntityId === lease.value!.id &&
      doc.description === 'Attestation de remise des clés'
  );
});

const handleGenerateKeyAttestation = async () => {
  if (!lease.value?.id) return;

  try {
    const data = await prepareKeyHandoverAttestationData(lease.value.id);
    const { blob, filename } = await generateKeyHandoverAttestation(data);

    // Demander à l'utilisateur s'il veut sauvegarder dans la base documentaire
    const shouldSave = await confirm({
      title: 'Sauvegarder l’attestation de remise des clés',
      message:
        'Voulez-vous sauvegarder cette attestation dans la base documentaire ? Vous pourrez la retrouver facilement dans la section Documents.',
      confirmText: 'Sauvegarder et télécharger',
      cancelText: 'Télécharger uniquement',
      type: 'info',
    });

    if (shouldSave) {
      // Sauvegarder dans la BDD
      await saveKeyHandoverAttestationToDb(lease.value.id, blob, filename);
      // Recharger les documents pour mettre à jour la liste
      await documentsStore.fetchDocuments();
    }

    // Télécharger dans tous les cas
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Failed to generate key handover attestation:', error);
  }
};

const handleDownloadExistingKeyAttestation = async () => {
  if (!existingKeyAttestationDocument.value?.id) return;

  try {
    await documentsStore.downloadDocument(existingKeyAttestationDocument.value.id);
  } catch (error) {
    console.error('Failed to download existing key attestation:', error);
  }
};

// Computed pour vérifier si un mandat existe déjà pour ce bail
const existingMandatDocument = computed(() => {
  if (!lease.value?.id) return null;
  return documentsStore.documents.find(
    doc =>
      doc.type === 'lease' &&
      doc.relatedEntityType === 'lease' &&
      doc.relatedEntityId === lease.value!.id &&
      doc.description === 'Mandat de location'
  );
});

const handleGenerateMandatLocation = async () => {
  if (!lease.value?.id) return;

  try {
    const data = await prepareMandatLocationData(lease.value.id);
    const { blob, filename } = await generateMandatLocation(data);

    // Demander à l'utilisateur s'il veut sauvegarder dans la base documentaire
    const shouldSave = await confirm({
      title: 'Sauvegarder le mandat de location',
      message:
        'Voulez-vous sauvegarder ce mandat dans la base documentaire ? Vous pourrez le retrouver facilement dans la section Documents.',
      confirmText: 'Sauvegarder et télécharger',
      cancelText: 'Télécharger uniquement',
      type: 'info',
    });

    if (shouldSave) {
      // Sauvegarder dans la BDD
      await saveMandatLocationToDb(lease.value.id, blob, filename);
      // Recharger les documents pour mettre à jour la liste
      await documentsStore.fetchDocuments();
    }

    // Télécharger dans tous les cas
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Failed to generate mandat de location:', error);
  }
};

const handleDownloadExistingMandat = async () => {
  if (!existingMandatDocument.value?.id) return;

  try {
    await documentsStore.downloadDocument(existingMandatDocument.value.id);
  } catch (error) {
    console.error('Failed to download existing mandat:', error);
  }
};

// ========== Dépôt de garantie : réception & restitution — issue #104 ==========

const toIsoDate = (d: Date | string): string => {
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatDate = (d: Date | string): string => new Date(d).toLocaleDateString('fr-FR');

const depositReceived = computed(() => !!lease.value?.depositReceivedDate);
const depositReturned = computed(() => !!lease.value?.depositReturnedDate);

const formattedDepositReceivedDate = computed(() =>
  lease.value?.depositReceivedDate ? formatDate(lease.value.depositReceivedDate) : ''
);
const formattedDepositReturnedDate = computed(() =>
  lease.value?.depositReturnedDate ? formatDate(lease.value.depositReturnedDate) : ''
);
const depositDeductions = computed(() => {
  if (!lease.value || typeof lease.value.depositReturnedAmount !== 'number') return 0;
  return Math.max(0, lease.value.deposit - lease.value.depositReturnedAmount);
});

const showReceptionForm = ref(false);
const receptionDateInput = ref(toIsoDate(new Date()));
const showRestitutionForm = ref(false);
const restitutionDateInput = ref(toIsoDate(new Date()));
const restitutionAmountInput = ref<number | null>(null);
const depositError = ref('');

const openReceptionForm = () => {
  depositError.value = '';
  receptionDateInput.value = lease.value?.depositReceivedDate
    ? toIsoDate(lease.value.depositReceivedDate)
    : toIsoDate(new Date());
  showReceptionForm.value = true;
};

const submitReception = async () => {
  if (!lease.value?.id) return;
  depositError.value = '';
  try {
    await leasesStore.recordDepositReception(lease.value.id, new Date(receptionDateInput.value));
    showReceptionForm.value = false;
  } catch (error) {
    depositError.value =
      error instanceof Error ? error.message : 'Échec de l’enregistrement de la réception';
  }
};

const openRestitutionForm = () => {
  if (!depositReceived.value) return;
  depositError.value = '';
  restitutionDateInput.value = lease.value?.depositReturnedDate
    ? toIsoDate(lease.value.depositReturnedDate)
    : toIsoDate(new Date());
  restitutionAmountInput.value =
    typeof lease.value?.depositReturnedAmount === 'number'
      ? lease.value.depositReturnedAmount
      : (lease.value?.deposit ?? null);
  showRestitutionForm.value = true;
};

const submitRestitution = async () => {
  if (!lease.value?.id) return;
  depositError.value = '';
  const amount = Number(restitutionAmountInput.value);
  try {
    await leasesStore.recordDepositRestitution(
      lease.value.id,
      new Date(restitutionDateInput.value),
      amount
    );
    showRestitutionForm.value = false;
  } catch (error) {
    depositError.value =
      error instanceof Error ? error.message : 'Échec de l’enregistrement de la restitution';
  }
};

// --- Documents de dépôt de garantie ---
const existingDepositReceptionDocument = computed(() => {
  if (!lease.value?.id) return null;
  return documentsStore.documents.find(
    doc =>
      doc.relatedEntityType === 'lease' &&
      doc.relatedEntityId === lease.value!.id &&
      doc.description === 'Reçu dépôt de garantie et 1er loyer'
  );
});

const existingDepositRestitutionDocument = computed(() => {
  if (!lease.value?.id) return null;
  return documentsStore.documents.find(
    doc =>
      doc.relatedEntityType === 'lease' &&
      doc.relatedEntityId === lease.value!.id &&
      doc.description === 'Restitution dépôt de garantie'
  );
});

const handleGenerateDepositReception = async () => {
  if (!lease.value?.id || !depositReceived.value) return;
  try {
    const data = await prepareDepositReceptionData(lease.value.id);
    const { blob, filename } = await generateDepositReceptionReceipt(data);

    const shouldSave = await confirm({
      title: 'Sauvegarder le reçu de dépôt de garantie',
      message:
        'Voulez-vous sauvegarder ce reçu dans la base documentaire ? Vous pourrez le retrouver facilement dans la section Documents.',
      confirmText: 'Sauvegarder et télécharger',
      cancelText: 'Télécharger uniquement',
      type: 'info',
    });

    if (shouldSave) {
      await saveDepositReceptionToDb(lease.value.id, blob, filename);
      await documentsStore.fetchDocuments();
    }

    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Failed to generate deposit reception receipt:', error);
  }
};

const handleDownloadExistingDepositReception = async () => {
  if (!existingDepositReceptionDocument.value?.id) return;
  try {
    await documentsStore.downloadDocument(existingDepositReceptionDocument.value.id);
  } catch (error) {
    console.error('Failed to download existing deposit reception receipt:', error);
  }
};

const handleGenerateDepositRestitution = async () => {
  if (!lease.value?.id || !depositReturned.value) return;
  try {
    const data = await prepareDepositRestitutionData(lease.value.id);
    const { blob, filename } = await generateDepositRestitutionDocument(data);

    const shouldSave = await confirm({
      title: 'Sauvegarder le document de restitution',
      message:
        'Voulez-vous sauvegarder ce document dans la base documentaire ? Vous pourrez le retrouver facilement dans la section Documents.',
      confirmText: 'Sauvegarder et télécharger',
      cancelText: 'Télécharger uniquement',
      type: 'info',
    });

    if (shouldSave) {
      await saveDepositRestitutionToDb(lease.value.id, blob, filename);
      await documentsStore.fetchDocuments();
    }

    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Failed to generate deposit restitution document:', error);
  }
};

const handleDownloadExistingDepositRestitution = async () => {
  if (!existingDepositRestitutionDocument.value?.id) return;
  try {
    await documentsStore.downloadDocument(existingDepositRestitutionDocument.value.id);
  } catch (error) {
    console.error('Failed to download existing deposit restitution document:', error);
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

          <!-- Dépôt de garantie : réception & restitution -->
          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-shield-lock-outline"></i>
                Dépôt de garantie
              </h2>
            </div>
            <div class="deposit-section" data-testid="deposit-section">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Montant du dépôt</span>
                  <span class="info-value">{{ lease.deposit.toLocaleString('fr-FR') }} €</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Réception</span>
                  <span class="info-value" data-testid="deposit-reception-status">
                    <template v-if="depositReceived">
                      Reçu le {{ formattedDepositReceivedDate }}
                    </template>
                    <template v-else>Non reçu</template>
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">Restitution</span>
                  <span class="info-value" data-testid="deposit-restitution-status">
                    <template v-if="depositReturned">
                      Restitué le {{ formattedDepositReturnedDate }} —
                      {{ (lease.depositReturnedAmount ?? 0).toLocaleString('fr-FR') }} €
                      <template v-if="depositDeductions > 0">
                        ({{ depositDeductions.toLocaleString('fr-FR') }} € retenus)
                      </template>
                    </template>
                    <template v-else>Non restitué</template>
                  </span>
                </div>
              </div>

              <p v-if="depositError" class="deposit-error" data-testid="deposit-error">
                {{ depositError }}
              </p>

              <div class="deposit-actions">
                <Button
                  variant="outline"
                  icon="check"
                  data-testid="deposit-mark-received"
                  @click="openReceptionForm"
                >
                  {{ depositReceived ? 'Modifier la réception' : 'Marquer comme reçu' }}
                </Button>
                <Button
                  variant="outline"
                  icon="cash-refund"
                  :disabled="!depositReceived"
                  :title="
                    !depositReceived
                      ? 'Le dépôt doit d’abord être marqué comme reçu'
                      : undefined
                  "
                  data-testid="deposit-record-restitution"
                  @click="openRestitutionForm"
                >
                  Enregistrer la restitution
                </Button>
              </div>
              <p v-if="!depositReceived" class="deposit-hint">
                La restitution est possible une fois le dépôt marqué comme reçu.
              </p>

              <!-- Formulaire de réception -->
              <div
                v-if="showReceptionForm"
                class="deposit-form"
                data-testid="deposit-reception-form"
              >
                <label class="deposit-field">
                  <span>Date de réception</span>
                  <input
                    v-model="receptionDateInput"
                    type="date"
                    data-testid="deposit-reception-date"
                  />
                </label>
                <div class="deposit-form-actions">
                  <Button variant="outline" @click="showReceptionForm = false">Annuler</Button>
                  <Button
                    variant="primary"
                    data-testid="deposit-reception-submit"
                    @click="submitReception"
                  >
                    Confirmer
                  </Button>
                </div>
              </div>

              <!-- Formulaire de restitution -->
              <div
                v-if="showRestitutionForm"
                class="deposit-form"
                data-testid="deposit-restitution-form"
              >
                <label class="deposit-field">
                  <span>Date de restitution</span>
                  <input
                    v-model="restitutionDateInput"
                    type="date"
                    data-testid="deposit-restitution-date"
                  />
                </label>
                <label class="deposit-field">
                  <span>Montant restitué (€)</span>
                  <input
                    v-model.number="restitutionAmountInput"
                    type="number"
                    min="0"
                    :max="lease.deposit"
                    step="0.01"
                    data-testid="deposit-restitution-amount"
                  />
                </label>
                <p class="deposit-hint">
                  Retenues estimées :
                  {{ Math.max(0, lease.deposit - (Number(restitutionAmountInput) || 0)).toLocaleString('fr-FR') }}
                  €
                </p>
                <div class="deposit-form-actions">
                  <Button variant="outline" @click="showRestitutionForm = false">Annuler</Button>
                  <Button
                    variant="primary"
                    data-testid="deposit-restitution-submit"
                    @click="submitRestitution"
                  >
                    Confirmer
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <!-- Charges adjustment table -->
          <Card>
            <ChargesAdjustmentTable v-if="lease?.id" :leaseId="lease.id" />
          </Card>

          <!-- Révision annuelle du loyer (IRL) -->
          <Card>
            <RentRevisionCard v-if="lease?.id" :leaseId="lease.id" @applied="handleEditSuccess" />
          </Card>

          <!-- Communications timeline -->
          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-message-text"></i>
                Communications
              </h2>
            </div>
            <CommunicationsTimeline
              v-if="lease?.id"
              related-entity-type="lease"
              :related-entity-id="lease.id"
              mode="lease-aggregate"
            />
          </Card>

          <Card>
            <div class="card-header">
              <h2>
                <i class="mdi mdi-file-document"></i>
                Documents
              </h2>
            </div>
            <LeaseDocumentsList v-if="lease?.id" :leaseId="lease.id" />
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
                  <span class="info-value">{{ propertyTypeLabel }}</span>
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
              <Button
                v-if="!existingKeyAttestationDocument"
                variant="outline"
                icon="key"
                @click="handleGenerateKeyAttestation"
              >
                Attestation remise des clés
              </Button>
              <Button
                v-else
                variant="outline"
                icon="download"
                @click="handleDownloadExistingKeyAttestation"
              >
                Télécharger l'attestation de clés
              </Button>
              <Button
                v-if="!existingMandatDocument"
                variant="outline"
                icon="file-document-edit"
                @click="handleGenerateMandatLocation"
              >
                Générer mandat de location
              </Button>
              <Button
                v-else
                variant="outline"
                icon="download"
                @click="handleDownloadExistingMandat"
              >
                Télécharger le mandat
              </Button>
              <Button
                v-if="!existingDepositReceptionDocument"
                variant="outline"
                icon="cash-check"
                :disabled="!depositReceived"
                :title="
                  !depositReceived ? 'Le dépôt doit d’abord être marqué comme reçu' : undefined
                "
                data-testid="deposit-reception-doc"
                @click="handleGenerateDepositReception"
              >
                Reçu dépôt de garantie et 1er loyer
              </Button>
              <Button
                v-else
                variant="outline"
                icon="download"
                @click="handleDownloadExistingDepositReception"
              >
                Télécharger le reçu de dépôt
              </Button>
              <Button
                v-if="!existingDepositRestitutionDocument"
                variant="outline"
                icon="cash-refund"
                :disabled="!depositReturned"
                :title="
                  !depositReturned ? 'La restitution doit d’abord être enregistrée' : undefined
                "
                data-testid="deposit-restitution-doc"
                @click="handleGenerateDepositRestitution"
              >
                Restitution dépôt de garantie
              </Button>
              <Button
                v-else
                variant="outline"
                icon="download"
                @click="handleDownloadExistingDepositRestitution"
              >
                Télécharger la restitution
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

.deposit-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

.deposit-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2, 0.5rem);
}

.deposit-hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary, #64748b);
}

.deposit-error {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-error, #dc2626);
}

.deposit-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-3, 0.75rem);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  background: var(--surface-secondary, #f8fafc);
}

.deposit-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  font-size: 0.85rem;
  color: var(--text-secondary, #64748b);
}

.deposit-field input {
  padding: var(--space-2, 0.5rem);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-sm, 0.375rem);
  font-size: 0.95rem;
  color: var(--text-primary, #0f172a);
  background: var(--surface-primary, #ffffff);
}

.deposit-form-actions {
  display: flex;
  gap: var(--space-2, 0.5rem);
  justify-content: flex-end;
}
</style>
