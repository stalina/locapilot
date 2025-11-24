<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useLeasesStore } from '../stores/leasesStore';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import Modal from '@/shared/components/Modal.vue';
import Input from '@/shared/components/Input.vue';
import Button from '@/shared/components/Button.vue';
import type { Lease } from '@/db/schema';

interface Props {
  modelValue: boolean;
  lease?: Lease;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();

const formData = ref({
  propertyId: 0,
  tenantIds: [] as number[],
  startDate: '',
  endDate: '',
  rent: 0,
  charges: 0,
  deposit: 0,
  paymentDay: 1,
  status: 'pending' as 'active' | 'ended' | 'pending',
});

const errors = ref({
  propertyId: '',
  tenantIds: '',
  startDate: '',
  rent: '',
  deposit: '',
  paymentDay: '',
});

onMounted(async () => {
  await Promise.all([
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
  ]);
});

const isEditMode = computed(() => !!props.lease);

const modalTitle = computed(() => 
  isEditMode.value ? 'Modifier le bail' : 'Nouveau bail'
);

const availableProperties = computed(() => 
  propertiesStore.properties.filter(p => p.status === 'available' || p.id === props.lease?.propertyId)
);

const availableTenants = computed(() => 
  tenantsStore.tenants.filter(t => t.status === 'active')
);

watch(() => props.lease, (newLease) => {
  if (newLease) {
    formData.value = {
      propertyId: newLease.propertyId,
      tenantIds: [...newLease.tenantIds],
      startDate: new Date(newLease.startDate).toISOString().split('T')[0],
      endDate: newLease.endDate ? new Date(newLease.endDate).toISOString().split('T')[0] : '',
      rent: newLease.rent,
      charges: newLease.charges,
      deposit: newLease.deposit,
      paymentDay: newLease.paymentDay,
      status: newLease.status,
    };
  } else {
    resetForm();
  }
}, { immediate: true });

const resetForm = () => {
  formData.value = {
    propertyId: 0,
    tenantIds: [],
    startDate: '',
    endDate: '',
    rent: 0,
    charges: 0,
    deposit: 0,
    paymentDay: 1,
    status: 'pending',
  };
  
  errors.value = {
    propertyId: '',
    tenantIds: '',
    startDate: '',
    rent: '',
    deposit: '',
    paymentDay: '',
  };
};

const validateForm = (): boolean => {
  let isValid = true;

  // Property
  if (!formData.value.propertyId) {
    errors.value.propertyId = 'La propriété est requise';
    isValid = false;
  } else {
    errors.value.propertyId = '';
  }

  // Tenants
  if (formData.value.tenantIds.length === 0) {
    errors.value.tenantIds = 'Au moins un locataire est requis';
    isValid = false;
  } else {
    errors.value.tenantIds = '';
  }

  // Start date
  if (!formData.value.startDate) {
    errors.value.startDate = 'La date de début est requise';
    isValid = false;
  } else {
    errors.value.startDate = '';
  }

  // Rent
  if (!formData.value.rent || formData.value.rent <= 0) {
    errors.value.rent = 'Le loyer doit être supérieur à 0';
    isValid = false;
  } else {
    errors.value.rent = '';
  }

  // Deposit
  if (formData.value.deposit < 0) {
    errors.value.deposit = 'Le dépôt ne peut pas être négatif';
    isValid = false;
  } else {
    errors.value.deposit = '';
  }

  // Payment day
  if (formData.value.paymentDay < 1 || formData.value.paymentDay > 31) {
    errors.value.paymentDay = 'Le jour doit être entre 1 et 31';
    isValid = false;
  } else {
    errors.value.paymentDay = '';
  }

  return isValid;
};

const handleSubmit = async () => {
  if (!validateForm()) return;

  try {
    const leaseData = {
      propertyId: formData.value.propertyId,
      tenantIds: formData.value.tenantIds,
      startDate: new Date(formData.value.startDate),
      endDate: formData.value.endDate ? new Date(formData.value.endDate) : undefined,
      rent: formData.value.rent,
      charges: formData.value.charges,
      deposit: formData.value.deposit,
      paymentDay: formData.value.paymentDay,
      status: formData.value.status,
    };

    if (isEditMode.value && props.lease?.id) {
      await leasesStore.updateLease(props.lease.id, leaseData);
    } else {
      await leasesStore.createLease(leaseData);
    }

    emit('success');
    emit('update:modelValue', false);
    resetForm();
  } catch (error) {
    console.error('Failed to save lease:', error);
  }
};

const handleCancel = () => {
  emit('update:modelValue', false);
  resetForm();
};

const toggleTenant = (tenantId: number) => {
  const index = formData.value.tenantIds.indexOf(tenantId);
  if (index === -1) {
    formData.value.tenantIds.push(tenantId);
  } else {
    formData.value.tenantIds.splice(index, 1);
  }
};
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="modalTitle"
    size="lg"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form @submit.prevent="handleSubmit" class="lease-form">
      <!-- Property Selection -->
      <div class="form-section">
        <h3>Propriété</h3>
        <div class="form-group">
          <label for="propertyId">Propriété *</label>
          <select
            id="propertyId"
            v-model.number="formData.propertyId"
            :class="['form-select', { error: errors.propertyId }]"
            required
          >
            <option :value="0">Sélectionner une propriété</option>
            <option 
              v-for="property in availableProperties" 
              :key="property.id" 
              :value="property.id"
            >
              {{ property.name }} - {{ property.address }}
            </option>
          </select>
          <span v-if="errors.propertyId" class="error-message">{{ errors.propertyId }}</span>
        </div>
      </div>

