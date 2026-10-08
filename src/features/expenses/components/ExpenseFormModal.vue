<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Modal from '@/shared/components/Modal.vue';
import Button from '@/shared/components/Button.vue';
import { useNotification } from '@/shared/composables/useNotification';
import { useDocumentsStore } from '@/features/documents/stores/documentsStore';
import type { Expense, ExpenseCategory } from '@/db/types';
import { useExpensesStore } from '../stores/expensesStore';
import {
  EXPENSE_CATEGORIES,
  documentTypeForCategory,
  getExpenseFieldErrors,
  parseDateInput,
  toDateInputValue,
  type ExpenseDraft,
  type ExpenseField,
} from '../services/expensesService';

interface Props {
  modelValue: boolean;
  propertyId: number;
  /** Expense being edited; null/undefined to create a new one. */
  expense?: Expense | null;
}

const props = withDefaults(defineProps<Props>(), { expense: null });

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  saved: [expense: Expense];
}>();

const EMPTY_FILE_ERROR = 'Le fichier sélectionné est vide';

const expensesStore = useExpensesStore();
const documentsStore = useDocumentsStore();
const { success: notifySuccess, error: notifyError } = useNotification();

const form = ref({
  category: '' as ExpenseCategory | '',
  label: '',
  amount: null as number | null,
  date: '',
  notes: '',
});
const selectedFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const errors = ref<Partial<Record<ExpenseField | 'file' | 'form', string>>>({});
const isSubmitting = ref(false);

const isEditMode = computed(() => !!props.expense?.id);
const modalTitle = computed(() =>
  isEditMode.value ? 'Modifier la dépense' : 'Ajouter une dépense'
);

function resetForm() {
  const expense = props.expense;
  form.value = {
    category: expense?.category ?? '',
    label: expense?.label ?? '',
    amount: expense?.amount ?? null,
    date: toDateInputValue(expense?.date ?? new Date()),
    notes: expense?.notes ?? '',
  };
  selectedFile.value = null;
  if (fileInput.value) fileInput.value.value = '';
  errors.value = {};
}

watch(
  () => [props.modelValue, props.expense] as const,
  ([open]) => {
    if (open) resetForm();
  },
  { immediate: true }
);

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
  if (selectedFile.value && selectedFile.value.size === 0) {
    errors.value = { ...errors.value, file: EMPTY_FILE_ERROR };
  } else {
    const next = { ...errors.value };
    delete next.file;
    errors.value = next;
  }
}

function buildDraft(): ExpenseDraft {
  return {
    propertyId: props.propertyId,
    category: form.value.category,
    label: form.value.label,
    amount: form.value.amount,
    date: parseDateInput(form.value.date),
    notes: form.value.notes,
  };
}

async function handleSubmit() {
  if (isSubmitting.value) return;
  const draft = buildDraft();
  const fieldErrors: typeof errors.value = { ...getExpenseFieldErrors(draft) };
  if (selectedFile.value && selectedFile.value.size === 0) fieldErrors.file = EMPTY_FILE_ERROR;
  errors.value = fieldErrors;
  if (Object.keys(fieldErrors).length > 0) return;

  isSubmitting.value = true;
  try {
    const saved =
      isEditMode.value && props.expense?.id
        ? await expensesStore.updateExpense(props.expense.id, draft)
        : await expensesStore.createExpense(draft);

    if (selectedFile.value && saved.id) {
      try {
        await documentsStore.uploadDocument(selectedFile.value, {
          type: documentTypeForCategory(saved.category),
          relatedEntityType: 'expense',
          relatedEntityId: saved.id,
          description: saved.label,
        });
      } catch (uploadError) {
        console.error('Failed to upload expense document:', uploadError);
        notifyError("La dépense est enregistrée mais le justificatif n'a pas pu être ajouté");
      }
    }

    notifySuccess(isEditMode.value ? 'Dépense mise à jour' : 'Dépense enregistrée');
    emit('saved', saved);
    handleClose();
  } catch (error) {
    errors.value = {
      form: error instanceof Error ? error.message : "Échec de l'enregistrement de la dépense",
    };
  } finally {
    isSubmitting.value = false;
  }
}

