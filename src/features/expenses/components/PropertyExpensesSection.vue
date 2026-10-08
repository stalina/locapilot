<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import Button from '@/shared/components/Button.vue';
import DocumentPreviewModal from '@/shared/components/DocumentPreviewModal.vue';
import { useConfirm } from '@/shared/composables/useConfirm';
import { useNotification } from '@/shared/composables/useNotification';
import { formatCurrency, formatDate, formatPercent } from '@/shared/utils/formatters';
import { useDocumentsStore } from '@/features/documents/stores/documentsStore';
import type { Document, Expense, Property } from '@/db/types';
import { useExpensesStore } from '../stores/expensesStore';
import {
  availableYears,
  computeExpenses,
  computeIncome,
  computeProfitability,
  getExpenseCategoryLabel,
  yearOf,
} from '../services/expensesService';
import ExpenseFormModal from './ExpenseFormModal.vue';

const props = defineProps<{ property: Property }>();

const expensesStore = useExpensesStore();
const documentsStore = useDocumentsStore();
const { confirm } = useConfirm();
const { success: notifySuccess, error: notifyError } = useNotification();

const currentYear = new Date().getFullYear();
const selectedYear = ref(currentYear);

const propertyId = computed(() => props.property.id ?? -1);

const showForm = ref(false);
const expenseToEdit = ref<Expense | null>(null);

const previewDocument = ref<Document | null>(null);
const isPreviewOpen = ref(false);

// The store may still hold another property's data while loading.
const isCurrentProperty = computed(() => expensesStore.propertyId === propertyId.value);
const propertyExpenses = computed(() => (isCurrentProperty.value ? expensesStore.expenses : []));

const years = computed(() =>
  availableYears({
    expenses: propertyExpenses.value,
    rents: isCurrentProperty.value ? expensesStore.rents : [],
    leases: isCurrentProperty.value ? expensesStore.leases : [],
    propertyId: propertyId.value,
    currentYear,
  })
);

const yearExpenses = computed(() =>
  propertyExpenses.value
    .filter(e => yearOf(e.date) === selectedYear.value)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
);

const expensesSummary = computed(() =>
  computeExpenses(propertyExpenses.value, propertyId.value, selectedYear.value)
);

const income = computed(() =>
  isCurrentProperty.value
    ? computeIncome(expensesStore.rents, expensesStore.leases, propertyId.value, selectedYear.value)
    : 0
);

const profitability = computed(() =>
  computeProfitability({
    income: income.value,
    expenses: expensesSummary.value.total,
    purchasePrice: props.property.purchasePrice,
    acquisitionCosts: props.property.acquisitionCosts,
  })
);

function documentsOf(expense: Expense): Document[] {
  if (!expense.id) return [];
  return documentsStore.documentsByEntity('expense', expense.id);
}

function formatYield(value: number | null): string {
  return value === null ? '—' : formatPercent(value, 2);
}

async function load() {
  if (!props.property.id) return;
  await Promise.all([
    expensesStore.fetchExpensesByProperty(props.property.id),
    documentsStore.fetchDocuments(),
  ]);
}

onMounted(load);
watch(
  () => props.property.id,
  (id, oldId) => {
    if (id !== oldId) {
      selectedYear.value = currentYear;
      void load();
    }
  }
);

function openCreate() {
  expenseToEdit.value = null;
  showForm.value = true;
}

function openEdit(expense: Expense) {
  expenseToEdit.value = expense;
  showForm.value = true;
}

function handleSaved(expense: Expense) {
  // Show the year the expense was recorded in.
  const year = yearOf(expense.date);
  if (year !== null) selectedYear.value = year;
}

async function handleDelete(expense: Expense) {
  if (!expense.id) return;
  const docCount = documentsOf(expense).length;
  const confirmed = await confirm({
    title: 'Supprimer la dépense',
    message:
      docCount > 0
        ? `Supprimer « ${expense.label} » et ses ${docCount} justificatif(s) ?`
        : `Supprimer « ${expense.label} » ?`,
    confirmText: 'Supprimer',
    type: 'danger',
  });
  if (!confirmed) return;
  try {
    await expensesStore.deleteExpense(expense.id);
    // Supporting documents were deleted in the same transaction.
    documentsStore.documents = documentsStore.documents.filter(
      d => !(d.relatedEntityType === 'expense' && d.relatedEntityId === expense.id)
    );
    notifySuccess('Dépense supprimée');
  } catch {
    notifyError('Échec de la suppression de la dépense');
  }
}

