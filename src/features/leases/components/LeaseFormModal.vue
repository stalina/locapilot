<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useLeasesStore } from '../stores/leasesStore';
import { usePropertiesStore } from '../../properties/stores/propertiesStore';
import { useTenantsStore } from '../../tenants/stores/tenantsStore';
import Modal from '../../../shared/components/Modal.vue';
import Input from '../../../shared/components/Input.vue';
import Button from '../../../shared/components/Button.vue';
import type { Lease } from '../../../db/schema';

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
  propertiesStore.properties.filter(p => p.status === 'vacant' || p.id === props.lease?.propertyId)
);

const availableTenants = computed(() => 
  tenantsStore.tenants.filter(t => t.status === 'active' || t.status === 'candidate')
);

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

watch(() => props.lease, (newLease) => {
  if (newLease) {
    formData.value = {
      propertyId: newLease.propertyId,
      tenantIds: [...newLease.tenantIds],
      startDate: new Date(newLease.startDate).toISOString().split('T')[0] || '',
      endDate: newLease.endDate ? new Date(newLease.endDate).toISOString().split('T')[0] || '' : '',
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

const validateForm = (): boolean => {
  let isValid = true;

  // Property
  if (!formData.value.propertyId || formData.value.propertyId === 0) {
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

  let leaseData: any = null;

  try {
    // Convert all selected candidates to active tenants
    for (const tenantId of formData.value.tenantIds) {
      const tenant = tenantsStore.tenants.find(t => t.id === tenantId);
      if (tenant && tenant.status === 'candidate') {
        await tenantsStore.updateTenant(tenantId, {
          ...tenant,
          status: 'active',
        });
      }
    }

    leaseData = {
      propertyId: Number(formData.value.propertyId),
      tenantIds: formData.value.tenantIds.map((id: any) => Number(id)),
      startDate: new Date(formData.value.startDate),
      rent: Number(formData.value.rent),
      charges: Number(formData.value.charges),
      deposit: Number(formData.value.deposit),
      paymentDay: Number(formData.value.paymentDay),
      status: formData.value.status,
    };

    // Only add endDate if it exists
    if (formData.value.endDate) {
      leaseData.endDate = new Date(formData.value.endDate);
    }

    console.log('📋 Lease data before creation:', JSON.stringify(leaseData, null, 2));

    if (isEditMode.value && props.lease?.id) {
      await leasesStore.updateLease(props.lease.id, leaseData);
    } else {
      await leasesStore.createLease(leaseData);
    }

    emit('success');
    emit('update:modelValue', false);
    resetForm();
  } catch (error: any) {
    console.error('Failed to save lease:', error);
    console.error('Error details:', {
      message: error?.message,
      inner: error?.inner,
      stack: error?.stack,
      formData: formData.value,
      leaseData
    });
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
    <template #default>
      <form @submit.prevent="handleSubmit">
        <div class="form-content">
          <!-- Propriété -->
          <section class="form-section">
            <h4 class="section-title">Propriété</h4>
            <div class="field">
              <label class="field-label">Propriété <span class="required">*</span></label>
              <select
                v-model.number="formData.propertyId"
                :class="['select', { error: errors.propertyId }]"
                required
              >
                <option :value="0" disabled>Sélectionner une propriété</option>
                <option
                  v-for="property in availableProperties"
                  :key="property.id"
                  :value="property.id"
                >
                  {{ property.name }} · {{ property.address }}
                </option>
              </select>
              <p v-if="errors.propertyId" class="error-message">{{ errors.propertyId }}</p>
            </div>
          </section>

          <!-- Locataires -->
          <section class="form-section">
            <h4 class="section-title">Locataires</h4>
            <div class="field">
              <label class="field-label">Locataires <span class="required">*</span></label>
              <div class="tenant-list">
                <label
                  v-for="tenant in availableTenants"
                  :key="tenant.id"
                  :class="['tenant-card', { selected: tenant.id && formData.tenantIds.includes(tenant.id) }]"
                >
                  <input
                    type="checkbox"
                    :checked="!!(tenant.id && formData.tenantIds.includes(tenant.id))"
                    @change="tenant.id && toggleTenant(tenant.id)"
                  />
                  <div class="tenant-card__info">
                    <span class="tenant-card__name">{{ tenant.firstName }} {{ tenant.lastName }}</span>
                    <span class="tenant-card__email">{{ tenant.email }}</span>
                  </div>
                </label>
              </div>
              <p v-if="errors.tenantIds" class="error-message">{{ errors.tenantIds }}</p>
            </div>
          </section>

          <!-- Période -->
          <section class="form-section">
            <h4 class="section-title">Période</h4>
            <div class="field-row">
              <Input
                v-model="formData.startDate"
                label="Date de début"
                type="date"
                :error="errors.startDate"
                required
              />
              <Input
                v-model="formData.endDate"
                label="Date de fin"
                type="date"
                hint="Laisser vide pour un bail sans date de fin"
              />
            </div>
          </section>

          <!-- Informations financières -->
          <section class="form-section">
            <h4 class="section-title">Informations financières</h4>
            <div class="field-row">
              <Input
                v-model.number="formData.rent"
                label="Loyer mensuel (€)"
                type="number"
                :error="errors.rent"
                min="0"
                step="0.01"
                required
              />
              <Input
                v-model.number="formData.charges"
                label="Charges (€)"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
            <div class="field-row">
              <Input
                v-model.number="formData.deposit"
                label="Dépôt de garantie (€)"
                type="number"
                :error="errors.deposit"
                min="0"
                step="0.01"
                required
              />
              <Input
                v-model.number="formData.paymentDay"
                label="Jour de paiement"
                type="number"
                :error="errors.paymentDay"
                min="1"
                max="31"
                hint="Jour du mois (1-31)"
                required
              />
            </div>
          </section>

          <!-- Statut -->
          <section class="form-section">
            <h4 class="section-title">Statut</h4>
            <div class="field">
              <label class="field-label">Statut</label>
              <select v-model="formData.status" class="select">
                <option value="pending">En attente</option>
                <option value="active">Actif</option>
                <option value="ended">Terminé</option>
              </select>
            </div>
          </section>
        </div>
      </form>
    </template>

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
.form-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 1.5rem);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.section-title {
  margin: 0;
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.field-label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary, #64748b);
}

.required {
  color: var(--error-500, #ef4444);
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4, 1rem);
}

.select {
  width: 100%;
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  font-size: var(--text-base, 1rem);
  color: var(--text-primary, #0f172a);
  background: #fff;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  transition: all var(--transition-base, 0.2s ease);
}

.select:focus {
  outline: none;
  border-color: var(--primary-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.select.error {
  border-color: var(--error-500, #ef4444);
}

.tenant-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
  max-height: 320px;
  padding: var(--space-3, 0.75rem);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-xl, 1rem);
  background: var(--surface-muted, #f8fafc);
  overflow-y: auto;
}

.tenant-card {
  display: flex;
  gap: var(--space-3, 0.75rem);
  align-items: center;
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border: 1px solid transparent;
  border-radius: var(--radius-lg, 0.75rem);
  background: #fff;
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.tenant-card:hover {
  border-color: var(--border-color-strong, #cbd5f5);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.tenant-card.selected {
  border-color: var(--primary-500, #6366f1);
  box-shadow: 0 0 0 1px var(--primary-500, #6366f1);
}

.tenant-card input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.tenant-card__info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}

.tenant-card__name {
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #0f172a);
}

.tenant-card__email {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.error-message {
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  color: var(--error-500, #ef4444);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3, 0.75rem);
}

@media (max-width: 768px) {
  .field-row {
    grid-template-columns: 1fr;
  }

  .tenant-list {
    max-height: 240px;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-actions :deep(button) {
    width: 100%;
  }
}
</style>
