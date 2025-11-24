<script setup lang="ts">
import { computed } from 'vue';
import Badge from './Badge.vue';

interface Property {
  id: string;
  name: string;
  address: string;
  type: 'apartment' | 'house' | 'commercial' | 'parking';
  surface: number;
  rooms: number;
  rentAmount: number;
  charges?: number;
  status: 'occupied' | 'vacant' | 'maintenance';
}

interface Props {
  property: Property;
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
    occupied: { variant: 'success' as const, label: 'Occupé', icon: 'check-circle' },
    vacant: { variant: 'info' as const, label: 'Vacant', icon: 'home-outline' },
    maintenance: { variant: 'warning' as const, label: 'Maintenance', icon: 'wrench' },
  };
  return configs[props.property.status];
});

const typeIcon = computed(() => {
  const icons = {
    apartment: 'office-building',
    house: 'home',
    commercial: 'store',
    parking: 'car',
  };
  return icons[props.property.type];
});

const typeLabel = computed(() => {
  const labels = {
    apartment: 'Appartement',
    house: 'Maison',
    commercial: 'Commercial',
    parking: 'Parking',
  };
  return labels[props.property.type];
});

const totalRent = computed(() => {
  const total = props.property.rentAmount + (props.property.charges || 0);
  return total.toLocaleString('fr-FR');
});

function handleClick() {
  if (props.clickable) {
    emit('click', props.property.id);
  }
}
</script>

<template>
  <div 
    class="property-card" 
    :class="{ 'is-clickable': clickable }"
    @click="handleClick"
  >
    <!-- Image placeholder with gradient -->
    <div class="property-image">
      <div class="image-overlay">
        <i :class="`mdi mdi-${typeIcon}`" class="type-icon"></i>
      </div>
      <Badge 
        :variant="statusConfig.variant" 
        :icon="statusConfig.icon"
        class="status-badge"
      >
        {{ statusConfig.label }}
      </Badge>
    </div>

    <!-- Content -->
    <div class="property-content">
      <div class="property-header">
        <h3 class="property-name">{{ property.name }}</h3>
        <span class="property-type">{{ typeLabel }}</span>
      </div>

      <div class="property-address">
        <i class="mdi mdi-map-marker"></i>
        {{ property.address }}
      </div>

      <div class="property-stats">
        <div class="stat">
          <i class="mdi mdi-ruler-square"></i>
          <span>{{ property.surface }} m²</span>
        </div>
        <div class="stat">
          <i class="mdi mdi-door"></i>
          <span>{{ property.rooms }} pièces</span>
        </div>
        <div class="stat stat-price">
          <i class="mdi mdi-currency-eur"></i>
          <span>{{ totalRent }} €/mois</span>
        </div>
      </div>

      <!-- Actions slot -->
      <div v-if="$slots.actions" class="property-actions">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<style scoped>
.property-card {
  background: white;
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  overflow: hidden;
  transition: all var(--transition-base, 0.2s ease);
}

.property-card.is-clickable {
  cursor: pointer;
}

.property-card.is-clickable:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
}

.property-image {
  position: relative;
  height: 200px;
  background: linear-gradient(135deg, var(--primary-600, #4f46e5), var(--primary-700, #4338ca));
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.1);
}

.type-icon {
  font-size: 4rem;
  color: rgba(255, 255, 255, 0.8);
}

.status-badge {
  position: absolute;
  top: var(--space-4, 1rem);
  right: var(--space-4, 1rem);
}

.property-content {
  padding: var(--space-6, 1.5rem);
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.property-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3, 0.75rem);
}

.property-name {
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  margin: 0;
  flex: 1;
}

.property-type {
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.property-address {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.property-address i {
  font-size: 1rem;
  color: var(--text-tertiary, #94a3b8);
}

.property-stats {
  display: flex;
  gap: var(--space-4, 1rem);
  padding-top: var(--space-3, 0.75rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.stat i {
  font-size: 1rem;
  color: var(--text-tertiary, #94a3b8);
}

.stat-price {
  margin-left: auto;
  font-weight: var(--font-weight-semibold, 600);
  color: var(--primary-600, #4f46e5);
}

.property-actions {
  padding-top: var(--space-3, 0.75rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
  display: flex;
  gap: var(--space-2, 0.5rem);
}
</style>