async function handleRemoveDocument(doc: Document) {
  if (!doc.id) return;
  const confirmed = await confirm({
    title: 'Supprimer le justificatif',
    message: `Supprimer le document « ${doc.name} » ? La dépense est conservée.`,
    confirmText: 'Supprimer',
    type: 'danger',
  });
  if (!confirmed) return;
  try {
    await documentsStore.deleteDocument(doc.id);
  } catch {
    notifyError('Échec de la suppression du justificatif');
  }
}

function handlePreview(doc: Document) {
  previewDocument.value = doc;
  isPreviewOpen.value = true;
}

async function handleDownload(doc: Document) {
  if (doc.id) await documentsStore.downloadDocument(doc.id);
}

async function handlePreviewDownload() {
  if (previewDocument.value) await handleDownload(previewDocument.value);
}
</script>

<template>
  <section class="expenses-section" data-testid="property-expenses-section">
    <div class="card-header expenses-header">
      <h2>
        <i class="mdi mdi-cash-minus"></i>
        Dépenses &amp; rentabilité
      </h2>
      <div class="expenses-header-actions">
        <label class="sr-only" for="expenses-year">Année</label>
        <select
          id="expenses-year"
          v-model.number="selectedYear"
          class="year-select"
          data-testid="expenses-year-select"
        >
          <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
        </select>
        <Button
          variant="primary"
          size="sm"
          icon="plus"
          data-testid="add-expense-button"
          @click="openCreate"
        >
          Ajouter une dépense
        </Button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi">
        <span class="kpi-label">Revenus encaissés (hors charges)</span>
        <span class="kpi-value" data-testid="kpi-income">{{
          formatCurrency(profitability.income)
        }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Total des dépenses</span>
        <span class="kpi-value" data-testid="kpi-expenses">{{
          formatCurrency(profitability.expenses)
        }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Résultat net</span>
        <span
          class="kpi-value"
          :class="{ 'is-negative': profitability.netResult < 0 }"
          data-testid="kpi-net-result"
          >{{ formatCurrency(profitability.netResult) }}</span
        >
      </div>
      <div class="kpi">
        <span class="kpi-label">Rendement brut</span>
        <span class="kpi-value" data-testid="kpi-gross-yield">{{
          formatYield(profitability.grossYield)
        }}</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Rendement net</span>
        <span
          class="kpi-value"
          :class="{ 'is-negative': (profitability.netYield ?? 0) < 0 }"
          data-testid="kpi-net-yield"
          >{{ formatYield(profitability.netYield) }}</span
        >
      </div>
    </div>
    <p v-if="profitability.grossYield === null" class="yield-hint" data-testid="yield-hint">
      <i class="mdi mdi-information-outline"></i>
      Renseignez le prix d'acquisition pour calculer la rentabilité
    </p>

    <!-- Per-category totals -->
    <ul
      v-if="expensesSummary.byCategory.length"
      class="category-totals"
      data-testid="expense-category-totals"
    >
      <li v-for="row in expensesSummary.byCategory" :key="row.category" class="category-total">
        <span>{{ row.label }}</span>
        <strong>{{ formatCurrency(row.total) }}</strong>
      </li>
    </ul>

    <!-- Expenses list -->
    <div v-if="!yearExpenses.length" class="expenses-empty" data-testid="expenses-empty">
      <i class="mdi mdi-receipt-text-outline"></i>
      <p>Aucune dépense enregistrée pour cette année</p>
    </div>
    <ul v-else class="expenses-list">
      <li
        v-for="expense in yearExpenses"
        :key="expense.id"
        class="expense-row"
        data-testid="expense-row"
      >
        <div class="expense-main">
          <span class="expense-date">{{ formatDate(expense.date) }}</span>
          <span class="expense-category">{{ getExpenseCategoryLabel(expense.category) }}</span>
          <span class="expense-label">
            {{ expense.label }}
            <i
              v-if="documentsOf(expense).length"
              class="mdi mdi-paperclip doc-indicator"
              :title="`${documentsOf(expense).length} justificatif(s)`"
              data-testid="expense-doc-indicator"
            ></i>
          </span>
          <span class="expense-amount" data-testid="expense-amount-value">{{
            formatCurrency(expense.amount)
          }}</span>
          <span class="expense-actions">
            <Button
              variant="ghost"
              size="sm"
              icon="pencil"
              title="Modifier"
              aria-label="Modifier la dépense"
              data-testid="edit-expense-button"
              @click="openEdit(expense)"
            />
            <Button
              variant="ghost"
              size="sm"
              icon="delete"
              title="Supprimer"
              aria-label="Supprimer la dépense"
              data-testid="delete-expense-button"
              @click="handleDelete(expense)"
            />
          </span>
        </div>
        <p v-if="expense.notes" class="expense-notes">{{ expense.notes }}</p>
        <ul v-if="documentsOf(expense).length" class="expense-docs">
          <li v-for="doc in documentsOf(expense)" :key="doc.id" class="expense-doc">
            <button
              type="button"
              class="doc-link"
              data-testid="expense-document-preview"
              @click="handlePreview(doc)"
            >
              <i class="mdi mdi-file-document-outline"></i>
              {{ doc.name }}
            </button>
            <Button
              variant="ghost"
              size="sm"
              icon="download"
              title="Télécharger"
              aria-label="Télécharger le justificatif"
              @click="handleDownload(doc)"
            />
            <Button
              variant="ghost"
              size="sm"
              icon="close"
              title="Retirer le justificatif"
              aria-label="Retirer le justificatif"
              data-testid="expense-document-remove"
              @click="handleRemoveDocument(doc)"
            />
          </li>
        </ul>
      </li>
    </ul>

    <ExpenseFormModal
      v-if="property.id"
      v-model="showForm"
      :property-id="property.id"
      :expense="expenseToEdit"
      @saved="handleSaved"
    />

    <DocumentPreviewModal
      v-model="isPreviewOpen"
      :document="previewDocument"
      @download="handlePreviewDownload"
    />
  </section>
</template>

<style scoped>
.expenses-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.expenses-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3, 0.75rem);
}

