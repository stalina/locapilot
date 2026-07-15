<script setup lang="ts">
import { ref, computed, onMounted, useTemplateRef } from 'vue';
import { useRoute } from 'vue-router';
import { useVirtualScroll } from '@/shared/composables/useVirtualScroll';
import { useRentsStore } from '../stores/rentsStore';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import { useSettingsStore } from '@/features/settings/stores/settingsStore';
import { useRemindersStore } from '@/features/reminders/stores/remindersStore';
import { computePendingReminders } from '@/features/reminders/services/remindersService';
import { useConfirm } from '@/shared/composables/useConfirm';
import Button from '@/shared/components/Button.vue';
import StatCard from '@/shared/components/StatCard.vue';
import Badge from '@/shared/components/Badge.vue';
import RentPaymentModal from '../components/RentPaymentModal.vue';
import RentFormModal from '../components/RentFormModal.vue';
import type { Rent, Lease } from '../../../db/types';
import {
  prepareRentReceiptData,
  generateRentReceipt,
  prepareReminderLetterData,
  generateReminderLetter,
  saveReminderLetterToDb,
  downloadBlob,
} from '@/shared/services/documentGenerator';

const rentsStore = useRentsStore();
const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();
const settingsStore = useSettingsStore();
const remindersStore = useRemindersStore();
const { confirm } = useConfirm();

const REMINDER_LEVEL_LABELS: Record<string, string> = {
  amiable: 'Relance amiable',
  recommandee: 'Relance recommandée',
  'mise-en-demeure': 'Mise en demeure',
};

// Filters
const route = useRoute();
const statusFilter = ref<'all' | 'pending' | 'paid' | 'late'>('all');
// const currentMonth = ref(new Date().getMonth());
// const currentYear = ref(new Date().getFullYear());

// Modals & selection
const showPaymentModal = ref(false);
const showEditModal = ref(false);
const selectedRentForModal = ref<Rent | null>(null);

// virtual rents are generated via the rents store helper

const initialFormData = ref<any>(null);

// edit flow handled via RentFormModal when needed

function openPaymentModal(rent: Rent) {
  selectedRentForModal.value = rent;
  showPaymentModal.value = true;
}

function getPropertyNameForLease(lease: Lease) {
  const property = propertiesStore.properties.find(p => p.id === lease.propertyId);
  return property?.name || 'Propriété inconnue';
}

function getTenantNameForLease(lease: Lease) {
  const tenant = tenantsStore.tenants.find(
    t => lease.tenantIds?.[0] && t.id === lease.tenantIds[0]
  );
  return tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Locataire inconnu';
}

function getLeaseById(id: number) {
  return leasesStore.leases.find(l => l.id === id) || null;
}

async function handleCreateAndOpenPayment(virtualRent: any) {
  try {
    // create actual rent
    const created = await rentsStore.createRentFromVirtual({
      leaseId: virtualRent.leaseId,
      dueDate: new Date(virtualRent.dueDate),
      amount: virtualRent.amount,
      charges: virtualRent.charges || 0,
    });

    // refresh store and open payment modal on created rent
    selectedRentForModal.value = created;
    showPaymentModal.value = true;
  } catch (err) {
    console.error('Failed to create rent from virtual:', err);
    alert('Erreur lors de la création du loyer');
  }
}

// note: edit button removed; edit flow kept via RentFormModal where needed

function handlePayClick(rent: any) {
  if (rent.isVirtual) {
    handleCreateAndOpenPayment(rent);
  } else {
    openPaymentModal(rent);
  }
}

async function handleUpdateRent(payload: any) {
  try {
    if (payload.id) {
      await rentsStore.updateRent(payload.id, {
        leaseId: payload.leaseId,
        dueDate: new Date(payload.dueDate),
        amount: payload.amount,
        charges: payload.charges,
        status: 'pending',
      });
    } else {
      await rentsStore.createRent({
        leaseId: payload.leaseId,
        dueDate: new Date(payload.dueDate),
        amount: payload.amount,
        charges: payload.charges,
        status: 'pending',
      });
    }
    showEditModal.value = false;
    initialFormData.value = null;
    selectedRentForModal.value = null;
  } catch (err) {
    console.error('Failed to save rent:', err);
    alert("Erreur lors de l'enregistrement du loyer");
  }
}

async function handlePayFromModal(data: any) {
  if (!selectedRentForModal.value?.id) return;
  try {
    await rentsStore.payRent(selectedRentForModal.value.id, new Date(data.paymentDate));
    showPaymentModal.value = false;
    selectedRentForModal.value = null;
  } catch (err) {
    console.error('Payment error:', err);
    alert('Erreur lors du paiement');
  }
}

