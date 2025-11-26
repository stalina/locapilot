<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Rent } from '@/db/types';
import { useRentsStore } from '../stores/rentsStore';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import Calendar from '@shared/components/Calendar.vue';
import StatCard from '@shared/components/StatCard.vue';
import Button from '@shared/components/Button.vue';

const rentsStore = useRentsStore();
const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();

const selectedRent = ref<any>(null);
const showPaymentModal = ref(false);

// Calendar events
const calendarEvents = computed(() => {
  return rentsStore.rents.map((rent: Rent) => {
    const lease = leasesStore.leases.find(l => l.id === rent.leaseId);
    const property = lease ? propertiesStore.properties.find(p => p.id === lease.propertyId) : null;
    
    return {
      id: rent.id?.toString() || '',
      date: new Date(rent.dueDate),
      title: property?.name || 'Bien inconnu',
      status: rent.status,
      amount: rent.amount,
    };
  });
});

// Upcoming rents (next 30 days)
const upcomingRents = computed(() => {
  const today = new Date();
  const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  return rentsStore.rents
    .filter((rent: Rent) => {
      const dueDate = new Date(rent.dueDate);
      return dueDate >= today && dueDate <= next30Days && rent.status !== 'paid';
    })
    .sort((a: Rent, b: Rent) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);
});

// Methods
function getPropertyName(leaseId: number): string {
  const lease = leasesStore.leases.find(l => l.id === leaseId);
  if (!lease) return 'Bien inconnu';
  
  const property = propertiesStore.properties.find(p => p.id === lease.propertyId);
  return property?.name || 'Bien inconnu';
}

function getTenantName(leaseId: number): string {
  const lease = leasesStore.leases.find(l => l.id === leaseId);
  if (!lease || !lease.tenantIds.length) return 'Locataire inconnu';
  
  const tenant = tenantsStore.tenants.find(t => t.id === lease.tenantIds[0]);
  return tenant ? `${tenant.firstName} ${tenant.lastName}` : 'Locataire inconnu';
}

function handleDateClick(date: Date) {
  console.log('Date clicked:', date);
}

function handleEventClick(event: any) {
  const rent = rentsStore.rents.find((r: Rent) => r.id === Number(event.id));
  if (rent) {
    selectedRent.value = rent;
    showPaymentModal.value = true;
  }
}

function handleMonthChange(date: Date) {
  console.log('Month changed:', date);
}

