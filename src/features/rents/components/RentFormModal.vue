<template>
  <div v-if="modelValue" class="modal-overlay" @click="handleClose">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>
          <i class="mdi mdi-currency-eur"></i>
          Nouveau loyer
        </h3>
        <button class="close-button" type="button" @click="handleClose">
          <i class="mdi mdi-close"></i>
        </button>
      </div>

      <div class="modal-body">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="lease-id" class="form-label"> Bail <span class="required">*</span> </label>
            <select
              id="lease-id"
              v-model="formData.leaseId"
              class="form-select"
              required
              @change="handleLeaseChange"
            >
              <option value="">Sélectionner un bail...</option>
              <option v-for="lease in activeLeases" :key="lease.id" :value="lease.id">
                {{ getLeaseLabel(lease) }}
              </option>
            </select>
            <small v-if="selectedLease" class="form-hint">
              {{ getLeaseDetails(selectedLease) }}
            </small>
          </div>

          <div class="form-group">
            <label for="due-date" class="form-label">
              Date d'échéance <span class="required">*</span>
            </label>
            <input
              id="due-date"
              v-model="formData.dueDate"
              type="date"
              class="form-input"
              required
            />
          </div>

          <div class="form-group">
            <label for="amount" class="form-label">
              Montant du loyer <span class="required">*</span>
            </label>
            <div class="input-with-suffix">
              <input
                id="amount"
                v-model.number="formData.amount"
                type="number"
                step="0.01"
                min="0"
                class="form-input"
                placeholder="0.00"
                required
              />
              <span class="input-suffix">€</span>
            </div>
          </div>

          <div class="form-group">
            <label for="charges" class="form-label">
              Charges <span class="required">*</span>
            </label>
            <div class="input-with-suffix">
              <input
                id="charges"
                v-model.number="formData.charges"
                type="number"
                step="0.01"
                min="0"
                class="form-input"
                placeholder="0.00"
                required
              />
              <span class="input-suffix">€</span>
            </div>
          </div>

          <div v-if="totalAmount > 0" class="total-summary">
            <div class="total-row">
              <span>Total à payer</span>
              <span class="total-amount">{{ totalAmount.toFixed(2) }} €</span>
            </div>
          </div>

          <!-- Submit Buttons -->
          <div class="modal-footer">
            <button type="button" class="btn btn-default" @click="handleClose">Annuler</button>
            <button type="submit" class="btn btn-primary" :disabled="!isFormValid">
              <i class="mdi mdi-check"></i>
              Créer le loyer
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Lease } from '@/db/types';

interface Props {
  modelValue: boolean;
  leases: Lease[];
  properties: any[];
  tenants: any[];
  // Optional initial data for editing an existing rent
  initial?: Partial<RentFormData> & { id?: number };
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'submit', data: RentFormData & { id?: number }): void;
}

interface RentFormData {
  leaseId: number;
  dueDate: string;
  amount: number;
  charges: number;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const formData = ref<RentFormData>({
  leaseId: 0,
  dueDate: '',
  amount: 0,
  charges: 0,
});

const activeLeases = computed(() => {
  return props.leases.filter(lease => lease.status === 'active');
});

const selectedLease = computed(() => {
  return props.leases.find(l => l.id === formData.value.leaseId);
});

const totalAmount = computed(() => {
  return formData.value.amount + formData.value.charges;
});

const isFormValid = computed(() => {
  return (
    formData.value.leaseId > 0 &&
    formData.value.dueDate &&
    formData.value.amount > 0 &&
    formData.value.charges >= 0
  );
});

watch(
  () => props.modelValue,
  newValue => {
    if (newValue) {
      // If initial data is provided (editing), prefill form
      if (props.initial) {
        formData.value = {
          leaseId: props.initial.leaseId || 0,
          dueDate: props.initial.dueDate || getNextMonthFirstDay(),
          amount: props.initial.amount ?? 0,
          charges: props.initial.charges ?? 0,
        };
      } else {
        formData.value = {
          leaseId: 0,
          dueDate: getNextMonthFirstDay(),
          amount: 0,
          charges: 0,
        };
      }
    }
  }
);

function getNextMonthFirstDay(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  return date.toISOString().split('T')[0]!;
}

function getLeaseLabel(lease: Lease): string {
  const property = props.properties.find(p => p.id === lease.propertyId);
  const tenant = props.tenants.find(t => t.id === lease.tenantIds?.[0]);

  if (property && tenant) {
    return `${property.name} - ${tenant.firstName} ${tenant.lastName}`;
  }
  return `Bail #${lease.id}`;
}

function getLeaseDetails(lease: Lease): string {
  const startDate = new Date(lease.startDate).toLocaleDateString('fr-FR');
  return `Début: ${startDate} | Loyer: ${lease.rent}€ | Charges: ${lease.charges}€`;
}

function handleLeaseChange() {
  if (selectedLease.value) {
    formData.value.amount = selectedLease.value.rent;
    formData.value.charges = selectedLease.value.charges;
  }
}

function handleClose() {
  emit('update:modelValue', false);
}

function handleSubmit() {
  if (!isFormValid.value) return;

  // Include id when editing
  const payload: RentFormData & { id?: number } = { ...formData.value };
  if (props.initial && props.initial.id) payload.id = props.initial.id;

  emit('submit', payload);
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
.form-select {
  width: 100%;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  font-family: inherit;
}

.form-input:focus,
.form-select:focus {
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

.total-summary {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.total-amount {
  font-size: 1.25rem;
  color: #4f46e5;
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

.btn-primary {
  background: #4f46e5;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #4338ca;
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
