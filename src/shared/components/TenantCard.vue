<script setup lang="ts">
import { computed } from 'vue';
import Badge from './Badge.vue';

interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate?: Date;
  status: 'active' | 'candidate' | 'former';
}

interface Props {
  tenant: Tenant;
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  clickable: true,
});

const emit = defineEmits<{
  click: [id: string];
}>();

const statusConfig = computed(() => {
  const configs = {
    active: { variant: 'success' as const, label: 'Actif', icon: 'check-circle' },
    candidate: { variant: 'info' as const, label: 'Candidat', icon: 'account-clock' },
    former: { variant: 'error' as const, label: 'Ancien', icon: 'account-off' },
  };
  return configs[props.tenant.status];
});

const fullName = computed(() => 
  `${props.tenant.firstName} ${props.tenant.lastName}`
);

const age = computed(() => {
  if (!props.tenant.birthDate) return null;
  const today = new Date();
  const birthDate = new Date(props.tenant.birthDate);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
});

function handleClick() {
  if (props.clickable && props.tenant.id) {
    emit('click', props.tenant.id);
  }
}
</script>

<template>
  <div 
    class="tenant-card" 
    :class="{ 'is-clickable': clickable }"
    @click="handleClick"
  >
    <!-- Avatar -->
    <div class="tenant-avatar">
      <i class="mdi mdi-account-circle"></i>
      <Badge 
        :variant="statusConfig.variant" 
        :icon="statusConfig.icon"
        class="status-badge"
      >
        {{ statusConfig.label }}
      </Badge>
    </div>

    <!-- Content -->
    <div class="tenant-content">
      <div class="tenant-header">
        <h3 class="tenant-name">{{ fullName }}</h3>
      </div>

      <div class="tenant-info">
        <div class="info-row">
          <i class="mdi mdi-email"></i>
          <span>{{ tenant.email }}</span>
        </div>
        <div class="info-row">
          <i class="mdi mdi-phone"></i>
          <span>{{ tenant.phone }}</span>
        </div>
        <div v-if="age" class="info-row">
          <i class="mdi mdi-cake-variant"></i>
          <span>{{ age }} ans</span>
        </div>
      </div>

      <!-- Actions slot -->
      <div v-if="$slots.actions" class="tenant-actions">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tenant-card {
  background: white;
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  overflow: hidden;
  transition: all var(--transition-base, 0.2s ease);
}

.tenant-card.is-clickable {
  cursor: pointer;
}

.tenant-card.is-clickable:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
}

.tenant-avatar {
  position: relative;
  height: 200px;
  background: linear-gradient(135deg, var(--accent-500, #14b8a6), var(--accent-600, #0d9488));
  display: flex;
  align-items: center;
  justify-content: center;
}

.tenant-avatar i {
  font-size: 6rem;
  color: rgba(255, 255, 255, 0.9);
}

.status-badge {
  position: absolute;
  top: var(--space-4, 1rem);
  right: var(--space-4, 1rem);
}

.tenant-content {
  padding: var(--space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.tenant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tenant-name {
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  margin: 0;
}

.tenant-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.info-row {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.info-row i {
  font-size: 1rem;
  color: var(--text-tertiary, #94a3b8);
  flex-shrink: 0;
}

.tenant-actions {
  padding-top: var(--space-3, 0.75rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  gap: var(--space-2, 0.5rem);
}
</style>
