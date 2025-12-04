<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import Modal from '@/shared/components/Modal.vue';
import Button from '@/shared/components/Button.vue';
import { useLeasesStore } from '../stores/leasesStore';
import { db } from '@/db/database';
import type { ChargesAdjustmentRow } from '@/db/types';

const props = withDefaults(defineProps<{ leaseId: number }>(), { leaseId: 0 });
const emit = defineEmits<{}>();

const leasesStore = useLeasesStore();
const rows = ref<ChargesAdjustmentRow[]>([]);
const isLoading = ref(false);
const showAddColumnModal = ref(false);
const newColumnLabel = ref('');

onMounted(async () => {
  isLoading.value = true;
  try {
    rows.value = (await leasesStore.fetchChargesAdjustments(props.leaseId)) || [];

    // Ensure we have rows for each year from lease start year to current year
    // Try to obtain the lease from the store; if missing fetch it
    let lease =
      leasesStore.currentLease && leasesStore.currentLease.id === props.leaseId
        ? leasesStore.currentLease
        : null;
    if (!lease) {
      try {
        await leasesStore.fetchLeaseById(props.leaseId);
        lease = leasesStore.currentLease;
      } catch (e) {
        // ignore - we'll fallback to no auto-generation
      }
    }

    if (lease && lease.startDate) {
      const startYear = new Date(lease.startDate).getFullYear();
      const currentYear = new Date().getFullYear();
      const missingYears: number[] = [];
      for (let y = startYear; y <= currentYear; y++) {
        const exists = rows.value.some(r => r.year === y);
        if (!exists) missingYears.push(y);
      }

      if (missingYears.length > 0) {
        const now = new Date();
        // Create default rows and persist
        for (const y of missingYears) {
          const defaultRow: any = {
            leaseId: props.leaseId,
            year: y,
            monthlyRent: lease.rent ?? 0,
            annualCharges: (lease.charges ?? 0) * 12,
            chargesProvisionPaid: 0,
            rentsPaidCount: 0,
            rentsPaidTotal: 0,
            customCharges: {},
            createdAt: now,
            updatedAt: now,
          };
          // upsert will add since year missing
          await leasesStore.upsertChargesAdjustment(defaultRow as any);
        }
        // reload rows after creation
        rows.value = (await leasesStore.fetchChargesAdjustments(props.leaseId)) || [];
      }
    }
  } finally {
    isLoading.value = false;
  }
});

// After initial load, compute provision sums from rents for each year and persist
async function computeProvisions() {
  if (!props.leaseId) return;
  for (const r of rows.value) {
    try {
      const rents = await db.rents.where({ leaseId: props.leaseId }).toArray();
      const yearRents = rents.filter(rt => {
        try {
          const d = new Date(rt.dueDate);
          return d.getFullYear() === r.year && (rt.status === 'paid' || !!rt.paidDate);
        } catch (e) {
          return false;
        }
      });
      const sum = yearRents.reduce((s, rr) => s + (Number((rr as any).charges) || 0), 0);
      if (r.chargesProvisionPaid !== sum) {
        r.chargesProvisionPaid = sum;
        // persist the computed provision for consistency

        await leasesStore.upsertChargesAdjustment({
          leaseId: r.leaseId,
          year: r.year,
          chargesProvisionPaid: sum,
          customCharges: r.customCharges,
          monthlyRent: r.monthlyRent,
          annualCharges: r.annualCharges,
        });
      }
    } catch (err) {
      // ignore per-row errors
      console.error('Failed to compute provision for year', r.year, err);
    }
  }
}

// compute provisions whenever rows change
watch(rows, () => {
  void computeProvisions();
});

const columns = computed(() => {
  const set = new Set<string>();
  for (const r of rows.value) {
    if (r.customCharges) {
      Object.keys(r.customCharges).forEach(k => set.add(k));
    }
  }
  return Array.from(set);
});

function startAddColumn() {
  newColumnLabel.value = '';
  showAddColumnModal.value = true;
}

