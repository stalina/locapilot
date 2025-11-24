<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import type { Lease } from '@/db/schema';

interface Props {
  lease: Lease;
  propertyName?: string;
  tenantNames?: string[];
}

const props = defineProps<Props>();
const router = useRouter();

const statusLabel = computed(() => {
  switch (props.lease.status) {
    case 'active': return 'Actif';
    case 'ended': return 'Terminé';
    case 'pending': return 'En attente';
    default: return props.lease.status;
  }
});

const statusClass = computed(() => {
  switch (props.lease.status) {
    case 'active': return 'status-active';
    case 'ended': return 'status-ended';
    case 'pending': return 'status-pending';
    default: return '';
  }
});

const formattedStartDate = computed(() => {
  return new Date(props.lease.startDate).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

const formattedEndDate = computed(() => {
  if (!props.lease.endDate) return 'Indéterminée';
  return new Date(props.lease.endDate).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
});

const totalMonthlyAmount = computed(() => {
  return (props.lease.rent || 0) + (props.lease.charges || 0);
});

const daysUntilExpiration = computed(() => {
  if (!props.lease.endDate || props.lease.status !== 'active') return null;
  
  const today = new Date();
  const endDate = new Date(props.lease.endDate);
  const diffTime = endDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
});

const expirationWarning = computed(() => {
  const days = daysUntilExpiration.value;
  if (days === null) return null;
  
  if (days < 0) return 'expired';
  if (days <= 30) return 'urgent';
  if (days <= 90) return 'warning';
  return null;
});

const handleClick = () => {
  if (props.lease.id) {
    router.push(`/leases/${props.lease.id}`);
  }
};
</script>

<template>
  <div class="lease-card" @click="handleClick">
    <div class="lease-card-header">
      <div class="lease-info">
        <h3 class="property-name">{{ propertyName || 'Propriété #' + lease.propertyId }}</h3>
        <div class="tenant-names" v-if="tenantNames && tenantNames.length">
          {{ tenantNames.join(', ') }}
        </div>
      </div>
      <span :class="['status-badge', statusClass]">{{ statusLabel }}</span>
    </div>

    <div class="lease-card-body">
      <div class="lease-dates">
        <div class="date-item">
          <span class="date-label">Début</span>
          <span class="date-value">{{ formattedStartDate }}</span>
        </div>
        <div class="date-separator">→</div>
        <div class="date-item">
          <span class="date-label">Fin</span>
          <span class="date-value">{{ formattedEndDate }}</span>
        </div>
      </div>

      <div class="lease-amounts">
        <div class="amount-item">
          <span class="amount-label">Loyer</span>
          <span class="amount-value">{{ (lease.rent || 0).toLocaleString('fr-FR') }} €</span>
        </div>
        <div class="amount-item">
          <span class="amount-label">Charges</span>
          <span class="amount-value">{{ (lease.charges || 0).toLocaleString('fr-FR') }} €</span>
        </div>
        <div class="amount-item total">
          <span class="amount-label">Total</span>
          <span class="amount-value">{{ totalMonthlyAmount.toLocaleString('fr-FR') }} €/mois</span>
        </div>
      </div>

      <div class="lease-details">
        <div class="detail-item">
          <span class="detail-label">Dépôt de garantie</span>
          <span class="detail-value">{{ (lease.deposit || 0).toLocaleString('fr-FR') }} €</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Paiement le</span>
          <span class="detail-value">{{ lease.paymentDay }} du mois</span>
        </div>
      </div>

      <div v-if="expirationWarning" :class="['expiration-warning', expirationWarning]">
        <span v-if="expirationWarning === 'expired'">⚠️ Bail expiré</span>
        <span v-else-if="expirationWarning === 'urgent'">
          ⏰ Expire dans {{ daysUntilExpiration }} jour{{ daysUntilExpiration! > 1 ? 's' : '' }}
        </span>
        <span v-else>
          📅 Expire dans {{ daysUntilExpiration }} jours
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lease-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-4);
  cursor: pointer;
  transition: all 0.2s ease;
}

.lease-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.lease-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--spacing-3);
  padding-bottom: var(--spacing-3);
  border-bottom: 1px solid var(--color-border);
}

.lease-info {
  flex: 1;
}

.property-name {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 var(--spacing-1) 0;
}

.tenant-names {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
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

.lease-card-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.lease-dates {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  background: var(--color-background);
  border-radius: var(--radius-sm);
}

.date-item {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.date-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-1);
}

.date-value {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
}

.date-separator {
  font-size: var(--text-lg);
  color: var(--color-text-secondary);
  margin: 0 var(--spacing-2);
}

.lease-amounts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-2);
}

.amount-item {
  display: flex;
  flex-direction: column;
}

.amount-item.total {
  grid-column: span 3;
  padding-top: var(--spacing-2);
  border-top: 1px solid var(--color-border);
}

.amount-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-1);
}

.amount-value {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
}

.amount-item.total .amount-value {
  font-size: var(--text-base);
  color: var(--color-primary);
}

.lease-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  background: var(--color-background);
  border-radius: var(--radius-sm);
}

.detail-item {
  display: flex;
  flex-direction: column;
}

.detail-label {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  margin-bottom: var(--spacing-1);
}

.detail-value {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
}

.expiration-warning {
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  text-align: center;
}

.expiration-warning.expired {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(220, 38, 38);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.expiration-warning.urgent {
  background: rgba(251, 146, 60, 0.1);
  color: rgb(234, 88, 12);
  border: 1px solid rgba(251, 146, 60, 0.2);
}

.expiration-warning.warning {
  background: rgba(250, 204, 21, 0.1);
  color: rgb(202, 138, 4);
  border: 1px solid rgba(250, 204, 21, 0.2);
}

@media (max-width: 640px) {
  .lease-amounts {
    grid-template-columns: 1fr;
  }

  .amount-item.total {
    grid-column: span 1;
  }

  .lease-details {
    grid-template-columns: 1fr;
  }

  .lease-dates {
    flex-direction: column;
    align-items: stretch;
  }

  .date-separator {
    transform: rotate(90deg);
    margin: var(--spacing-1) 0;
  }
}
</style>