async function handlePayRent(rentId: number) {
  try {
    await rentsStore.payRent(rentId);
    showPaymentModal.value = false;
    selectedRent.value = null;
  } catch (error) {
    console.error('Failed to pay rent:', error);
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case 'paid':
      return { label: 'Payé', color: 'success', icon: 'check-circle' };
    case 'pending':
      return { label: 'En attente', color: 'warning', icon: 'clock' };
    case 'late':
      return { label: 'En retard', color: 'error', icon: 'alert-circle' };
    default:
      return { label: 'Inconnu', color: 'default', icon: 'help-circle' };
  }
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function closeModal() {
  showPaymentModal.value = false;
  selectedRent.value = null;
}

// Lifecycle
onMounted(async () => {
  await Promise.all([
    rentsStore.fetchRents(),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
  ]);
});
</script>

<template>
  <div class="view-container rents-calendar-view">
    <!-- Header -->
    <header class="view-header">
      <div>
        <h1>Calendrier des loyers</h1>
        <div class="header-meta">
          Gérez vos échéances de paiement
        </div>
      </div>
      <Button variant="primary" icon="plus">
        Nouveau loyer
      </Button>
    </header>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <StatCard
        label="Total loyers"
        :value="rentsStore.rents.length"
        icon="currency-eur"
        icon-color="primary"
      />
      <StatCard
        label="Loyers payés"
        :value="`${rentsStore.totalPaidAmount.toLocaleString('fr-FR')}€`"
        icon="check-circle"
        icon-color="success"
        :subtitle="`${rentsStore.paidRents.length} paiements`"
      />
      <StatCard
        label="En attente"
        :value="`${rentsStore.totalPendingAmount.toLocaleString('fr-FR')}€`"
        icon="clock"
        icon-color="warning"
        :subtitle="`${rentsStore.pendingRents.length} loyers`"
      />
      <StatCard
        label="En retard"
        :value="`${rentsStore.totalOverdueAmount.toLocaleString('fr-FR')}€`"
        icon="alert-circle"
        icon-color="error"
        :subtitle="`${rentsStore.overdueRents.length} impayés`"
      />
    </div>

    <!-- Content Grid -->
    <div class="content-grid sidebar-right">
      <!-- Calendar -->
      <div class="calendar-section">
        <Calendar
          :events="calendarEvents"
          @date-click="handleDateClick"
          @event-click="handleEventClick"
          @month-change="handleMonthChange"
        />
      </div>

      <!-- Upcoming Rents Sidebar -->
      <div class="sidebar">
        <div class="card">
          <h2 class="card-title">
            <i class="mdi mdi-calendar-clock"></i>
            Prochaines échéances
          </h2>

          <!-- Loading State -->
          <div v-if="rentsStore.isLoading" class="loading-state">
            <i class="mdi mdi-loading mdi-spin"></i>
            Chargement...
          </div>

          <!-- Empty State -->
          <div v-else-if="upcomingRents.length === 0" class="empty-state">
            <i class="mdi mdi-calendar-check"></i>
            <p>Aucune échéance à venir</p>
          </div>

          <!-- Upcoming Rents List -->
          <div v-else class="upcoming-rents">
            <div
              v-for="rent in upcomingRents"
              :key="rent.id"
              class="rent-item"
              @click="handleEventClick({ id: rent.id })"
            >
              <div class="rent-info">
                <div class="rent-header">
                  <span class="rent-property">{{ getPropertyName(rent.leaseId) }}</span>
                  <span
                    class="rent-badge"
                    :class="`badge-${getStatusConfig(rent.status).color}`"
                  >
                    {{ getStatusConfig(rent.status).label }}
                  </span>
                </div>
                <div class="rent-meta">
                  <span class="rent-tenant">{{ getTenantName(rent.leaseId) }}</span>
                  <span class="rent-date">{{ formatDate(rent.dueDate) }}</span>
                </div>
              </div>
              <div class="rent-amount">
                {{ rent.amount.toLocaleString('fr-FR') }}€
              </div>
            </div>
          </div>
        </div>

        <!-- Legend -->
        <div class="card">
          <h2 class="card-title">
            <i class="mdi mdi-information"></i>
            Légende
          </h2>
          <div class="legend-items">
            <div class="legend-item">
              <span class="legend-badge badge-success"></span>
              <span>Payé</span>
            </div>
            <div class="legend-item">
              <span class="legend-badge badge-warning"></span>
              <span>En attente</span>
            </div>
            <div class="legend-item">
              <span class="legend-badge badge-error"></span>
              <span>En retard</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Modal -->
    <div v-if="showPaymentModal && selectedRent" class="modal-overlay" @click="closeModal">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Détails du loyer</h3>
          <button class="close-button" @click="closeModal">
            <i class="mdi mdi-close"></i>
          </button>
        </div>

        <div class="modal-body">
          <div class="info-row">
            <span class="info-label">Bien</span>
            <span class="info-value">{{ getPropertyName(selectedRent.leaseId) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Locataire</span>
            <span class="info-value">{{ getTenantName(selectedRent.leaseId) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Échéance</span>
            <span class="info-value">{{ formatDate(selectedRent.dueDate) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Montant</span>
            <span class="info-value amount">{{ selectedRent.amount.toLocaleString('fr-FR') }}€</span>
          </div>
          <div class="info-row">
            <span class="info-label">Statut</span>
            <span
              class="badge"
              :class="`badge-${getStatusConfig(selectedRent.status).color}`"
            >
              <i class="mdi" :class="`mdi-${getStatusConfig(selectedRent.status).icon}`"></i>
              {{ getStatusConfig(selectedRent.status).label }}
            </span>
          </div>
        </div>

        <div class="modal-footer">
          <Button variant="default" @click="closeModal">
            Fermer
          </Button>
          <Button
            v-if="selectedRent.status !== 'paid'"
            variant="success"
            icon="check"
            @click="handlePayRent(selectedRent.id)"
          >
            Marquer comme payé
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Styles spécifiques au calendrier des loyers */
.rents-calendar-view {
  max-width: 1600px;
}

.calendar-section {
  min-height: 600px;
}

.rent-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4, 1rem);
  background: var(--bg-secondary, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.rent-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  border-color: var(--primary-300, #a5b4fc);
}

.rent-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.rent-header {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.rent-property {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.rent-meta {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.rent-amount {
  font-size: var(--text-xl, 1.25rem);
  font-weight: var(--font-weight-bold, 700);
  color: var(--primary-600, #4f46e5);
}

.upcoming-rents {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.legend-badge {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-md, 0.5rem);
}

.legend-badge.badge-success {
  background: linear-gradient(135deg, #d1fae5, #a7f3d0);
  color: #065f46;
}

.legend-badge.badge-warning {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #92400e;
}

.legend-badge.badge-error {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  color: #991b1b;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4, 1rem);
}

.modal {
  background: white;
  border-radius: var(--radius-2xl, 1.5rem);
  box-shadow: var(--shadow-2xl, 0 25px 50px rgba(0, 0, 0, 0.25));
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-6, 1.5rem);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--text-2xl, 1.5rem);
  font-weight: var(--font-weight-bold, 700);
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  transition: background var(--transition-base, 0.2s ease);
  font-size: 1.25rem;
  color: var(--text-secondary, #64748b);
}

.close-button:hover {
  background: var(--bg-secondary, #f1f5f9);
}

.modal-body {
  padding: var(--space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3, 0.75rem);
  background: var(--bg-secondary, #f1f5f9);
  border-radius: var(--radius-lg, 0.75rem);
}

.info-label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary, #64748b);
}

.info-value {
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.info-value.amount {
  font-size: var(--text-xl, 1.25rem);
  color: var(--primary-600, #4f46e5);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-6, 1.5rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
}

@media (max-width: 1200px) {
  .sidebar {
    order: -1;
  }
}
</style>