async function confirmAddColumn() {
  const label = newColumnLabel.value.trim();
  if (!label) return;

  // Add the column key to each row with default 0 and save
  for (const r of rows.value) {
    const custom = { ...(r.customCharges ?? {}) };
    if (!(label in custom)) custom[label] = 0;
    r.customCharges = custom;
    await leasesStore.upsertChargesAdjustment({
      leaseId: r.leaseId,
      year: r.year,
      customCharges: r.customCharges,
    });
  }

  showAddColumnModal.value = false;
}

function computeCustomTotal(r: ChargesAdjustmentRow) {
  if (!r.customCharges) return 0;
  const values = Object.values(r.customCharges).map(v => Number(v) || 0);
  return values.reduce((s, v) => s + v, 0);
}

function computeRegulation(r: ChargesAdjustmentRow) {
  return (Number(r.chargesProvisionPaid) || 0) - computeCustomTotal(r);
}

async function onCellChange(r: ChargesAdjustmentRow, key: string, value: number) {
  if (!r.customCharges) r.customCharges = {};
  r.customCharges[key] = value;
  await leasesStore.upsertChargesAdjustment({
    leaseId: r.leaseId,
    year: r.year,
    customCharges: r.customCharges,
  });
}

function handleInput(e: Event, r: ChargesAdjustmentRow, key: string) {
  const v = Number((e.target as HTMLInputElement).value || 0);
  void onCellChange(r, key, v);
}

async function onRowUpdate(r: ChargesAdjustmentRow) {
  await leasesStore.upsertChargesAdjustment({
    leaseId: r.leaseId,
    year: r.year,
    monthlyRent: r.monthlyRent,
    annualCharges: r.annualCharges,
    chargesProvisionPaid: r.chargesProvisionPaid,
    rentsPaidCount: r.rentsPaidCount,
    rentsPaidTotal: r.rentsPaidTotal,
    customCharges: r.customCharges,
  });
}
</script>

<template>
  <div class="charges-adjustment">
    <div class="card-header small">
      <h3>
        <i class="mdi mdi-scale-balance"></i>
        Régularisation des charges
      </h3>
      <div class="header-actions">
        <Button variant="outline" icon="plus" @click="startAddColumn">Ajouter une colonne</Button>
      </div>
    </div>

    <div v-if="isLoading" class="loading-state">Chargement...</div>

    <table class="charges-table" v-else>
      <thead>
        <tr>
          <th>Année</th>
          <th>Loyer</th>
          <th>Charge</th>
          <th>Provision de charges payée</th>
          <th v-for="col in columns" :key="col">{{ col }}</th>
          <th>Total charges</th>
          <th>Régulation</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.year">
          <td>{{ r.year }}</td>
          <td>
            <span>{{ (Number(r.monthlyRent) || 0).toLocaleString('fr-FR') }} €</span>
          </td>
          <td>
            <span>
              {{
                (
                  Number(
                    r.annualCharges
                      ? r.annualCharges / 12
                      : (leasesStore.currentLease?.charges ?? 0)
                  ) || 0
                ).toLocaleString('fr-FR')
              }}
              €
            </span>
          </td>
          <td>
            <span>{{ (Number(r.chargesProvisionPaid) || 0).toLocaleString('fr-FR') }} €</span>
          </td>

          <td v-for="col in columns" :key="col">
            <input
              type="number"
              class="input-small"
              :value="(r.customCharges && r.customCharges[col]) || 0"
              @input="e => handleInput(e, r, col)"
            />
          </td>

          <td>{{ computeCustomTotal(r).toLocaleString('fr-FR') }} €</td>
          <td>{{ computeRegulation(r).toLocaleString('fr-FR') }} €</td>
        </tr>
      </tbody>
    </table>

    <Modal v-model="showAddColumnModal" title="Ajouter une colonne" size="sm">
      <div class="form-row">
        <label>Libellé de la colonne</label>
        <input v-model="newColumnLabel" type="text" />
      </div>
      <template #footer>
        <Button variant="outline" @click="() => (showAddColumnModal = false)">Annuler</Button>
        <Button @click="confirmAddColumn">Ajouter</Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.charges-table {
  width: 100%;
  border-collapse: collapse;
}
.charges-table th,
.charges-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  text-align: left;
  vertical-align: middle;
}
.charges-table .input-small {
  width: 100px;
}
</style>
