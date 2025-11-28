<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import Badge from '@/shared/components/Badge.vue';
import { usePropertyPhotos } from '@/shared/composables/usePropertyPhotos';
import type { Lease } from '@/db/schema';

interface Props {
  lease: Lease;
  propertyName?: string;
  tenantNames?: string[];
}

const props = defineProps<Props>();
const router = useRouter();

const { getPrimaryPhoto, createPhotoUrl, revokePhotoUrl } = usePropertyPhotos();
const propertyPhotoUrl = ref<string | null>(null);

const statusConfig = computed(() => {
  const configs = {
    active: { variant: 'success' as const, label: 'Actif', icon: 'check-circle' },
    ended: { variant: 'error' as const, label: 'Terminé', icon: 'calendar-remove' },
    pending: { variant: 'warning' as const, label: 'En attente', icon: 'clock-outline' },
  };
  return configs[props.lease.status] || configs.pending;
});

const formattedStartDate = computed(() => {
  return new Date(props.lease.startDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
});

const formattedEndDate = computed(() => {
  if (!props.lease.endDate) return 'Indéterminée';
  return new Date(props.lease.endDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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

  if (days < 0) return { severity: 'expired', text: '⚠️ Bail expiré', icon: 'alert-circle' };
  if (days <= 30)
    return {
      severity: 'urgent',
      text: `Expire dans ${days} jour${days > 1 ? 's' : ''}`,
      icon: 'alarm',
    };
  if (days <= 90)
    return { severity: 'warning', text: `Expire dans ${days} jours`, icon: 'calendar-alert' };
  return null;
});

const handleClick = () => {
  if (props.lease.id) {
    router.push(`/leases/${props.lease.id}`);
  }
};

async function loadPropertyPhoto() {
  const photo = await getPrimaryPhoto(props.lease.propertyId);
  if (photo) {
    propertyPhotoUrl.value = createPhotoUrl(photo.data);
  }
}

onMounted(() => {
  loadPropertyPhoto();
});

onUnmounted(() => {
  if (propertyPhotoUrl.value) {
    revokePhotoUrl(propertyPhotoUrl.value);
  }
});
</script>

<template>
  <div class="lease-card" @click="handleClick">
    <!-- Header with photo or gradient -->
    <div class="lease-header">
      <img
        v-if="propertyPhotoUrl"
        :src="propertyPhotoUrl"
        :alt="propertyName || 'Propriété'"
        class="header-photo"
      />
      <div v-else class="header-overlay">
        <i class="mdi mdi-file-document-outline header-icon"></i>
      </div>
      <Badge :variant="statusConfig.variant" :icon="statusConfig.icon" class="status-badge">
        {{ statusConfig.label }}
      </Badge>
    </div>

    <!-- Content -->
    <div class="lease-content">
      <div class="lease-title">
        <h3 class="property-name">{{ propertyName || 'Propriété #' + lease.propertyId }}</h3>
        <div v-if="tenantNames && tenantNames.length" class="tenant-names">
          <i class="mdi mdi-account"></i>
          {{ tenantNames.join(', ') }}
        </div>
      </div>

      <div class="lease-dates">
        <div class="date-row">
          <i class="mdi mdi-calendar-start"></i>
          <span class="date-label">Début :</span>
          <span class="date-value">{{ formattedStartDate }}</span>
        </div>
        <div class="date-row">
          <i class="mdi mdi-calendar-end"></i>
          <span class="date-label">Fin :</span>
          <span class="date-value">{{ formattedEndDate }}</span>
        </div>
      </div>

      <div class="lease-financials">
        <div class="financial-item">
          <i class="mdi mdi-currency-eur"></i>
          <span>{{ (lease.rent || 0).toLocaleString('fr-FR') }} €</span>
        </div>
        <div class="financial-item">
          <i class="mdi mdi-home-city-outline"></i>
          <span>{{ (lease.charges || 0).toLocaleString('fr-FR') }} €</span>
        </div>
        <div class="financial-item total">
          <i class="mdi mdi-cash-multiple"></i>
          <span>{{ totalMonthlyAmount.toLocaleString('fr-FR') }} €/mois</span>
        </div>
      </div>

      <div
        v-if="expirationWarning"
        :class="['expiration-alert', `alert-${expirationWarning.severity}`]"
      >
        <i :class="`mdi mdi-${expirationWarning.icon}`"></i>
        <span>{{ expirationWarning.text }}</span>
      </div>

      <!-- Actions slot -->
      <div v-if="$slots.actions" class="lease-actions">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lease-card {
  background: white;
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  overflow: hidden;
  transition: all var(--transition-base, 0.2s ease);
  cursor: pointer;
}

.lease-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
}

.lease-header {
  position: relative;
  height: 120px;
  background: linear-gradient(135deg, var(--primary-600, #4f46e5), var(--primary-700, #4338ca));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.header-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.header-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.1);
}

.header-icon {
  font-size: 3rem;
  color: rgba(255, 255, 255, 0.8);
}

.status-badge {
  position: absolute;
  top: var(--space-4, 1rem);
  right: var(--space-4, 1rem);
}

.lease-content {
  padding: var(--space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.lease-title {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.property-name {
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  margin: 0;
}

.tenant-names {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.tenant-names i {
  font-size: 1rem;
  color: var(--text-tertiary, #94a3b8);
}

.lease-dates {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  padding-top: var(--space-3, 0.75rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.date-row {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.date-row i {
  font-size: 1rem;
  color: var(--text-tertiary, #94a3b8);
}

.date-label {
  font-weight: var(--font-weight-medium, 500);
  min-width: 3rem;
}

.date-value {
  color: var(--text-primary, #0f172a);
}

.lease-financials {
  display: flex;
  gap: var(--space-4, 1rem);
  padding-top: var(--space-3, 0.75rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.financial-item {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.financial-item i {
  font-size: 1rem;
  color: var(--text-tertiary, #94a3b8);
}

.financial-item.total {
  margin-left: auto;
  font-weight: var(--font-weight-semibold, 600);
  color: var(--primary-600, #4f46e5);
}

.expiration-alert {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-3, 0.75rem);
  border-radius: var(--radius-md, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
}

.expiration-alert i {
  font-size: 1.25rem;
}

.alert-expired {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(220, 38, 38);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.alert-urgent {
  background: rgba(251, 146, 60, 0.1);
  color: rgb(234, 88, 12);
  border: 1px solid rgba(251, 146, 60, 0.2);
}

.alert-warning {
  background: rgba(250, 204, 21, 0.1);
  color: rgb(202, 138, 4);
  border: 1px solid rgba(250, 204, 21, 0.2);
}

.lease-actions {
  padding-top: var(--space-3, 0.75rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  gap: var(--space-2, 0.5rem);
}

@media (max-width: 640px) {
  .lease-financials {
    flex-direction: column;
    gap: var(--space-2, 0.5rem);
  }

  .financial-item.total {
    margin-left: 0;
  }
}
</style>
