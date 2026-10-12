<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import Alert from '@/shared/components/Alert.vue';
import Badge from '@/shared/components/Badge.vue';
import Button from '@/shared/components/Button.vue';
import Card from '@/shared/components/Card.vue';
import { useExport } from '@/shared/composables/useExport';
import { useNotification } from '@/shared/composables/useNotification';
import { formatCurrency, formatDate, formatNumber } from '@/shared/utils/formatters';
import { fetchFiscalSources, type FiscalSources } from '../repositories/fiscalRepository';
import {
  DEFICIT_LABEL,
  FISCAL_DISCLAIMER,
  availableFiscalYears,
  build2044Csv,
  build2044Table,
  computeFiscalYear,
  defaultFiscalYear,
  fiscalCsvFilename,
  isMicroFoncierEligible,
  type Table2044Row,
} from '../services/fiscalService';

const LMNP_BANNER =
  'La déclaration 2044 concerne les locations nues. Les locations meublées (LMNP) relèvent des BIC : décochez les biens concernés.';
const MICRO_FONCIER_HINT =
  'Vos revenus bruts sont inférieurs ou égaux à 15 000 € : vous pouvez relever du régime micro-foncier (case 4BE de la déclaration 2042) au lieu de la 2044.';
const UNALLOCATED_HINT = 'Reclassez ces dépenses dans une catégorie déductible si elles le sont';

const { exportCSVContent, isExporting } = useExport();
const { error: notifyError } = useNotification();

const isLoading = ref(true);
const sources = ref<FiscalSources>({ properties: [], leases: [], rents: [], expenses: [] });
const generatedAt = new Date();
const selectedYear = ref(defaultFiscalYear(generatedAt));
/** Properties unchecked by the user for the selected year (not persisted). */
const excludedIds = ref<Set<number>>(new Set());

const years = computed(() => availableFiscalYears({ ...sources.value, now: generatedAt }));

const perProperty = computed(() =>
  computeFiscalYear({ ...sources.value, year: selectedYear.value })
);

const includedIds = computed(
  () => new Set(perProperty.value.map(p => p.propertyId).filter(id => !excludedIds.value.has(id)))
);

const table = computed(() => build2044Table(perProperty.value, includedIds.value));
const included = computed(() => perProperty.value.filter(p => includedIds.value.has(p.propertyId)));

const hasActivity = computed(() => perProperty.value.length > 0);
const hasIncluded = computed(() => table.value.columns.length > 0);
const showMicroFoncierHint = computed(
  () => hasIncluded.value && isMicroFoncierEligible(table.value.totals[211])
);

const incomeTotals = computed(() => {
  const totals = { rentIncome: 0, chargesCollected: 0, rentsCollected: 0 };
  for (const p of included.value) {
    totals.rentIncome += p.rentIncome;
    totals.chargesCollected += p.chargesCollected;
    totals.rentsCollected += p.rentsCollected;
  }
  return totals;
});

const unallocated = computed(() =>
  included.value.flatMap(p => p.unallocatedExpenses.map(e => ({ ...e, propertyName: p.name })))
);
const unallocatedTotal = computed(
  () => Math.round(included.value.reduce((sum, p) => sum + p.unallocatedTotal, 0) * 100) / 100
);

// The inclusion choice is reset whenever the year changes.
watch(selectedYear, () => {
  excludedIds.value = new Set();
});

function isIncluded(propertyId: number): boolean {
  return !excludedIds.value.has(propertyId);
}

function setIncluded(propertyId: number, value: boolean) {
  const next = new Set(excludedIds.value);
  if (value) next.delete(propertyId);
  else next.add(propertyId);
  excludedIds.value = next;
}

function onIncludeChange(propertyId: number, event: Event) {
  setIncluded(propertyId, (event.target as HTMLInputElement).checked);
}

function formatEuro(value: number): string {
  return `${formatNumber(value)} €`;
}

function isDeficit(row: Table2044Row, value: number): boolean {
  return row.line === 261 && value < 0;
}

async function handleExportCsv() {
  if (!hasIncluded.value) return;
  try {
    await exportCSVContent(build2044Csv(table.value), fiscalCsvFilename(selectedYear.value));
  } catch {
    // useExport already notified the error.
  }
}

