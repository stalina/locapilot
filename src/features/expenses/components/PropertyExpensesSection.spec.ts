import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { db } from '@/db/database';
import { requireId } from '@/test/requireId';
import type { Document, ExpenseCategory, Property } from '@/db/types';
import { useConfirm } from '@/shared/composables/useConfirm';
import PropertyExpensesSection from './PropertyExpensesSection.vue';

const CURRENT_YEAR = new Date().getFullYear();
const PREVIOUS_YEAR = CURRENT_YEAR - 1;
const NOW = new Date(CURRENT_YEAR, 0, 1);

const ModalStub = {
  props: ['modelValue'],
  template: '<div v-if="modelValue" class="modal-stub"><slot /><slot name="footer" /></div>',
};

function property(overrides: Partial<Property> = {}): Property {
  return {
    name: 'Appart Gambetta T2',
    address: '10 rue Gambetta',
    type: 'apartment',
    surface: 45,
    rooms: 2,
    rent: 800,
    status: 'occupied',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

async function addExpense(
  propertyId: number,
  category: ExpenseCategory,
  amount: number,
  date: Date,
  label: string = category
) {
  return requireId(
    await db.expenses.add({
      propertyId,
      category,
      label,
      amount,
      date,
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

async function addExpenseDocument(expenseId: number, name: string) {
  const doc: Omit<Document, 'id'> = {
    name,
    type: 'invoice',
    relatedEntityType: 'expense',
    relatedEntityId: expenseId,
    mimeType: 'application/pdf',
    size: 3,
    data: new Blob(['pdf'], { type: 'application/pdf' }),
    createdAt: NOW,
    updatedAt: NOW,
  };
  return requireId(await db.documents.add(doc));
}

/** 12 rents of 800 € (+50 € charges) paid in full during the current year. */
async function addPaidRents(propertyId: number) {
  const leaseId = requireId(
    await db.leases.add({
      propertyId,
      tenantIds: [1],
      startDate: new Date(PREVIOUS_YEAR, 0, 1),
      rent: 800,
      charges: 50,
      deposit: 800,
      paymentDay: 5,
      status: 'active',
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
  await db.rents.bulkAdd(
    Array.from({ length: 12 }, (_, month) => ({
      leaseId,
      dueDate: new Date(CURRENT_YEAR, month, 5, 12),
      paidDate: new Date(CURRENT_YEAR, month, 5, 12),
      amount: 800,
      charges: 50,
      paidAmount: 850,
      status: 'paid' as const,
      createdAt: NOW,
      updatedAt: NOW,
    }))
  );
}

async function mountSection(p: Property): Promise<VueWrapper> {
  const wrapper = mount(PropertyExpensesSection, {
    props: { property: p },
    global: { stubs: { Modal: ModalStub, DocumentPreviewModal: true } },
  });
  await settle(wrapper);
  return wrapper;
}

async function settle(wrapper: VueWrapper) {
  await flushPromises();
  await vi.waitFor(() => expect(wrapper.find('[data-testid="kpi-income"]').exists()).toBe(true));
  // Let IndexedDB reads (several macrotasks) complete.
  await new Promise(resolve => setTimeout(resolve, 20));
  await flushPromises();
}

function kpi(wrapper: VueWrapper, id: string): string {
  return wrapper.find(`[data-testid="${id}"]`).text().replace(/\s/g, ' ');
}

describe('PropertyExpensesSection', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.open();
    await Promise.all([
      db.properties.clear(),
      db.leases.clear(),
      db.rents.clear(),
      db.expenses.clear(),
      db.documents.clear(),
    ]);
  });

  afterEach(() => {
    useConfirm().handleCancel();
  });

  it('shows an empty state and zero totals for a property without expense', async () => {
    const id = requireId(await db.properties.add(property({ purchasePrice: 100000 })));
    const wrapper = await mountSection({ ...property({ purchasePrice: 100000 }), id });

    expect(wrapper.find('[data-testid="expenses-empty"]').text()).toBe(
      'Aucune dépense enregistrée pour cette année'
    );
    expect(wrapper.find('[data-testid="add-expense-button"]').exists()).toBe(true);
    expect(kpi(wrapper, 'kpi-expenses')).toBe('0,00 €');
    expect(kpi(wrapper, 'kpi-gross-yield')).toBe('0,00 %');
    expect(kpi(wrapper, 'kpi-net-yield')).toBe('0,00 %');
    expect(wrapper.find('[data-testid="expense-category-totals"]').exists()).toBe(false);
  });

  it('computes the income, expenses, net result and yields of the current year', async () => {
    const p = property({ purchasePrice: 180000, acquisitionCosts: 15000 });
    const id = requireId(await db.properties.add(p));
    await addPaidRents(id);
    await addExpense(id, 'works', 2000, new Date(CURRENT_YEAR, 3, 2, 12));
    await addExpense(id, 'property-tax', 400, new Date(CURRENT_YEAR, 9, 15, 12));
    // Ignored: previous year, other property.
    await addExpense(id, 'works', 500, new Date(PREVIOUS_YEAR, 11, 28, 12));
    await addExpense(id + 1000, 'works', 999, new Date(CURRENT_YEAR, 1, 1, 12));

    const wrapper = await mountSection({ ...p, id });

    expect(kpi(wrapper, 'kpi-income')).toBe('9 600,00 €');
    expect(kpi(wrapper, 'kpi-expenses')).toBe('2 400,00 €');
    expect(kpi(wrapper, 'kpi-net-result')).toBe('7 200,00 €');
    expect(kpi(wrapper, 'kpi-gross-yield')).toBe('4,92 %');
    expect(kpi(wrapper, 'kpi-net-yield')).toBe('3,69 %');
    expect(wrapper.find('[data-testid="yield-hint"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="expense-category-totals"]').text()).toContain('Travaux');
    expect(wrapper.find('[data-testid="expense-category-totals"]').text()).toContain(
      'Taxe foncière'
    );

    // Most recent first, previous year not listed.
    const rows = wrapper.findAll('[data-testid="expense-row"]').map(r => r.text());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('Taxe foncière');
    expect(rows[1]).toContain('Travaux');
  });

  it('switches to another year', async () => {
    const p = property({ purchasePrice: 150000 });
    const id = requireId(await db.properties.add(p));
    await addExpense(id, 'works', 12000, new Date(PREVIOUS_YEAR, 5, 1, 12), 'Gros travaux');
    await addExpense(id, 'maintenance', 150, new Date(CURRENT_YEAR, 1, 1, 12));

    const wrapper = await mountSection({ ...p, id });
    const select = wrapper.find('[data-testid="expenses-year-select"]');
    expect(select.findAll('option').map(o => o.text())).toEqual([
      String(CURRENT_YEAR),
      String(PREVIOUS_YEAR),
    ]);
    expect(kpi(wrapper, 'kpi-expenses')).toBe('150,00 €');

    await select.setValue(String(PREVIOUS_YEAR));

    expect(wrapper.findAll('[data-testid="expense-row"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="expense-row"]').text()).toContain('Gros travaux');
    expect(kpi(wrapper, 'kpi-net-result')).toBe('-12 000,00 €');
    expect(kpi(wrapper, 'kpi-net-yield')).toBe('-8,00 %');
    expect(wrapper.find('[data-testid="kpi-net-result"]').classes()).toContain('is-negative');
    expect(wrapper.find('[data-testid="kpi-net-yield"]').classes()).toContain('is-negative');
  });

  it('shows "—" and a hint when the purchase price is missing', async () => {
    const p = property();
    const id = requireId(await db.properties.add(p));
    await addExpense(id, 'works', 100, new Date(CURRENT_YEAR, 1, 1, 12));

    const wrapper = await mountSection({ ...p, id });

    expect(kpi(wrapper, 'kpi-gross-yield')).toBe('—');
    expect(kpi(wrapper, 'kpi-net-yield')).toBe('—');
    expect(wrapper.find('[data-testid="yield-hint"]').text()).toContain(
      "Renseignez le prix d'acquisition pour calculer la rentabilité"
    );
    expect(kpi(wrapper, 'kpi-expenses')).toBe('100,00 €');
    expect(wrapper.find('[data-testid="kpi-net-yield"]').classes()).not.toContain('is-negative');
  });

  it('lists the supporting documents and shows a document indicator', async () => {
    const p = property();
    const id = requireId(await db.properties.add(p));
    const expenseId = await addExpense(id, 'works', 100, new Date(CURRENT_YEAR, 1, 1, 12));
    await addExpenseDocument(expenseId, 'devis.pdf');
    await addExpenseDocument(expenseId, 'facture.pdf');

    const wrapper = await mountSection({ ...p, id });

    expect(wrapper.find('[data-testid="expense-doc-indicator"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="expense-document-preview"]').map(b => b.text())).toEqual([
      'devis.pdf',
      'facture.pdf',
    ]);
  });

  it('opens the form to add an expense', async () => {
    const p = property();
    const id = requireId(await db.properties.add(p));
    const wrapper = await mountSection({ ...p, id });

    expect(wrapper.find('.modal-stub').exists()).toBe(false);
    await wrapper.find('[data-testid="add-expense-button"]').trigger('click');
    expect(wrapper.find('.modal-stub [data-testid="expense-category"]').exists()).toBe(true);
  });

  it('deletes an expense and its documents after confirmation, and keeps it on cancel', async () => {
    const p = property();
    const id = requireId(await db.properties.add(p));
    const expenseId = await addExpense(id, 'works', 100, new Date(CURRENT_YEAR, 1, 1, 12));
    await addExpenseDocument(expenseId, 'facture.pdf');
    const wrapper = await mountSection({ ...p, id });
    const { currentDialog, handleCancel, handleConfirm } = useConfirm();

    await wrapper.find('[data-testid="delete-expense-button"]').trigger('click');
    expect(currentDialog.value?.message).toContain('1 justificatif');
    handleCancel();
    await settle(wrapper);
    expect(await db.expenses.count()).toBe(1);

    await wrapper.find('[data-testid="delete-expense-button"]').trigger('click');
    handleConfirm();
    await vi.waitFor(async () => expect(await db.expenses.count()).toBe(0));
    await settle(wrapper);

    expect(await db.documents.count()).toBe(0);
    expect(wrapper.find('[data-testid="expenses-empty"]').exists()).toBe(true);
  });

  it('removes a supporting document but keeps the expense', async () => {
    const p = property();
    const id = requireId(await db.properties.add(p));
    const expenseId = await addExpense(id, 'works', 100, new Date(CURRENT_YEAR, 1, 1, 12));
    await addExpenseDocument(expenseId, 'facture.pdf');
    const wrapper = await mountSection({ ...p, id });

    await wrapper.find('[data-testid="expense-document-remove"]').trigger('click');
    useConfirm().handleConfirm();
    await vi.waitFor(async () => expect(await db.documents.count()).toBe(0));
    await settle(wrapper);

    expect(await db.expenses.count()).toBe(1);
    expect(wrapper.find('[data-testid="expense-document-preview"]').exists()).toBe(false);
  });
});
