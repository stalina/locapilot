<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import Modal from '@shared/components/Modal.vue';
import Input from '@shared/components/Input.vue';
import Button from '@shared/components/Button.vue';
import type { Tenant } from '@/db/types';

interface Props {
  modelValue: boolean;
  tenant?: Tenant | null;
}

const props = withDefaults(defineProps<Props>(), {
  tenant: null,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const tenantsStore = useTenantsStore();

// Form data
const formData = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  birthDate: '',
  status: 'candidate' as Tenant['status'],
});

const errors = ref<Record<string, string>>({});
const isSubmitting = ref(false);

const isEditMode = computed(() => !!props.tenant);
const modalTitle = computed(() => isEditMode.value ? 'Modifier le locataire' : 'Nouveau locataire');

// Watch tenant changes to populate form
watch(() => props.tenant, (newTenant) => {
  console.log('[TenantFormModal] Tenant changed:', newTenant);
  if (newTenant) {
    formData.value = {
      firstName: newTenant.firstName,
      lastName: newTenant.lastName,
      email: newTenant.email,
      phone: newTenant.phone || '',
      birthDate: newTenant.birthDate ? new Date(newTenant.birthDate).toISOString().split('T')[0] : '',
      status: newTenant.status,
    };
  } else {
    resetForm();
  }
}, { immediate: true });

watch(() => props.modelValue, (newValue) => {
  console.log('[TenantFormModal] modelValue changed:', newValue);
}, { immediate: true });

function resetForm() {
  formData.value = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthDate: '',
    status: 'candidate',
  };
  errors.value = {};
}

function validateForm(): boolean {
  errors.value = {};

  if (!formData.value.firstName.trim()) {
    errors.value.firstName = 'Le prénom est requis';
  }
  if (!formData.value.lastName.trim()) {
    errors.value.lastName = 'Le nom est requis';
  }
  if (!formData.value.email.trim()) {
    errors.value.email = 'L\'email est requis';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.value.email)) {
    errors.value.email = 'L\'email n\'est pas valide';
  }

  return Object.keys(errors.value).length === 0;
}

async function handleSubmit() {
  if (!validateForm()) return;

  isSubmitting.value = true;

  try {
    const data: any = {
      firstName: formData.value.firstName,
      lastName: formData.value.lastName,
      email: formData.value.email,
      phone: formData.value.phone,
      status: formData.value.status,
    };
    
    if (formData.value.birthDate) {
      data.birthDate = new Date(formData.value.birthDate);
    }

    if (isEditMode.value && props.tenant) {
      await tenantsStore.updateTenant(props.tenant.id, data);
    } else {
      await tenantsStore.createTenant(data);
    }

    emit('success');
    handleClose();
  } catch (error) {
    console.error('Failed to save tenant:', error);
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
    size="md"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <form @submit.prevent="handleSubmit">
      <div class="form-content">
        <!-- Informations personnelles -->
        <div class="form-section">
          <h4 class="section-title">Informations personnelles</h4>

          <div class="field-row">
            <Input
              v-model="formData.firstName"
              label="Prénom"
              placeholder="Jean"
              :error="errors.firstName"
              required
            />

            <Input
              v-model="formData.lastName"
              label="Nom"
              placeholder="Dupont"
              :error="errors.lastName"
              required
            />
          </div>

          <Input
            v-model="formData.birthDate"
            label="Date de naissance"
            type="date"
          />
        </div>

        <!-- Contact -->
        <div class="form-section">
          <h4 class="section-title">Contact</h4>

          <Input
            v-model="formData.email"
            label="Email"
            type="email"
            placeholder="jean.dupont@example.com"
            :error="errors.email"
            required
          />

          <Input
            v-model="formData.phone"
            label="Téléphone"
            type="tel"
            placeholder="06 12 34 56 78"
          />
        </div>

        <!-- Statut -->
        <div class="form-section">
          <h4 class="section-title">Statut</h4>

          <div class="field">
            <label class="field-label">Statut <span class="required">*</span></label>
            <select v-model="formData.status" class="select">
              <option value="candidate">Candidat</option>
              <option value="active">Locataire actif</option>
              <option value="former">Ancien locataire</option>
            </select>
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

@media (max-width: 768px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
