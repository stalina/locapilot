<template>
  <div v-if="modelValue" class="modal-overlay" @click="handleClose">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <i class="mdi mdi-currency-eur"></i>
          Enregistrer un paiement
        </h3>
        <button class="close-button" type="button" @click="handleClose">
          <i class="mdi mdi-close"></i>
        </button>
      </div>

      <div class="modal-body">
        <!-- Rent Info -->
        <div class="rent-summary">
          <div class="info-row">
            <span class="info-label">Bien</span>
            <span class="info-value">{{ propertyName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Locataire</span>
            <span class="info-value">{{ tenantName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Échéance</span>
            <span class="info-value">{{ formatDate(rent.dueDate) }}</span>
          </div>
          <div class="info-row highlight">
            <span class="info-label">Montant dû</span>
            <span class="info-value amount">{{ rent.amount.toLocaleString('fr-FR') }} €</span>
          </div>
        </div>

        <!-- Payment Form -->
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="payment-date" class="form-label">
              Date de paiement <span class="required">*</span>
            </label>
            <input
              id="payment-date"
              v-model="formData.paymentDate"
              type="date"
              class="form-input"
              :max="maxDate"
              required
            />
          </div>

          <div class="form-group">
            <label for="payment-amount" class="form-label">
              Montant payé <span class="required">*</span>
            </label>
            <div class="input-with-suffix">
              <input
                id="payment-amount"
                v-model.number="formData.amount"
                type="number"
                step="0.01"
                min="0"
                :max="rent.amount"
                class="form-input"
                placeholder="0.00"
                required
              />
              <span class="input-suffix">€</span>
            </div>
            <small v-if="formData.amount < rent.amount" class="form-hint warning">
              Paiement partiel : {{ (rent.amount - formData.amount).toFixed(2) }} € restant
            </small>
          </div>

          <div class="form-group">
            <label for="payment-method" class="form-label">
              Méthode de paiement <span class="required">*</span>
            </label>
            <select
              id="payment-method"
              v-model="formData.paymentMethod"
              class="form-select"
              required
            >
              <option value="">Sélectionner...</option>
              <option value="transfer">Virement bancaire</option>
              <option value="check">Chèque</option>
              <option value="cash">Espèces</option>
              <option value="card">Carte bancaire</option>
              <option value="online">Paiement en ligne</option>
            </select>
          </div>

          <div class="form-group">
            <label for="payment-reference" class="form-label">
              Référence (optionnel)
            </label>
            <input
              id="payment-reference"
              v-model="formData.reference"
              type="text"
              class="form-input"
              placeholder="ex: numéro de chèque, référence virement..."
            />
          </div>

          <div class="form-group">
            <label for="payment-notes" class="form-label">
              Notes (optionnel)
            </label>
            <textarea
              id="payment-notes"
              v-model="formData.notes"
              class="form-textarea"
              rows="3"
              placeholder="Informations complémentaires..."
            ></textarea>
          </div>

          <!-- Submit Buttons -->
          <div class="modal-footer">
            <button type="button" class="btn btn-default" @click="handleClose">
              Annuler
            </button>
            <button type="submit" class="btn btn-success" :disabled="!isFormValid">
              <i class="mdi mdi-check"></i>
              Valider le paiement
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Rent } from '@/db/types';

interface Props {
  modelValue: boolean;
  rent: Rent;
  propertyName: string;
  tenantName: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', data: PaymentData): void;
}

interface PaymentData {
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const formData = ref<PaymentData>({
  paymentDate: new Date().toISOString().split('T')[0]!,
  amount: props.rent.amount,
  paymentMethod: '',
  reference: '',
  notes: '',
});

const maxDate = computed(() => {
  return new Date().toISOString().split('T')[0]!;
});

const isFormValid = computed(() => {
  return (
    formData.value.paymentDate &&
    formData.value.amount > 0 &&
    formData.value.amount <= props.rent.amount &&
    formData.value.paymentMethod
  );
});

watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    // Reset form when modal opens
    formData.value = {
      paymentDate: new Date().toISOString().split('T')[0]!,
      amount: props.rent.amount,
      paymentMethod: '',
      reference: '',
      notes: '',
    };
  }
});

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function handleClose() {
  emit('update:modelValue', false);
}

function handleSubmit() {
  if (!isFormValid.value) return;
  
  emit('submit', { ...formData.value });
  handleClose();
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.modal {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.modal-header h3 i {
  color: #4f46e5;
}

.close-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.2s ease;
  font-size: 1.25rem;
  color: #64748b;
}

.close-button:hover {
  background: #f1f5f9;
}

.modal-body {
  padding: 1.5rem;
}

.rent-summary {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid #e2e8f0;
}

.info-row.highlight {
  background: white;
  padding: 0.75rem;
  border-radius: 0.5rem;
  margin-top: 0.5rem;
  border: none;
}

.info-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
}

.info-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
}

.info-value.amount {
  font-size: 1.125rem;
  color: #4f46e5;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.5rem;
}

.required {
  color: #ef4444;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  font-family: inherit;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.input-with-suffix {
  position: relative;
}

.input-with-suffix .form-input {
  padding-right: 2.5rem;
}

.input-suffix {
  position: absolute;
  right: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
  pointer-events: none;
}

.form-hint {
  display: block;
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: #64748b;
}

.form-hint.warning {
  color: #f59e0b;
  font-weight: 500;
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e2e8f0;
}

.btn {
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-default {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-default:hover:not(:disabled) {
  background: #f9fafb;
}

.btn-success {
  background: #10b981;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #059669;
}

@media (max-width: 640px) {
  .modal {
    max-width: 100%;
    margin: 0;
    border-radius: 0;
  }

  .modal-footer {
    flex-direction: column-reverse;
  }

  .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
