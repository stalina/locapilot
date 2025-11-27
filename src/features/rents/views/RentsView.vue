<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRentsStore } from '../stores/rentsStore';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import Button from '@/shared/components/Button.vue';
import StatCard from '@/shared/components/StatCard.vue';
import Badge from '@/shared/components/Badge.vue';
import type { Rent } from '../../../db/types';

const rentsStore = useRentsStore();
const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();

// Filters
const statusFilter = ref<'all' | 'pending' | 'paid' | 'late'>('all');
const currentMonth = ref(new Date().getMonth());
const currentYear = ref(new Date().getFullYear());

onMounted(async () => {
  await Promise.all([
    rentsStore.fetchRents(),
    leasesStore.fetchLeases(),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
  ]);
});

const filteredRents = computed(() => {
  let rents = rentsStore.rents;

  // Filter by status
  if (statusFilter.value !== 'all') {
    rents = rents.filter(r => r.status === statusFilter.value);
  }

  return rents.sort((a, b) => {
    // Sort by due date (most recent first)
    return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
  });
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
  };
  return configs[status] || configs.pending;
};

const handleMarkAsPaid = async (rent: Rent) => {
  if (!rent.id) return;
  try {
    await rentsStore.payRent(rent.id, new Date());
  } catch (error) {
    console.error('Failed to mark rent as paid:', error);
    alert('Erreur lors du marquage du loyer comme payé');
  }
};

const handleGenerateReceipt = async (rent: Rent) => {
  // TODO: Implémenter la génération de quittance
  alert('Fonctionnalité de génération de quittance à implémenter');
};
</script>

<template>
  <div class="view-container rents-view">
    <!-- Header -->
    <header class="view-header">
      <div>
        <h1>Gestion des Loyers</h1>
        <div class="header-meta">
          {{ filteredRents.length }} loyer{{ filteredRents.length > 1 ? 's' : '' }}
        </div>
      </div>
      <div class="header-actions">
        <Button variant="primary" icon="calendar" to="/rents/calendar">
          Calendrier
        </Button>
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
    <div v-else-if="filteredRents.length === 0" class="empty-state">
      <i class="mdi mdi-currency-eur"></i>
      <h3>Aucun loyer trouvé</h3>
      <p v-if="statusFilter !== 'all'">
        Essayez de modifier vos filtres de recherche
      </p>
      <p v-else>
        Les loyers seront générés automatiquement à partir de vos baux actifs
      </p>
    </div>

    <!-- Rents Table -->
    <div v-else class="rents-table-container">
      <table class="rents-table">
        <thead>
          <tr>
            <th>Date d'échéance</th>
            <th>Propriété</th>
            <th>Locataire</th>
            <th>Montant</th>
            <th>Statut</th>
            <th>Date de paiement</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rent in filteredRents" :key="rent.id" class="rent-row">
            <td class="date-cell">{{ formatDate(rent.dueDate) }}</td>
            <td class="property-cell">{{ getPropertyName(rent.leaseId) }}</td>
            <td class="tenant-cell">{{ getTenantName(rent.leaseId) }}</td>
            <td class="amount-cell">{{ rent.amount.toLocaleString('fr-FR') }} €</td>
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
                  icon="check"
                  @click="handleMarkAsPaid(rent)"
                  data-testid="mark-paid-button"
                >
                  Marquer payé
                </Button>
                <Button
                  v-if="rent.status === 'paid'"
                  variant="default"
                  size="sm"
                  icon="receipt"
                  @click="handleGenerateReceipt(rent)"
                  data-testid="generate-receipt-button"
                >
                  Quittance
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
