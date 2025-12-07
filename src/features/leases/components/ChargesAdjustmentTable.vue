<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
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
    // Nettoyer customCharges pour ne garder que des nombres
    r.customCharges = JSON.parse(
      JSON.stringify(
        Object.fromEntries(Object.entries(custom).map(([k, v]) => [k, Number(v) || 0]))
      )
    );
    const payload = {
      leaseId: r.leaseId,
      year: r.year,
      monthlyRent: r.monthlyRent ?? 0,
      annualCharges: r.annualCharges ?? 0,
      chargesProvisionPaid: r.chargesProvisionPaid ?? 0,
      rentsPaidCount: r.rentsPaidCount ?? 0,
      rentsPaidTotal: r.rentsPaidTotal ?? 0,
      customCharges: r.customCharges,
    };
    console.log('Upsert charges adjustment (add column):', payload);
    await leasesStore.upsertChargesAdjustment(payload);
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

// Utilitaire pour charger un fichier en binaire
function loadBinary(url: string) {
  return fetch(url).then(res => res.arrayBuffer());
}

async function generateRegulLetter(r: ChargesAdjustmentRow) {
  try {
    const content = await loadBinary('/templateRegulCharge.docx');
    const zip = new PizZip(content as any);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    // Charger des données additionnelles depuis la table settings (clé: 'senderAddress')
    let ownerAddress = '';
    try {
      const s = await db.settings.where('key').equals('senderAddress').first();
      if (s && s.value) ownerAddress = String(s.value || '');
    } catch (e) {
      // ignore si la clé n'existe pas
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const filenameDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const filename = `${filenameDate}_courrierInfoRegulCharge.docx`;

    // Remplir les données du template
    // Try to build tenantFullName: "M. Last First" or "Mme Last First"
    let tenantFullName = '';
    let tenantName = '';
    let propertyName = '';
    let propertyAddress = '';
    try {
      const lease = await db.leases.get(r.leaseId);
      if (lease && Array.isArray((lease as any).tenantIds) && (lease as any).tenantIds.length > 0) {
        const tenantId = (lease as any).tenantIds[0];
        const tenant = await db.tenants.get(tenantId);
        if (tenant) {
          const civLabel = tenant.civility === 'mr' ? 'M.' : tenant.civility === 'mme' ? 'Mme' : '';
          tenantFullName =
            `${civLabel ? civLabel + ' ' : ''}${tenant.lastName} ${tenant.firstName}`.trim();
          tenantName = `${civLabel ? civLabel + ' ' : ''}${tenant.lastName}`.trim();
        }
      }
      // Also resolve property details
      if (lease && (lease as any).propertyId) {
        try {
          const prop = await db.properties.get((lease as any).propertyId);
          if (prop) {
            propertyName = prop.name || '';
            propertyAddress = prop.address || '';
          }
        } catch (e) {
          // ignore property lookup errors
        }
      }
    } catch (err) {
      // ignore tenant lookup errors
      console.error('Unable to resolve tenant for document generation', err);
    }

    doc.render({
      year: r.year,
      provisionPaid: Number(r.chargesProvisionPaid) || 0,
      totalCharges: computeCustomTotal(r),
      regulation: computeRegulation(r),
      ownerAddress,
      date: new Date().toLocaleDateString('fr-FR'),
      tenantFullName,
      tenantName,
      propertyName,
      propertyAddress,
    });

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    saveAs(out, filename);
  } catch (error) {
    console.error('Erreur génération courrier régularisation :', error);
  }
}

async function onCellChange(r: ChargesAdjustmentRow, key: string, value: number) {
  if (!r.customCharges) r.customCharges = {};
  r.customCharges[key] = Number(value) || 0;
  // Nettoyer customCharges pour ne garder que des nombres et forcer la sérialisation
  r.customCharges = JSON.parse(
    JSON.stringify(
      Object.fromEntries(Object.entries(r.customCharges).map(([k, v]) => [k, Number(v) || 0]))
    )
  );
  const payload = {
    leaseId: r.leaseId,
    year: r.year,
    monthlyRent: r.monthlyRent ?? 0,
    annualCharges: r.annualCharges ?? 0,
    chargesProvisionPaid: r.chargesProvisionPaid ?? 0,
    rentsPaidCount: r.rentsPaidCount ?? 0,
    rentsPaidTotal: r.rentsPaidTotal ?? 0,
    customCharges: r.customCharges,
  };
  console.log('Upsert charges adjustment (cell change):', payload);
  await leasesStore.upsertChargesAdjustment(payload);
}

function handleInput(e: Event, r: ChargesAdjustmentRow, key: string) {
  const v = Number((e.target as HTMLInputElement).value || 0);
  void onCellChange(r, key, v);
}

// (onRowUpdate removed - not used)
</script>

<template>
  <div class="charges-adjustment">
    <div class="card-header small flex-row-between">
      <h3>
        <i class="mdi mdi-scale-balance"></i>
        Régularisation des charges
      </h3>
      <Button variant="outline" icon="plus" @click="startAddColumn">Ajouter une charge</Button>
    </div>

    <div v-if="isLoading" class="loading-state">Chargement...</div>

    <div class="charges-table-wrapper" v-else>
      <table class="charges-table">
        <thead>
          <tr>
            <th class="compact-th info-th">Année</th>
            <th class="compact-th info-th">Loyer</th>
            <th class="compact-th info-th">Charge</th>
            <th class="compact-th total-th">Provision<br />de charges<br />payée</th>
            <th v-for="col in columns" :key="col" class="compact-th custom-col">{{ col }}</th>
            <th class="compact-th total-th">Total<br />charges</th>
            <th class="compact-th reg-th">Régularisation</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.year">
            <td class="info-td">{{ r.year }}</td>
            <td class="info-td">
              <span class="nowrap"
                >{{ (Number(r.monthlyRent) || 0).toLocaleString('fr-FR') }}&nbsp;€</span
              >
            </td>
            <td class="info-td">
              <span class="nowrap">
                {{
                  (
                    Number(
                      r.annualCharges
                        ? r.annualCharges / 12
                        : (leasesStore.currentLease?.charges ?? 0)
                    ) || 0
                  ).toLocaleString('fr-FR')
                }}&nbsp;€
              </span>
            </td>
            <td class="total-td">
              <span class="nowrap"
                >{{ (Number(r.chargesProvisionPaid) || 0).toLocaleString('fr-FR') }}&nbsp;€</span
              >
            </td>

            <td v-for="col in columns" :key="col">
              <input
                type="number"
                class="input charge-input"
                :value="(r.customCharges && r.customCharges[col]) || 0"
                @change="e => handleInput(e, r, col)"
                min="0"
                step="1"
                :aria-label="col + ' pour ' + r.year"
              />
            </td>

            <td class="total-td">
              <span class="nowrap">{{ computeCustomTotal(r).toLocaleString('fr-FR') }}&nbsp;€</span>
            </td>
            <td class="reg-td">
              <div style="display: flex; align-items: center; gap: 8px; justify-content: center">
                <span
                  class="nowrap reg-badge"
                  :class="{
                    'reg-pos': computeRegulation(r) > 0,
                    'reg-neg': computeRegulation(r) < 0,
                    'reg-zero': computeRegulation(r) === 0,
                  }"
                >
                  {{ computeRegulation(r).toLocaleString('fr-FR') }}&nbsp;€
                </span>
                <button
                  class="icon-button"
                  title="Générer le courrier"
                  @click.prevent="() => generateRegulLetter(r)"
                >
                  <i class="mdi mdi-email-outline" aria-hidden="true"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Modal v-model="showAddColumnModal" title="Ajouter une colonne" size="sm">
      <div class="form-row">
        <label for="charge-label-input">Libellé de la colonne</label>
        <input
          id="charge-label-input"
          v-model="newColumnLabel"
          type="text"
          class="input charge-input"
          placeholder="Ex : Eau, Électricité..."
          maxlength="32"
        />
      </div>
      <template #footer>
        <Button variant="outline" @click="() => (showAddColumnModal = false)">Annuler</Button>
        <Button @click="confirmAddColumn">Ajouter</Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.info-th {
  color: var(--text-muted, #8a99b3);
  font-weight: 400;
  font-style: italic;
}
.info-td {
  color: var(--text-muted, #8a99b3);
  font-style: italic;
}
.total-th,
.total-td {
  font-weight: 600;
  color: var(--primary-color, #2563eb);
  background: var(--surface-alt, #f3f6fa);
}
.reg-th {
  font-weight: 600;
  color: var(--text-color, #222);
}
.reg-td {
  text-align: center;
}
.reg-badge {
  display: inline-block;
  min-width: 60px;
  padding: 4px 10px;
  border-radius: 16px;
  font-weight: 600;
  font-size: 1em;
  background: #f4f4f4;
  color: #222;
  transition:
    background 0.2s,
    color 0.2s;
}
.reg-pos {
  background: #e6fbe8;
  color: #15803d;
}
.reg-neg {
  background: #fbeaea;
  color: #b91c1c;
}
.reg-zero {
  background: #f3f6fa;
  color: #64748b;
}
.th-help {
  display: inline-block;
  margin-left: 4px;
  color: var(--primary-color, #2563eb);
  font-size: 0.9em;
  cursor: help;
  border-radius: 50%;
  width: 1.1em;
  height: 1.1em;
  text-align: center;
  line-height: 1.1em;
  background: #eaf1fb;
}
.nowrap {
  white-space: nowrap;
}
.charges-table-wrapper {
  width: 100%;
  overflow-x: auto;
  margin-bottom: 16px;
}
.charges-table-wrapper::-webkit-scrollbar {
  height: 8px;
}
.charges-table-wrapper::-webkit-scrollbar-thumb {
  background: var(--border-color, #e2e8f0);
  border-radius: 4px;
}
.charges-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 700px;
  font-size: 1rem;
  background: var(--surface-color, #fff);
}
.charges-table th,
.charges-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  text-align: left;
  vertical-align: middle;
  font-family: inherit;
}
.icon-button {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  color: var(--primary-color, #2563eb);
}
.icon-button:hover {
  background: rgba(37, 99, 235, 0.08);
}
.icon-button i {
  font-size: 1.15em;
}
.charges-table th {
  font-weight: 600;
  font-size: 1.05em;
  background: var(--surface-alt, #f8fafc);
  max-width: 120px;
  min-width: 70px;
  white-space: pre-line;
  word-break: keep-all;
  overflow-wrap: normal;
  hyphens: none;
  text-align: center;
  font-size: 0.97em;
  padding-top: 14px;
  padding-bottom: 14px;
}
.compact-th {
  max-width: 110px;
  min-width: 60px;
  white-space: pre-line;
  word-break: keep-all;
  overflow-wrap: normal;
  hyphens: none;
  text-align: center;
  font-size: 0.97em;
  padding-top: 10px;
  padding-bottom: 10px;
}
.custom-col {
  background: var(--surface-alt, #f3f6fa);
  font-variant: small-caps;
}
.charge-input {
  width: 90px;
  padding: 6px 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  font-size: 1em;
  background: var(--input-bg, #fff);
  color: var(--text-color, #222);
  transition: border-color 0.2s;
  outline: none;
}
.charge-input:focus {
  border-color: var(--primary-color, #3b82f6);
  background: var(--input-focus-bg, #f0f6ff);
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.form-row label {
  font-weight: 500;
  margin-bottom: 2px;
  color: var(--text-color, #222);
}
.form-row .charge-input {
  width: 100%;
  max-width: 320px;
}
.flex-row-between {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
@media (max-width: 900px) {
  .charges-table {
    font-size: 0.95em;
    min-width: 500px;
  }
  .charge-input {
    width: 70px;
    font-size: 0.95em;
  }
}
@media (max-width: 600px) {
  .charges-table-wrapper {
    margin-bottom: 8px;
    max-width: 100vw;
    padding-bottom: 8px;
  }
  .charges-table {
    font-size: 0.92em;
    min-width: 350px;
  }
  .charge-input {
    width: 50px;
    font-size: 0.9em;
    padding: 4px 6px;
  }
  .charges-table th,
  .charges-table td {
    padding: 7px 6px;
  }
  .form-row .charge-input {
    max-width: 100vw;
  }
}

.flex-row-between {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
</style>
