<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useInventoriesStore } from '../stores/inventoriesStore';
import { useLeasesStore } from '../../leases/stores/leasesStore';
import { usePropertiesStore } from '../../properties/stores/propertiesStore';
import Modal from '../../../shared/components/Modal.vue';
import Input from '../../../shared/components/Input.vue';
import Button from '../../../shared/components/Button.vue';
import type { Inventory } from '../../../db/types';

interface Props {
  modelValue: boolean;
  inventory?: Inventory | null;
}

const props = withDefaults(defineProps<Props>(), {
  inventory: null,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const inventoriesStore = useInventoriesStore();
const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();

// Form data
const formData = ref({
  leaseId: 0 as number,
  type: 'checkin' as Inventory['type'],
  date: new Date().toISOString().split('T')[0],
  observations: '',
  photos: [] as string[],
  roomsData: {} as Record<string, any>,
});

const errors = ref<Record<string, string>>({});
const isSubmitting = ref(false);

const isEditMode = computed(() => !!props.inventory);
const modalTitle = computed(() => 
  isEditMode.value ? 'Modifier l\'état des lieux' : 'Nouvel état des lieux'
);

// Available leases for selection
const availableLeases = computed(() => {
  return leasesStore.leases.map(lease => {
    const property = propertiesStore.properties.find(p => p.id === lease.propertyId);
    return {
      id: lease.id!,
      label: property?.name || `Bail #${lease.id}`,
    };
  });
});

// Watch inventory changes to populate form
watch(() => props.inventory, (newInventory) => {
  if (newInventory) {
    formData.value = {
      leaseId: newInventory.leaseId,
      type: newInventory.type,
      date: new Date(newInventory.date).toISOString().split('T')[0],
      observations: newInventory.observations || '',
      photos: newInventory.photos || [],
      roomsData: newInventory.roomsData || {},
    };
  } else {
    resetForm();
  }
}, { immediate: true });

function resetForm() {
  formData.value = {
    leaseId: 0,
    type: 'checkin',
    date: new Date().toISOString().split('T')[0],
    observations: '',
    photos: [],
    roomsData: {},
  };
  errors.value = {};
}

function validateForm(): boolean {
  errors.value = {};

  if (!formData.value.leaseId || formData.value.leaseId === 0) {
    errors.value.leaseId = 'Le bail est requis';
  }

  if (!formData.value.date) {
    errors.value.date = 'La date est requise';
  }

  return Object.keys(errors.value).length === 0;
}

async function handleSubmit() {
  if (!validateForm()) return;

  isSubmitting.value = true;

  try {
    const inventoryData = {
      leaseId: formData.value.leaseId,
      type: formData.value.type,
      date: new Date(formData.value.date),
      observations: formData.value.observations,
      photos: formData.value.photos,
      roomsData: formData.value.roomsData,
    };

    if (isEditMode.value && props.inventory?.id) {
      await inventoriesStore.updateInventory(props.inventory.id, inventoryData);
    } else {
      await inventoriesStore.createInventory(inventoryData);
    }

    emit('success');
    handleClose();
  } catch (error) {
    console.error('Failed to save inventory:', error);
  } finally {
    isSubmitting.value = false;
  }
}

function handleClose() {
  resetForm();
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="modalTitle"
    size="lg"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form @submit.prevent="handleSubmit">
      <div class="form-grid">
        <!-- Informations générales -->
        <div class="form-section full-width">
          <h4 class="section-title">Informations générales</h4>

          <div class="field">
            <label class="field-label">Bail <span class="required">*</span></label>
            <select v-model.number="formData.leaseId" class="select" data-testid="inventory-lease">
              <option :value="0" disabled>Sélectionnez un bail</option>
              <option
                v-for="lease in availableLeases"
                :key="lease.id"
                :value="lease.id"
              >
                {{ lease.label }}
              </option>
            </select>
            <span v-if="errors.leaseId" class="error-message">{{ errors.leaseId }}</span>
          </div>

          <div class="field-row">
            <div class="field">
              <label class="field-label">Type <span class="required">*</span></label>
              <select v-model="formData.type" class="select" data-testid="inventory-type">
                <option value="checkin">État d'entrée</option>
                <option value="checkout">État de sortie</option>
              </select>
            </div>

            <Input
              v-model="formData.date"
              label="Date"
              type="date"
              :error="errors.date"
              test-id="inventory-date"
              required
            />
          </div>
        </div>

        <!-- Observations -->
        <div class="form-section full-width">
          <h4 class="section-title">Observations</h4>
          
          <div class="field">
            <label class="field-label">Observations générales</label>
            <textarea
              v-model="formData.observations"
              class="textarea"
              rows="6"
              placeholder="Notez ici vos observations générales sur l'état du logement..."
              data-testid="inventory-observations"
            ></textarea>
          </div>
        </div>

        <!-- Photos -->
        <div class="form-section full-width">
          <h4 class="section-title">Photos</h4>
          
          <div class="photos-info">
            <i class="mdi mdi-information-outline"></i>
            <p>La fonctionnalité de gestion des photos sera disponible prochainement.</p>
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <Button
        variant="default"
        @click="handleClose"
        :disabled="isSubmitting"
      >
        Annuler
      </Button>
      <Button
        variant="primary"
        @click="handleSubmit"
        :disabled="isSubmitting"
        icon="check"
      >
        {{ isSubmitting ? 'Enregistrement...' : (isEditMode ? 'Enregistrer' : 'Créer') }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 1.5rem);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.form-section.full-width {
  width: 100%;
}

.section-title {
  margin: 0 0 var(--space-2, 0.5rem);
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

.select,
.textarea {
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  font-size: var(--text-base, 1rem);
  font-family: inherit;
  color: var(--text-primary, #0f172a);
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  outline: none;
  transition: all var(--transition-base, 0.2s ease);
}

.select:focus,
.textarea:focus {
  border-color: var(--primary-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.textarea {
  resize: vertical;
  line-height: 1.5;
}

.error-message {
  font-size: var(--text-sm, 0.875rem);
  color: var(--error-500, #ef4444);
}

.photos-info {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-4, 1rem);
  background: var(--neutral-50, #f9fafb);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
}

.photos-info i {
  font-size: 1.25rem;
  color: var(--primary-600, #4f46e5);
  margin-top: 0.125rem;
}

.photos-info p {
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
  line-height: 1.5;
}

@media (max-width: 768px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
