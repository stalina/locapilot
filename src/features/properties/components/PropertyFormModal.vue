<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import Modal from '@/shared/components/Modal.vue';
import Input from '@/shared/components/Input.vue';
import Button from '@/shared/components/Button.vue';
import RichTextEditor from '@/shared/components/RichTextEditor.vue';
import type { Property } from '@/db/types';
import { defaultAnnonceTemplate } from '@/shared/utils/annonceTemplate';

interface Props {
  modelValue: boolean;
  property?: Property | null;
}

const props = withDefaults(defineProps<Props>(), {
  property: null,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const propertiesStore = usePropertiesStore();

// Form data
const formData = ref({
  name: '',
  address: '',
  type: 'apartment' as Property['type'],
  surface: 0 as number,
  rooms: 0 as number,
  bedrooms: null as number | null,
  bathrooms: null as number | null,
  rent: 0 as number,
  charges: 0 as number,
  deposit: null as number | null,
  status: 'vacant' as Property['status'],
  description: '',
  annonce: '',
});

const errors = ref<Record<string, string>>({});
const isSubmitting = ref(false);

const isEditMode = computed(() => !!props.property);
const modalTitle = computed(() => (isEditMode.value ? 'Modifier le bien' : 'Nouveau bien'));

// Watch property changes to populate form
watch(
  () => props.property,
  newProperty => {
    if (newProperty) {
      formData.value = {
        name: newProperty.name,
        address: newProperty.address,
        type: newProperty.type,
        surface: newProperty.surface,
        rooms: newProperty.rooms,
        bedrooms: newProperty.bedrooms ?? null,
        bathrooms: newProperty.bathrooms ?? null,
        rent: newProperty.rent,
        charges: newProperty.charges ?? 0,
        deposit: newProperty.deposit ?? null,
        status: newProperty.status,
        description: newProperty.description || '',
        annonce: (newProperty as any).annonce || '',
      };
    } else {
      resetForm();
    }
  },
  { immediate: true }
);

function resetForm() {
  formData.value = {
    name: '',
    address: '',
    type: 'apartment',
    surface: 0,
    rooms: 0,
    bedrooms: null,
    bathrooms: null,
    rent: 0,
    charges: 0,
    deposit: null,
    status: 'vacant',
    description: '',
    annonce: defaultAnnonceTemplate(),
  };
  errors.value = {};
}

function validateForm(): boolean {
  errors.value = {};

  if (!formData.value.name.trim()) {
    errors.value.name = 'Le nom est requis';
  }
  if (!formData.value.address.trim()) {
    errors.value.address = "L'adresse est requise";
  }
  if (!formData.value.surface || formData.value.surface <= 0) {
    errors.value.surface = 'La surface doit être supérieure à 0';
  }
  if (!formData.value.rooms || formData.value.rooms <= 0) {
    errors.value.rooms = 'Le nombre de pièces doit être supérieur à 0';
  }
  if (!formData.value.rent || formData.value.rent <= 0) {
    errors.value.rent = 'Le loyer doit être supérieur à 0';
  }

  return Object.keys(errors.value).length === 0;
}

async function handleSubmit() {
  if (!validateForm()) return;

  isSubmitting.value = true;

  try {
    // Nettoyer les données (convertir null en 0 ou undefined pour les champs optionnels)
    const cleanData = {
      name: formData.value.name,
      address: formData.value.address,
      type: formData.value.type,
      surface: formData.value.surface || 0,
      rooms: formData.value.rooms || 0,
      bedrooms: formData.value.bedrooms || undefined,
      bathrooms: formData.value.bathrooms || undefined,
      rent: formData.value.rent || 0,
      charges: formData.value.charges || 0,
      deposit: formData.value.deposit || undefined,
      status: formData.value.status,
      description: formData.value.description,
      annonce: formData.value.annonce,
    };

    if (isEditMode.value && props.property?.id) {
      await propertiesStore.updateProperty(props.property.id, cleanData);
    } else {
      await propertiesStore.createProperty(cleanData);
    }

    emit('success');
    handleClose();
  } catch (error) {
    console.error('Failed to save property:', error);
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
        <div class="form-section">
          <h4 class="section-title">Informations générales</h4>

          <Input
            v-model="formData.name"
            label="Nom du bien"
            placeholder="Ex: Appartement Paris 15ème"
            :error="errors.name"
            test-id="property-name"
            required
          />

          <Input
            v-model="formData.address"
            label="Adresse"
            placeholder="123 Rue de la République, 75015 Paris"
            :error="errors.address"
            test-id="property-address"
            required
          />

          <div class="field">
            <label class="field-label">Type de bien <span class="required">*</span></label>
            <select v-model="formData.type" class="select" data-testid="property-type">
              <option value="apartment">Appartement</option>
              <option value="house">Maison</option>
              <option value="commercial">Commercial</option>
              <option value="parking">Parking</option>
              <option value="other">Autre</option>
            </select>
          </div>

          <div class="field">
            <label class="field-label">Statut <span class="required">*</span></label>
            <select v-model="formData.status" class="select" data-testid="property-status">
              <option value="vacant">Vacant</option>
              <option value="occupied">Occupé</option>
              <option value="maintenance">En maintenance</option>
            </select>
          </div>
        </div>

        <!-- Caractéristiques -->
        <div class="form-section">
          <h4 class="section-title">Caractéristiques</h4>

          <div class="field-row">
            <Input
              v-model.number="formData.surface"
              label="Surface (m²)"
              type="number"
              placeholder="50"
              :error="errors.surface"
              test-id="property-surface"
              required
            />

            <Input
              v-model.number="formData.rooms"
              label="Nombre de pièces"
              type="number"
              placeholder="3"
              :error="errors.rooms"
              test-id="property-rooms"
              required
            />
          </div>

          <div class="field-row">
            <Input
              v-model.number="formData.bedrooms"
              label="Chambres"
              type="number"
              placeholder="2"
              test-id="property-bedrooms"
            />

            <Input
              v-model.number="formData.bathrooms"
              label="Salles de bain"
              type="number"
              placeholder="1"
              test-id="property-bathrooms"
            />
          </div>
        </div>

        <!-- Informations financières -->
        <div class="form-section full-width">
          <h4 class="section-title">Informations financières</h4>

          <div class="field-row">
            <Input
              v-model.number="formData.rent"
              label="Loyer mensuel (€)"
              type="number"
              placeholder="1200"
              :error="errors.rent"
              test-id="property-rent"
              required
            />

            <Input
              v-model.number="formData.charges"
              label="Charges (€)"
              type="number"
              placeholder="100"
              test-id="property-charges"
            />

            <Input
              v-model.number="formData.deposit"
              label="Dépôt de garantie (€)"
              type="number"
              placeholder="2400"
              test-id="property-deposit"
            />
          </div>
        </div>

        <!-- Description -->
        <div class="form-section full-width">
          <div class="field">
            <label class="field-label">Description</label>
            <RichTextEditor
              v-model="formData.description"
              placeholder="Ajoutez une description du bien..."
            />
          </div>
        </div>
      </div>
    </form>

    <template #footer>
      <Button
        variant="default"
        @click="handleClose"
        :disabled="isSubmitting"
        data-testid="property-form-cancel"
      >
        Annuler
      </Button>
      <Button
        variant="primary"
        @click="handleSubmit"
        :disabled="isSubmitting"
        icon="check"
        data-testid="property-form-submit"
      >
        {{ isSubmitting ? 'Enregistrement...' : isEditMode ? 'Enregistrer' : 'Créer' }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-6, 1.5rem);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.form-section.full-width {
  grid-column: 1 / -1;
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
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