.expenses-header h2 {
  margin: 0;
}

.expenses-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
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

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3, 0.75rem);
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  padding: var(--space-3, 0.75rem);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
}

.kpi-label {
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-secondary, #64748b);
}

.kpi-value {
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.kpi-value.is-negative {
  color: var(--error-600, #dc2626);
}

.yield-hint {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.category-totals {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2, 0.5rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.category-total {
  display: flex;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-1, 0.25rem) var(--space-3, 0.75rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
  background: var(--bg-tertiary);
  border-radius: var(--radius-full, 9999px);
}

.category-total strong {
  color: var(--text-primary, #0f172a);
}

.expenses-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-6, 1.5rem) var(--space-4, 1rem);
  color: var(--text-secondary, #64748b);
  text-align: center;
}

.expenses-empty i {
  font-size: 2.5rem;
  color: var(--text-tertiary, #94a3b8);
}

.expenses-empty p {
  margin: 0;
}

.expenses-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.expense-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-3, 0.75rem);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
}

.expense-main {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  align-items: center;
  gap: var(--space-3, 0.75rem);
}

.expense-date {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
  white-space: nowrap;
}

.expense-category {
  padding: 0 var(--space-2, 0.5rem);
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary, #64748b);
  background: var(--bg-tertiary);
  border-radius: var(--radius-full, 9999px);
  white-space: nowrap;
}

.expense-label {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-primary, #0f172a);
}

.doc-indicator {
  margin-left: var(--space-1, 0.25rem);
  color: var(--text-secondary, #64748b);
}

.expense-amount {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  white-space: nowrap;
}

.expense-actions {
  display: flex;
  gap: var(--space-1, 0.25rem);
}

.expense-notes {
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.expense-docs {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.expense-doc {
  display: flex;
  align-items: center;
  gap: var(--space-1, 0.25rem);
}

.doc-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 0.25rem);
  min-width: 0;
  padding: 0;
  font: inherit;
  font-size: var(--text-sm, 0.875rem);
  color: var(--primary-600, #4f46e5);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  overflow-wrap: anywhere;
}

.doc-link:hover {
  text-decoration: underline;
}

@media (prefers-color-scheme: dark) {
  .year-select {
    color-scheme: dark;
  }

  .kpi-value.is-negative {
    color: var(--error-500, #ef4444);
  }

  .doc-link {
    color: var(--primary-400, #8098fa);
  }
}

@media (max-width: 640px) {
  .expense-main {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      'date category actions'
      'label label amount';
    row-gap: var(--space-2, 0.5rem);
  }

  .expense-date {
    grid-area: date;
  }

  .expense-category {
    grid-area: category;
    justify-self: start;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .expense-label {
    grid-area: label;
  }

  .expense-amount {
    grid-area: amount;
  }

  .expense-actions {
    grid-area: actions;
  }
}
</style>