onMounted(async () => {
  await Promise.all([
    rentsStore.fetchRents(),
    leasesStore.fetchLeases(),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
    settingsStore.loadSettings(),
    remindersStore.fetchReminders(),
  ]);
  // Apply propertyId filter if present in query
  const propertyIdQuery = route.query.propertyId ? Number(route.query.propertyId) : null;
  if (propertyIdQuery) {
    // Filter displayed rents by leases that belong to the property
    // We don't persist the filter state, just let computed displayedRents read route.query
  }
});

// Combine real rents with virtual pending rents for display
const displayedRents = computed(() => {
  const realRents = rentsStore.rents.map(r => ({ ...r, isVirtual: false }) as any);
  const virtual = rentsStore.generateVirtualRents(leasesStore.leases);

  let rents = [...realRents, ...virtual];

  // Filter by propertyId from route query if provided
  const propertyIdQuery = route.query.propertyId ? Number(route.query.propertyId) : null;
  if (propertyIdQuery) {
    rents = rents.filter((r: any) => {
      const lease = leasesStore.leases.find(l => l.id === r.leaseId);
      return lease && lease.propertyId === propertyIdQuery;
    });
  }

  // Filter by tenantId from route query if provided
  const tenantIdQuery = route.query.tenantId ? Number(route.query.tenantId) : null;
  if (tenantIdQuery) {
    rents = rents.filter((r: any) => {
      const lease = leasesStore.leases.find(l => l.id === r.leaseId);
      return lease && Array.isArray(lease.tenantIds) && lease.tenantIds.includes(tenantIdQuery);
    });
  }

  // Filter by status
  if (statusFilter.value !== 'all') {
    rents = rents.filter((r: any) => r.status === statusFilter.value);
  }

  return rents.sort(
    (a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
  );
});

// Viewport virtualization: only mount visible rows once the list grows large.
// Below the threshold the plain table is rendered exactly as before.
const RENT_ROW_HEIGHT = 78; // approx. rendered height of a table row (px)
const RENT_VIEWPORT_HEIGHT = 640; // fixed scroll container height when virtualized
const rentsScrollContainer = useTemplateRef<HTMLElement>('rentsScrollContainer');
const {
  isVirtual: isRentsVirtual,
  visibleItems: visibleRents,
  topSpacerHeight: rentsTopSpacer,
  bottomSpacerHeight: rentsBottomSpacer,
  onScroll: onRentsScroll,
} = useVirtualScroll<Rent & { isVirtual: boolean }>({
  items: displayedRents,
  itemHeight: RENT_ROW_HEIGHT,
  viewportHeight: RENT_VIEWPORT_HEIGHT,
  containerRef: rentsScrollContainer,
  // Reset scroll to top whenever a filter that changes the list is applied.
  resetKey: () =>
    `${statusFilter.value}|${route.query.propertyId ?? ''}|${route.query.tenantId ?? ''}`,
});

const stats = computed(() => ({
  total: rentsStore.rents.length,
  pending: rentsStore.pendingRents.length,
  paid: rentsStore.paidRents.length,
  late: rentsStore.overdueRents.length,
  totalPaid: rentsStore.totalPaidAmount,
  totalPending: rentsStore.totalPendingAmount,
  totalOverdue: rentsStore.totalOverdueAmount,
  paymentRate: rentsStore.paymentRate,
}));

const getPropertyName = (leaseId: number) => {
  const lease = leasesStore.leases.find(l => l.id === leaseId);
  if (!lease) return 'Propriété inconnue';
  const property = propertiesStore.properties.find(p => p.id === lease.propertyId);
  return property?.name || 'Propriété inconnue';
};

const getTenantName = (leaseId: number) => {
  const lease = leasesStore.leases.find(l => l.id === leaseId);
  if (!lease || !lease.tenantIds || lease.tenantIds.length === 0) return 'Locataire inconnu';
  const tenant = tenantsStore.tenants.find(t => t.id === lease.tenantIds[0]);
  return tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Locataire inconnu';
};

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const statusConfig = (status: Rent['status']) => {
  const configs = {
    paid: { variant: 'success' as const, label: 'Payé', icon: 'check-circle' },
    pending: { variant: 'warning' as const, label: 'En attente', icon: 'clock-outline' },
    late: { variant: 'error' as const, label: 'En retard', icon: 'alert-circle' },
    partial: { variant: 'info' as const, label: 'Partiel', icon: 'alert-outline' },
  };
  return configs[status] || configs.pending;
};

// (mark as paid moved to payment modal flow)

const handleGenerateReceipt = async (rent: Rent) => {
  if (!rent.id) return;

  try {
    const data = await prepareRentReceiptData(rent.id);
    await generateRentReceipt(data);
  } catch (error) {
    console.error('Failed to generate rent receipt:', error);
    alert('Erreur lors de la génération de la quittance');
  }
};

// Rent-arrears reminders (issue #40) — only real (persisted) rents are eligible
const pendingRemindersByRentId = computed(() => {
  const pending = computePendingReminders(
    rentsStore.rents,
    remindersStore.reminders,
    settingsStore.reminderThresholds
  );
  const byRentId: Record<number, (typeof pending)[number]> = {};
  for (const entry of pending) {
    if (entry.rent.id) byRentId[entry.rent.id] = entry;
  }
  return byRentId;
});

const handleSendReminder = async (rent: Rent) => {
  if (!rent.id) return;
  const pending = pendingRemindersByRentId.value[rent.id];
  if (!pending) return;

  const confirmed = await confirm({
    title: 'Envoyer une relance',
    message: `Générer et télécharger une lettre de "${REMINDER_LEVEL_LABELS[pending.level]}" pour ce loyer en retard de ${pending.daysLate} jour(s) ?`,
    confirmText: 'Générer et télécharger',
    cancelText: 'Annuler',
    type: 'warning',
  });
  if (!confirmed) return;

  try {
    const data = await prepareReminderLetterData(rent.id, pending.level);
    const { blob, filename } = await generateReminderLetter(data, pending.level);
    const documentId = await saveReminderLetterToDb(rent.id, pending.level, blob, filename);
    await remindersStore.recordReminderSent({
      rentId: rent.id,
      level: pending.level,
      thresholdDays: pending.thresholdDays,
      documentId,
      levelLabel: data.levelLabel,
      amountDue: data.amountDue,
      daysLate: data.daysLate,
    });
    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Failed to send reminder:', error);
    alert('Erreur lors de la génération de la relance');
  }
};
</script>

<template>
  <div class="view-container rents-view">
    <!-- Header -->
    <header class="view-header">
      <div>
        <h1>Gestion des Loyers</h1>
        <div class="header-meta">
          {{ displayedRents.length }} loyer{{ displayedRents.length > 1 ? 's' : '' }}
        </div>
      </div>
      <div class="header-actions">
        <Button variant="primary" icon="calendar" to="/rents/calendar"> Calendrier </Button>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-grid">
      <StatCard
        label="Total loyers"
        :value="stats.total"
        icon="currency-eur"
        icon-color="primary"
      />
      <StatCard
        label="Payés"
        :value="`${stats.paid} (${stats.totalPaid.toLocaleString('fr-FR')} €)`"
        icon="check-circle"
        icon-color="success"
      />
      <StatCard
        label="En attente"
        :value="`${stats.pending} (${stats.totalPending.toLocaleString('fr-FR')} €)`"
        icon="clock-outline"
        icon-color="warning"
      />
      <StatCard
        label="En retard"
        :value="`${stats.late} (${stats.totalOverdue.toLocaleString('fr-FR')} €)`"
        icon="alert-circle"
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
            :class="{ active: statusFilter === 'all' }"
            @click="statusFilter = 'all'"
          >
            Tous
          </button>
          <button
            class="filter-button"
            :class="{ active: statusFilter === 'pending' }"
            @click="statusFilter = 'pending'"
          >
            En attente
          </button>
          <button
            class="filter-button"
            :class="{ active: statusFilter === 'paid' }"
            @click="statusFilter = 'paid'"
          >
            Payés
          </button>
          <button
            class="filter-button"
            :class="{ active: statusFilter === 'late' }"
            @click="statusFilter = 'late'"
          >
            En retard
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="rentsStore.isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i>
      Chargement des loyers...
    </div>

    <!-- Error State -->
    <div v-else-if="rentsStore.error" class="error-state">
      <i class="mdi mdi-alert-circle"></i>
      {{ rentsStore.error }}
    </div>

    <!-- Empty State -->
    <div v-else-if="displayedRents.length === 0" class="empty-state">
      <i class="mdi mdi-currency-eur"></i>
      <h3>Aucun loyer trouvé</h3>
      <p v-if="statusFilter !== 'all'">Essayez de modifier vos filtres de recherche</p>
      <p v-else>Les loyers seront générés automatiquement à partir de vos baux actifs</p>
    </div>

    <!-- Suggested Rents (from active leases) -->
    <!-- Rents Table -->
    <div
      ref="rentsScrollContainer"
      class="rents-table-container"
      :class="{ 'is-virtual': isRentsVirtual }"
      data-testid="rents-scroll-container"
      @scroll="onRentsScroll"
    >
      <table class="rents-table">
        <thead>
          <tr>
            <th>Date d'échéance</th>
            <th>Propriété</th>
            <th>Locataire</th>
            <th>Montant</th>
            <th>Charges</th>
            <th>Statut</th>
            <th>Date de paiement</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="rentsTopSpacer > 0" class="virtual-spacer" aria-hidden="true">
            <td :colspan="8" :style="{ height: `${rentsTopSpacer}px`, padding: 0 }"></td>
          </tr>
          <tr
            v-for="{ item: rent } in visibleRents"
            :key="rent.id"
            class="rent-row"
            data-testid="rent-row"
          >
            <td class="date-cell">{{ formatDate(rent.dueDate) }}</td>
            <td class="property-cell">
              {{
                (() => {
                  const lease = getLeaseById(rent.leaseId);
                  return rent.isVirtual && lease
                    ? getPropertyNameForLease(lease)
                    : getPropertyName(rent.leaseId);
                })()
              }}
            </td>
            <td class="tenant-cell">
              {{
                (() => {
                  const lease = getLeaseById(rent.leaseId);
                  return rent.isVirtual && lease
                    ? getTenantNameForLease(lease)
                    : getTenantName(rent.leaseId);
                })()
              }}
            </td>
            <td class="amount-cell">{{ Number(rent.amount).toLocaleString('fr-FR') }} €</td>
            <td class="charges-cell">{{ Number(rent.charges || 0).toLocaleString('fr-FR') }} €</td>
            <td class="status-cell">
              <Badge
                :variant="statusConfig(rent.status).variant"
                :icon="statusConfig(rent.status).icon"
              >
                {{ statusConfig(rent.status).label }}
              </Badge>
            </td>
            <td class="payment-date-cell">
              {{ rent.paidDate ? formatDate(rent.paidDate) : '-' }}
            </td>
            <td class="actions-cell">
              <div class="action-buttons">
                <Button
                  v-if="rent.status !== 'paid'"
                  variant="success"
                  size="sm"
                  icon="currency-eur"
                  @click="() => handlePayClick(rent)"
                  >Payer</Button
                >
                <Button
                  v-if="rent.status === 'paid'"
                  variant="default"
                  size="sm"
                  icon="receipt"
                  @click="handleGenerateReceipt(rent)"
                  >Quittance</Button
                >
                <Button
                  v-if="rent.id && pendingRemindersByRentId[rent.id]"
                  variant="warning"
                  size="sm"
                  icon="bell-alert"
                  @click="() => handleSendReminder(rent)"
                  >{{ REMINDER_LEVEL_LABELS[pendingRemindersByRentId[rent.id!]!.level] }}</Button
                >
              </div>
            </td>
          </tr>
          <tr v-if="rentsBottomSpacer > 0" class="virtual-spacer" aria-hidden="true">
            <td :colspan="8" :style="{ height: `${rentsBottomSpacer}px`, padding: 0 }"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modals -->
    <RentFormModal
      v-if="showEditModal"
      v-model="showEditModal"
      :leases="leasesStore.leases"
      :properties="propertiesStore.properties"
      :tenants="tenantsStore.tenants"
      :initial="initialFormData"
      @submit="handleUpdateRent"
    />

    <RentPaymentModal
      v-if="showPaymentModal && selectedRentForModal"
      v-model="showPaymentModal"
      :rent="selectedRentForModal"
      :property-name="getPropertyName(selectedRentForModal?.leaseId)"
      :tenant-name="getTenantName(selectedRentForModal?.leaseId)"
      @submit="handlePayFromModal"
    />
  </div>
</template>

<style scoped>
.rents-view {
  padding: var(--space-6, 1.5rem);
}

.rents-table-container {
  background: white;
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  overflow: hidden;
}

/* When the list is large, the container becomes the scroll viewport so that
   only the visible rows are mounted (viewport virtualization). */
.rents-table-container.is-virtual {
  max-height: 640px;
  overflow-y: auto;
}

.rents-table-container.is-virtual thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--neutral-50, #f9fafb);
}

.rents-table {
  width: 100%;
  border-collapse: collapse;
}

.rents-table thead {
  background: var(--neutral-50, #f9fafb);
  border-bottom: 2px solid var(--border-color, #e2e8f0);
}

.rents-table th {
  padding: var(--space-4, 1rem);
  text-align: left;
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-secondary, #64748b);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.rents-table td {
  padding: var(--space-4, 1rem);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-primary, #0f172a);
}

.rent-row:hover {
  background: var(--neutral-50, #f9fafb);
}

.date-cell {
  font-weight: var(--font-weight-medium, 500);
}

.amount-cell {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--primary-600, #4f46e5);
}

.status-cell {
  text-align: center;
}

.actions-cell {
  text-align: right;
}

.action-buttons {
  display: flex;
  gap: var(--space-2, 0.5rem);
  justify-content: flex-end;
}

@media (max-width: 1024px) {
  .rents-table-container {
    overflow-x: auto;
  }

  .rents-table {
    min-width: 800px;
  }
}
</style>
