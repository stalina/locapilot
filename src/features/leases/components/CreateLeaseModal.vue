<template>
  <Modal
    :modelValue="modelValue"
    title="Créer un bail"
    size="md"
    @update:modelValue="val => $emit('update:modelValue', val)"
  >
    <div class="form-content">
      <div class="field">
        <label class="field-label">Propriété</label>
        <select v-model.number="selectedPropertyId" class="select">
          <option :value="0" disabled>Sélectionner une propriété</option>
          <option v-for="p in properties" :key="p.id" :value="p.id">
            {{ p.name }} · {{ p.address }}
          </option>
        </select>
      </div>

      <div class="field-row">
        <div>
          <label class="field-label">Date de début</label>
          <input type="date" v-model="startDate" class="input" />
        </div>

        <div>
          <label class="field-label">Loyer mensuel (€)</label>
          <input type="number" v-model.number="rent" class="input" />
        </div>
      </div>

      <div class="field-row">
        <div>
          <label class="field-label">Charges (€)</label>
          <input type="number" v-model.number="charges" class="input" />
        </div>
        <div>
          <label class="field-label">Dépôt (€)</label>
          <input type="number" v-model.number="deposit" class="input" />
        </div>
      </div>

      <div class="field">
        <label class="field-label">Jour de paiement</label>
        <input type="number" v-model.number="paymentDay" min="1" max="31" class="input" />
      </div>
    </div>

    <template #footer>
      <div class="modal-actions">
        <Button variant="secondary" @click="cancel">Annuler</Button>
        <Button variant="primary" @click="confirm">Créer</Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { PropType } from 'vue';
import Modal from '../../../shared/components/Modal.vue';
import Button from '../../../shared/components/Button.vue';
import { useLeasesStore } from '../../leases/stores/leasesStore';
import { usePropertiesStore } from '../../properties/stores/propertiesStore';

const props = defineProps({
  modelValue: { type: Boolean as PropType<boolean>, required: true },
  tenantId: { type: Number as PropType<number | undefined>, required: false },
});

const emit = defineEmits(['update:modelValue', 'created']);

const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();

const properties = computed(() => propertiesStore.properties || []);
const selectedPropertyId = ref<number>(properties.value?.[0]?.id ?? 0);
const startDate = ref<string>(new Date().toISOString().slice(0, 10));
const rent = ref<number>(0);
const charges = ref<number>(0);
const deposit = ref<number>(0);
const paymentDay = ref<number>(1);

// Initialize selected property when properties load
watch(
  () => properties.value,
  val => {
    if (val && val.length > 0 && (!selectedPropertyId.value || selectedPropertyId.value === 0)) {
      selectedPropertyId.value = val[0].id as number;
    }
    // If a property is selected, initialize financials
    const sel = properties.value.find(p => p.id === selectedPropertyId.value);
    if (sel) {
      rent.value = sel.rent ?? 0;
      charges.value = sel.charges ?? 0;
      deposit.value = sel.deposit ?? 0;
    }
  },
  { immediate: true }
);

// When selected property changes, update rent/charges/deposit
watch(
  () => selectedPropertyId.value,
  id => {
    const sel = properties.value.find(p => p.id === id);
    if (sel) {
      rent.value = sel.rent ?? 0;
      charges.value = sel.charges ?? 0;
      deposit.value = sel.deposit ?? 0;
    }
  }
);

function close() {
  emit('update:modelValue', false);
}

async function confirm() {
  if (!selectedPropertyId.value || selectedPropertyId.value === 0)
    return alert('Veuillez sélectionner une propriété');
  if (!props.tenantId) return alert('ID du locataire manquant');

  try {
    const leaseData: any = {
      propertyId: Number(selectedPropertyId.value),
      tenantIds: [Number(props.tenantId)],
      startDate: new Date(startDate.value),
      rent: Number(rent.value),
      charges: Number(charges.value || 0),
      deposit: Number(deposit.value || 0),
      paymentDay: Number(paymentDay.value),
      status: 'active',
    };

    const created = await leasesStore.createLease(leaseData);
    emit('created', created);
    close();
  } catch (err) {
    console.error('Failed to create lease:', err);
    alert('Erreur lors de la création du bail');
  }
}

function cancel() {
  close();
}
</script>

<style scoped>
/* Reuse modal form styling similar to LeaseFormModal */
.form-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.field-label {
  font-size: 0.9rem;
  color: var(--text-secondary, #64748b);
}
.input {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
}
.select {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  width: 100%;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
@media (max-width: 768px) {
  .field-row {
    grid-template-columns: 1fr;
  }
}
</style>