function handleClose() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="modalTitle"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="expense-form" novalidate @submit.prevent="handleSubmit">
      <div v-if="errors.form" class="form-error" role="alert" data-testid="expense-form-error">
        {{ errors.form }}
      </div>

      <div class="field">
        <label class="field-label" for="expense-category">
          Catégorie <span class="required">*</span>
        </label>
        <select
          id="expense-category"
          v-model="form.category"
          class="select"
          :class="{ 'has-error': errors.category }"
          data-testid="expense-category"
        >
          <option value="" disabled>Sélectionner…</option>
          <option v-for="cat in EXPENSE_CATEGORIES" :key="cat.value" :value="cat.value">
            {{ cat.label }}
          </option>
        </select>
        <div v-if="errors.category" class="field-error">{{ errors.category }}</div>
      </div>

      <div class="field">
        <label class="field-label" for="expense-label">
          Libellé <span class="required">*</span>
        </label>
        <input
          id="expense-label"
          v-model="form.label"
          type="text"
          class="input"
          :class="{ 'has-error': errors.label }"
          placeholder="Ex : Remplacement chaudière"
          data-testid="expense-label"
        />
        <div v-if="errors.label" class="field-error">{{ errors.label }}</div>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="field-label" for="expense-amount">
            Montant (€) <span class="required">*</span>
          </label>
          <input
            id="expense-amount"
            v-model.number="form.amount"
            type="number"
            step="0.01"
            min="0"
            inputmode="decimal"
            class="input"
            :class="{ 'has-error': errors.amount }"
            placeholder="0,00"
            data-testid="expense-amount"
          />
          <div v-if="errors.amount" class="field-error">{{ errors.amount }}</div>
        </div>

        <div class="field">
          <label class="field-label" for="expense-date">
            Date <span class="required">*</span>
          </label>
          <input
            id="expense-date"
            v-model="form.date"
            type="date"
            class="input"
            :class="{ 'has-error': errors.date }"
            data-testid="expense-date"
          />
          <div v-if="errors.date" class="field-error">{{ errors.date }}</div>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="expense-notes">Notes</label>
        <textarea
          id="expense-notes"
          v-model="form.notes"
          class="textarea"
          rows="2"
          placeholder="Fournisseur, n° de facture…"
          data-testid="expense-notes"
        />
      </div>

      <div class="field">
        <label class="field-label" for="expense-file">
          {{ isEditMode ? 'Ajouter un justificatif' : 'Justificatif (optionnel)' }}
        </label>
        <input
          id="expense-file"
          ref="fileInput"
          type="file"
          class="file-input"
          accept="application/pdf,image/*"
          data-testid="expense-file"
          @change="handleFileChange"
        />
        <div v-if="errors.file" class="field-error">{{ errors.file }}</div>
      </div>
    </form>

    <template #footer>
      <Button
        variant="default"
        :disabled="isSubmitting"
        data-testid="expense-form-cancel"
        @click="handleClose"
      >
        Annuler
      </Button>
      <Button
        variant="primary"
        icon="check"
        :disabled="isSubmitting"
        data-testid="expense-form-submit"
        @click="handleSubmit"
      >
        {{ isSubmitting ? 'Enregistrement...' : 'Enregistrer' }}
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.expense-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.field-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4, 1rem);
}

.field-label {
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary, #64748b);
}

.required {
  color: var(--error-500, #ef4444);
}

.input,
.select,
.textarea {
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  font-size: var(--text-base, 1rem);
  font-family: inherit;
  color: var(--text-primary, #0f172a);
  background: var(--bg-primary);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  outline: none;
  transition: all var(--transition-base, 0.2s ease);
}

.input:focus,
.select:focus,
.textarea:focus {
  border-color: var(--primary-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.input.has-error,
.select.has-error {
  border-color: var(--error-500, #ef4444);
}

.textarea {
  resize: vertical;
  line-height: 1.5;
}

.file-input {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-primary, #0f172a);
}

.field-error {
  font-size: var(--text-sm, 0.875rem);
  color: var(--error-600, #dc2626);
}

.form-error {
  padding: var(--space-3, 0.75rem) var(--space-4, 1rem);
  border-radius: var(--radius-md, 0.5rem);
  background: var(--error-50, #fef2f2);
  color: var(--error-700, #b91c1c);
  font-size: var(--text-sm, 0.875rem);
}

/* Makes the native parts (option list, date picker, resize grip) dark too. */
@media (prefers-color-scheme: dark) {
  .input,
  .select,
  .textarea,
  .file-input {
    color-scheme: dark;
  }

  .field-error {
    color: var(--error-500, #ef4444);
  }
}

@media (max-width: 640px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
