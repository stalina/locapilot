import { describe, it, expect, beforeEach, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { db } from '@/db/database';
import { requireId } from '@/test/requireId';
import type { Expense } from '@/db/types';
import ExpenseFormModal from './ExpenseFormModal.vue';

const ModalStub = {
  props: ['modelValue', 'title'],
  template: '<div v-if="modelValue"><h3>{{ title }}</h3><slot /><slot name="footer" /></div>',
};

const NOW = new Date('2026-03-10T10:00:00.000Z');

async function createProperty(): Promise<number> {
  return requireId(
    await db.properties.add({
      name: 'Appart Gambetta T2',
      address: '10 rue Gambetta',
      type: 'apartment',
      surface: 45,
      rooms: 2,
      rent: 800,
      status: 'vacant',
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

function mountModal(propertyId: number, expense: Expense | null = null) {
  return mount(ExpenseFormModal, {
    props: { modelValue: true, propertyId, expense },
    global: { stubs: { Modal: ModalStub } },
  });
}

async function fill(
  wrapper: VueWrapper,
  values: { category?: string; label?: string; amount?: string; date?: string; notes?: string }
) {
  if (values.category !== undefined)
    await wrapper.find('[data-testid="expense-category"]').setValue(values.category);
  if (values.label !== undefined)
    await wrapper.find('[data-testid="expense-label"]').setValue(values.label);
  if (values.amount !== undefined)
    await wrapper.find('[data-testid="expense-amount"]').setValue(values.amount);
  if (values.date !== undefined)
    await wrapper.find('[data-testid="expense-date"]').setValue(values.date);
  if (values.notes !== undefined)
    await wrapper.find('[data-testid="expense-notes"]').setValue(values.notes);
}

async function selectFile(wrapper: VueWrapper, file: File) {
  const input = wrapper.find('[data-testid="expense-file"]');
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
}

async function submit(wrapper: VueWrapper) {
  const button = wrapper.find('[data-testid="expense-form-submit"]');
  await button.trigger('click');
  await flushPromises();
  // IndexedDB (fake-indexeddb) work spans several macrotasks: wait for the
  // submit to settle (the button label is reset in a `finally`).
  await vi.waitFor(() => expect(button.text()).toBe('Enregistrer'));
  await flushPromises();
}

describe('ExpenseFormModal', () => {
  let propertyId: number;

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await db.open();
    await Promise.all([db.properties.clear(), db.expenses.clear(), db.documents.clear()]);
    propertyId = await createProperty();
  });

  it('offers the six categories with their FR labels and defaults the date to today', () => {
    const wrapper = mountModal(propertyId);
    const options = wrapper.findAll('[data-testid="expense-category"] option').map(o => o.text());
    expect(options).toEqual([
      'Sélectionner…',
      'Travaux',
      'Taxe foncière',
      'Assurance (PNO)',
      'Entretien',
      'Charges de copropriété',
      'Autre',
    ]);
    const date = wrapper.find('[data-testid="expense-date"]').element;
    expect(date instanceof HTMLInputElement && date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(wrapper.text()).toContain('Ajouter une dépense');
  });

  it('creates the expense, emits saved and closes', async () => {
    const wrapper = mountModal(propertyId);
    await fill(wrapper, {
      category: 'property-tax',
      label: 'Taxe foncière 2026',
      amount: '1250',
      date: '2026-10-15',
    });

    await submit(wrapper);

    const stored = await db.expenses.toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      propertyId,
      category: 'property-tax',
      label: 'Taxe foncière 2026',
      amount: 1250,
      date: new Date(2026, 9, 15, 12),
    });
    expect(wrapper.emitted('saved')?.[0]?.[0]).toMatchObject({ id: stored[0]?.id });
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
  });

  it('stores a decimal amount', async () => {
    const wrapper = mountModal(propertyId);
    await fill(wrapper, {
      category: 'maintenance',
      label: 'Entretien',
      amount: '89.90',
      date: '2026-02-01',
    });

    await submit(wrapper);

    expect((await db.expenses.toArray())[0]?.amount).toBe(89.9);
  });

  it('shows field errors and creates nothing when the form is invalid', async () => {
    const wrapper = mountModal(propertyId);
    await fill(wrapper, { label: '   ', amount: '0', date: '' });

    await submit(wrapper);

    const errors = wrapper.findAll('.field-error').map(e => e.text());
    expect(errors).toEqual([
      'La catégorie est requise',
      'Le libellé est requis',
      'Le montant doit être supérieur à 0',
      'La date est requise',
    ]);
    expect(await db.expenses.count()).toBe(0);
    expect(wrapper.emitted('saved')).toBeUndefined();

    await fill(wrapper, { amount: '-50' });
    await submit(wrapper);
    expect(wrapper.text()).toContain('Le montant doit être supérieur à 0');
    expect(await db.expenses.count()).toBe(0);
  });

  it('shows "Bien introuvable" when the property does not exist', async () => {
    const wrapper = mountModal(999);
    await fill(wrapper, { category: 'works', label: 'Travaux', amount: '100', date: '2026-01-01' });

    await submit(wrapper);

    expect(wrapper.find('[data-testid="expense-form-error"]').text()).toBe('Bien introuvable');
    expect(await db.expenses.count()).toBe(0);
  });

  it.each([
    ['works', 'invoice'],
    ['insurance', 'insurance'],
    ['other', 'other'],
  ])('attaches a %s supporting document with type %s', async (category, documentType) => {
    const wrapper = mountModal(propertyId);
    await fill(wrapper, {
      category,
      label: 'Avec justificatif',
      amount: '100',
      date: '2026-01-01',
    });
    await selectFile(wrapper, new File(['%PDF'], 'facture.pdf', { type: 'application/pdf' }));

    await submit(wrapper);

    const [created] = await db.expenses.toArray();
    const docs = await db.documents.toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      name: 'facture.pdf',
      type: documentType,
      relatedEntityType: 'expense',
      relatedEntityId: created?.id,
    });
  });

  it('rejects an empty file: no expense and no document are created', async () => {
    const wrapper = mountModal(propertyId);
    await fill(wrapper, { category: 'works', label: 'Travaux', amount: '100', date: '2026-01-01' });
    await selectFile(wrapper, new File([], 'vide.pdf', { type: 'application/pdf' }));
    expect(wrapper.text()).toContain('Le fichier sélectionné est vide');

    await submit(wrapper);

    expect(await db.expenses.count()).toBe(0);
    expect(await db.documents.count()).toBe(0);

    // Selecting a non-empty file clears the error.
    await selectFile(wrapper, new File(['x'], 'ok.pdf', { type: 'application/pdf' }));
    expect(wrapper.text()).not.toContain('Le fichier sélectionné est vide');
  });

  it('edits an existing expense and can add a document to it', async () => {
    const id = requireId(
      await db.expenses.add({
        propertyId,
        category: 'maintenance',
        label: 'Entretien chaudière',
        amount: 120,
        date: new Date(2026, 1, 1, 12),
        notes: 'Contrat annuel',
        createdAt: NOW,
        updatedAt: NOW,
      })
    );
    const expense = await db.expenses.get(id);
    const wrapper = mountModal(propertyId, expense ?? null);

    expect(wrapper.text()).toContain('Modifier la dépense');
    const amount = wrapper.find('[data-testid="expense-amount"]').element;
    const date = wrapper.find('[data-testid="expense-date"]').element;
    expect(amount instanceof HTMLInputElement && amount.value).toBe('120');
    expect(date instanceof HTMLInputElement && date.value).toBe('2026-02-01');

    await fill(wrapper, { amount: '135', notes: '' });
    await selectFile(wrapper, new File(['x'], 'facture.pdf', { type: 'application/pdf' }));
    await submit(wrapper);

    const updated = await db.expenses.get(id);
    expect(updated?.amount).toBe(135);
    expect(updated).not.toHaveProperty('notes');
    expect(updated?.updatedAt.getTime()).toBeGreaterThan(NOW.getTime());
    expect(await db.documents.where('relatedEntityId').equals(id).count()).toBe(1);
  });
});