      <!-- Tenants Selection -->
      <div class="form-section">
        <h3>Locataires *</h3>
        <div class="form-group">
          <div class="tenants-selection">
            <div
              v-for="tenant in availableTenants"
              :key="tenant.id"
              :class="['tenant-checkbox', { selected: formData.tenantIds.includes(tenant.id!) }]"
              @click="tenant.id && toggleTenant(tenant.id)"
            >
              <input
                type="checkbox"
                :checked="formData.tenantIds.includes(tenant.id!)"
                @click.stop
                @change="tenant.id && toggleTenant(tenant.id)"
              />
              <div class="tenant-info">
                <strong>{{ tenant.firstName }} {{ tenant.lastName }}</strong>
                <span>{{ tenant.email }}</span>
              </div>
            </div>
          </div>
          <span v-if="errors.tenantIds" class="error-message">{{ errors.tenantIds }}</span>
        </div>
      </div>

      <!-- Dates -->
      <div class="form-section">
        <h3>Période</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="startDate">Date de début *</label>
            <Input
              id="startDate"
              v-model="formData.startDate"
              type="date"
              :error="errors.startDate"
              required
            />
          </div>

          <div class="form-group">
            <label for="endDate">Date de fin</label>
            <Input
              id="endDate"
              v-model="formData.endDate"
              type="date"
            />
            <span class="hint">Laisser vide pour un bail sans date de fin</span>
          </div>
        </div>
      </div>

      <!-- Financial Info -->
      <div class="form-section">
        <h3>Informations financières</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="rent">Loyer mensuel (€) *</label>
            <Input
              id="rent"
              v-model.number="formData.rent"
              type="number"
              :error="errors.rent"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div class="form-group">
            <label for="charges">Charges (€)</label>
            <Input
              id="charges"
              v-model.number="formData.charges"
              type="number"
              min="0"
              step="0.01"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="deposit">Dépôt de garantie (€) *</label>
            <Input
              id="deposit"
              v-model.number="formData.deposit"
              type="number"
              :error="errors.deposit"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div class="form-group">
            <label for="paymentDay">Jour de paiement *</label>
            <Input
              id="paymentDay"
              v-model.number="formData.paymentDay"
              type="number"
              :error="errors.paymentDay"
              min="1"
              max="31"
              required
            />
            <span class="hint">Jour du mois (1-31)</span>
          </div>
        </div>
      </div>

      <!-- Status -->
      <div class="form-section">
        <h3>Statut</h3>
        <div class="form-group">
          <label for="status">Statut</label>
          <select
            id="status"
            v-model="formData.status"
            class="form-select"
          >
            <option value="pending">En attente</option>
            <option value="active">Actif</option>
            <option value="ended">Terminé</option>
          </select>
        </div>
      </div>
    </form>

    <template #footer>
      <div class="modal-actions">
        <Button @click="handleCancel" variant="secondary" type="button">
          Annuler
        </Button>
        <Button @click="handleSubmit" variant="primary" type="button">
          {{ isEditMode ? 'Mettre à jour' : 'Créer' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.lease-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
}

.form-section h3 {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  padding-bottom: var(--spacing-2);
  border-bottom: 1px solid var(--color-border);
}

.form-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-4);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.form-group label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-text);
}

.form-select {
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-text);
  background: var(--color-surface);
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.form-select:hover {
  border-color: var(--color-primary);
}

.form-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-select.error {
  border-color: var(--color-error);
}

.tenants-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
  max-height: 300px;
  overflow-y: auto;
  padding: var(--spacing-2);
  background: var(--color-background);
  border-radius: var(--radius-md);
}

.tenant-checkbox {
  display: flex;
  align-items: center;
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tenant-checkbox:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.tenant-checkbox.selected {
  border-color: var(--color-primary);
  background: rgba(59, 130, 246, 0.05);
}

.tenant-checkbox input[type="checkbox"] {
  width: 20px;
  height: 20px;
  cursor: pointer;
}

.tenant-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-1);
}

.tenant-info strong {
  font-size: var(--text-base);
  color: var(--color-text);
}

.tenant-info span {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.hint {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  font-style: italic;
}

.error-message {
  font-size: var(--text-sm);
  color: var(--color-error);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-3);
}

@media (max-width: 640px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-actions :deep(button) {
    width: 100%;
  }
}
</style>