function handlePrint() {
  if (!hasIncluded.value) return;
  window.print();
}

onMounted(async () => {
  try {
    sources.value = await fetchFiscalSources();
  } catch (err) {
    console.error('Fiscal summary load error:', err);
    notifyError('Impossible de charger les données du récapitulatif fiscal');
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="view-container fiscal-view">
    <header class="view-header no-print">
      <div>
        <h1>Récapitulatif fiscal</h1>
        <p class="subtitle">
          Revenus fonciers de l'année : aide au remplissage de la déclaration 2044 (régime réel).
        </p>
      </div>
      <div class="header-actions">
        <label class="sr-only" for="fiscal-year">Année</label>
        <select
          id="fiscal-year"
          v-model.number="selectedYear"
          class="year-select"
          data-testid="fiscal-year-select"
        >
          <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
        </select>
        <Button
          variant="secondary"
          icon="file-delimited"
          :disabled="!hasIncluded"
          :loading="isExporting"
          data-testid="fiscal-export-csv"
          @click="handleExportCsv"
        >
          Exporter en CSV
        </Button>
        <Button
          variant="primary"
          icon="printer"
          :disabled="!hasIncluded"
          data-testid="fiscal-print"
          @click="handlePrint"
        >
          Imprimer / PDF
        </Button>
      </div>
    </header>

    <!-- Printed header -->
    <header class="print-header print-only">
      <h1>Récapitulatif fiscal {{ selectedYear }}</h1>
      <p>Généré le {{ formatDate(generatedAt) }}</p>
    </header>

    <Alert variant="info" class="no-print" data-testid="fiscal-lmnp-banner">
      {{ LMNP_BANNER }}
    </Alert>

    <div v-if="isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i> Chargement…
    </div>

    <Card v-else-if="!hasActivity" :hover="false" class="fiscal-card">
      <div class="empty-placeholder" data-testid="fiscal-empty">
        <i class="mdi mdi-calculator-variant"></i>
        <p>Aucun revenu ni dépense enregistré pour {{ selectedYear }}</p>
      </div>
    </Card>

    <template v-else>
      <!-- Income recap -->
      <Card :hover="false" class="fiscal-card">
        <h2 class="card-title">
          <i class="mdi mdi-cash-multiple"></i>
          Revenus encaissés en {{ selectedYear }}
        </h2>
        <div class="table-scroll">
          <table class="fiscal-table" data-testid="fiscal-income-table">
            <thead>
              <tr>
                <th>Bien</th>
                <th class="no-print">Inclure dans la 2044</th>
                <th class="num">Loyers encaissés (hors charges)</th>
                <th class="num">Charges encaissées</th>
                <th class="num">Loyers encaissés</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in perProperty"
                :key="p.propertyId"
                :class="{ 'is-excluded': !isIncluded(p.propertyId) }"
                data-testid="fiscal-income-row"
              >
                <td>
                  <span class="property-name">{{ p.name }}</span>
                  <Badge
                    v-if="!isIncluded(p.propertyId)"
                    variant="default"
                    data-testid="fiscal-excluded-badge"
                    >Exclu</Badge
                  >
                </td>
                <td class="no-print">
                  <label class="include-toggle">
                    <input
                      type="checkbox"
                      :checked="isIncluded(p.propertyId)"
                      :aria-label="`Inclure ${p.name} dans la 2044`"
                      data-testid="fiscal-include-checkbox"
                      @change="onIncludeChange(p.propertyId, $event)"
                    />
                    <span>Inclure dans la 2044</span>
                  </label>
                </td>
                <td class="num" data-testid="fiscal-rent-income">
                  {{ formatCurrency(p.rentIncome) }}
                </td>
                <td class="num" data-testid="fiscal-charges-collected">
                  {{ formatCurrency(p.chargesCollected) }}
                </td>
                <td class="num" data-testid="fiscal-rents-count">{{ p.rentsCollected }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th>Total (biens inclus)</th>
                <td class="no-print"></td>
                <td class="num" data-testid="fiscal-rent-income-total">
                  {{ formatCurrency(incomeTotals.rentIncome) }}
                </td>
                <td class="num">{{ formatCurrency(incomeTotals.chargesCollected) }}</td>
                <td class="num">{{ incomeTotals.rentsCollected }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <!-- 2044 table -->
      <Card :hover="false" class="fiscal-card">
        <h2 class="card-title">
          <i class="mdi mdi-file-table"></i>
          Déclaration 2044 — montants à reporter (en euros)
        </h2>
        <div v-if="!hasIncluded" class="empty-placeholder" data-testid="fiscal-none-included">
          <p>Aucun bien inclus dans la déclaration</p>
        </div>
        <template v-else>
          <div class="table-scroll">
            <table class="fiscal-table table-2044" data-testid="fiscal-2044-table">
              <thead>
                <tr>
                  <th>Ligne</th>
                  <th>Libellé</th>
                  <th v-for="col in table.columns" :key="col.propertyId" class="num">
                    {{ col.name }}
                  </th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in table.rows"
                  :key="row.line"
                  :class="{
                    'is-total': row.line === 214 || row.line === 240 || row.line === 261,
                  }"
                  :data-testid="`fiscal-line-${row.line}`"
                >
                  <td class="line-number">{{ row.line }}</td>
                  <td class="line-label">
                    {{ row.label }}
                    <span v-if="row.manual" class="line-flag" data-testid="fiscal-manual-flag">
                      À compléter manuellement
                    </span>
                    <span v-else-if="row.hint" class="line-hint" data-testid="fiscal-line-hint">
                      {{ row.hint }}
                    </span>
                  </td>
                  <td
                    v-for="(amount, i) in row.amounts"
                    :key="table.columns[i]?.propertyId"
                    class="num"
                    :class="{ 'is-negative': isDeficit(row, amount) }"
                    data-testid="fiscal-line-amount"
                  >
                    {{ formatEuro(amount) }}
                    <span v-if="isDeficit(row, amount)" class="deficit-label">{{
                      DEFICIT_LABEL
                    }}</span>
                  </td>
                  <td
                    class="num line-total"
                    :class="{ 'is-negative': isDeficit(row, row.total) }"
                    data-testid="fiscal-line-total"
                  >
                    {{ formatEuro(row.total) }}
                    <span v-if="isDeficit(row, row.total)" class="deficit-label">{{
                      DEFICIT_LABEL
                    }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-if="showMicroFoncierHint"
            class="fiscal-hint"
            data-testid="fiscal-micro-foncier-hint"
          >
            <i class="mdi mdi-information-outline"></i>
            {{ MICRO_FONCIER_HINT }}
          </p>
        </template>
      </Card>

      <!-- Expense detail per property -->
      <Card v-if="hasIncluded" :hover="false" class="fiscal-card">
        <h2 class="card-title">
          <i class="mdi mdi-receipt-text-outline"></i>
          Détail des dépenses {{ selectedYear }}
        </h2>
        <section
          v-for="p in included"
          :key="p.propertyId"
          class="expense-detail"
          data-testid="fiscal-expense-detail"
        >
          <h3>{{ p.name }}</h3>
          <p v-if="!p.expenses.length" class="muted">Aucune dépense enregistrée</p>
          <div v-else class="table-scroll">
            <table class="fiscal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Catégorie</th>
                  <th>Libellé</th>
                  <th class="num">Montant</th>
                  <th class="num">Ligne 2044</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(e, i) in p.expenses"
                  :key="e.id ?? `${p.propertyId}-${i}`"
                  data-testid="fiscal-expense-row"
                >
                  <td>{{ formatDate(e.date) }}</td>
                  <td>{{ e.categoryLabel }}</td>
                  <td>{{ e.label }}</td>
                  <td class="num">{{ formatCurrency(e.amount) }}</td>
                  <td class="num">{{ e.line ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </Card>

      <!-- Unmapped expenses -->
      <Card
        v-if="hasIncluded && unallocated.length"
        :hover="false"
        class="fiscal-card"
        data-testid="fiscal-unallocated"
      >
        <h2 class="card-title">
          <i class="mdi mdi-help-circle-outline"></i>
          Dépenses non ventilées
        </h2>
        <p class="fiscal-hint">
          <i class="mdi mdi-information-outline"></i>
          {{ UNALLOCATED_HINT }}
        </p>
        <div class="table-scroll">
          <table class="fiscal-table">
            <thead>
              <tr>
                <th>Bien</th>
                <th>Date</th>
                <th>Libellé</th>
                <th class="num">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(e, i) in unallocated" :key="e.id ?? i">
                <td>{{ e.propertyName }}</td>
                <td>{{ formatDate(e.date) }}</td>
                <td>{{ e.label }}</td>
                <td class="num">{{ formatCurrency(e.amount) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th colspan="3">Total</th>
                <td class="num" data-testid="fiscal-unallocated-total">
                  {{ formatCurrency(unallocatedTotal) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </template>

    <p class="disclaimer" data-testid="fiscal-disclaimer">
      <i class="mdi mdi-alert-circle-outline"></i>
      {{ FISCAL_DISCLAIMER }}
    </p>
  </div>
</template>

<style scoped>
.fiscal-view {
  display: flex;
  flex-direction: column;
  gap: var(--space-6, 1.5rem);
}

.fiscal-view > .view-header {
  margin-bottom: 0;
}

.header-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.year-select {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  font-size: var(--text-sm, 0.875rem);
  font-family: inherit;
  color: var(--text-primary, #0f172a);
  background: var(--bg-primary);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  cursor: pointer;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.print-only {
  display: none;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  color: var(--text-secondary, #64748b);
}

.fiscal-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  margin: 0;
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.empty-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-6, 1.5rem) var(--space-4, 1rem);
  color: var(--text-secondary, #64748b);
  text-align: center;
}

.empty-placeholder i {
  font-size: 2.5rem;
  color: var(--text-tertiary, #94a3b8);
}

.empty-placeholder p {
  margin: 0;
}

.table-scroll {
  overflow-x: auto;
}

.fiscal-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm, 0.875rem);
}

.fiscal-table th,
.fiscal-table td {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  text-align: left;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  color: var(--text-primary, #0f172a);
  vertical-align: top;
}

.fiscal-table thead th {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-secondary, #64748b);
  white-space: nowrap;
}

.fiscal-table tfoot th,
.fiscal-table tfoot td {
  font-weight: var(--font-weight-semibold, 600);
  border-bottom: none;
}

.fiscal-table .num {
  text-align: right;
  white-space: nowrap;
}

.property-name {
  margin-right: var(--space-2, 0.5rem);
}

.is-excluded td {
  color: var(--text-tertiary, #94a3b8);
}

.include-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  cursor: pointer;
  white-space: nowrap;
}

.table-2044 .is-total td {
  font-weight: var(--font-weight-semibold, 600);
  background: var(--bg-secondary);
}

.line-number {
  font-weight: var(--font-weight-semibold, 600);
  white-space: nowrap;
}

.line-label {
  min-width: 16rem;
}

.line-flag,
.line-hint {
  display: block;
  font-size: var(--text-xs, 0.75rem);
  font-weight: normal;
  color: var(--text-secondary, #64748b);
}

.line-flag {
  font-style: italic;
  color: var(--warning-700, #b45309);
}

.line-total {
  font-weight: var(--font-weight-semibold, 600);
}

.is-negative,
.fiscal-table td.is-negative {
  color: var(--error-600, #dc2626);
}

.deficit-label {
  display: block;
  font-size: var(--text-xs, 0.75rem);
  font-weight: normal;
}

.fiscal-hint,
.disclaimer {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2, 0.5rem);
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.expense-detail h3 {
  margin: 0 0 var(--space-2, 0.5rem);
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.muted {
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

@media (prefers-color-scheme: dark) {
  .year-select {
    color-scheme: dark;
  }

  .is-negative,
  .fiscal-table td.is-negative {
    color: var(--error-500, #ef4444);
  }
}

@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
  }

  .header-actions {
    justify-content: flex-start;
  }
}

@media print {
  .no-print {
    display: none !important;
  }

  .print-only {
    display: block;
  }

  .fiscal-view {
    padding: 0;
    gap: var(--space-4, 1rem);
  }

  .print-header h1 {
    margin: 0 0 var(--space-1, 0.25rem);
    font-size: 1.5rem;
  }

  .print-header p {
    margin: 0;
    color: #475569;
  }

  .table-scroll {
    overflow: visible;
  }

  .fiscal-card {
    break-inside: avoid;
  }
}
</style>
