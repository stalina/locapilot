import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { db } from '@/db/database';
import { requireId } from '@/test/requireId';
import type { ExpenseCategory, Property } from '@/db/types';

const exportCSVContent = vi.fn<(content: string, filename: string) => Promise<void>>();

vi.mock('@/shared/composables/useExport', async () => {
  const { ref } = await import('vue');
  return {
    useExport: () => ({ exportCSVContent, isExporting: ref(false) }),
  };
});

import FiscalView from './FiscalView.vue';

const CURRENT_YEAR = new Date().getFullYear();
const FISCAL_YEAR = CURRENT_YEAR - 1;
const NOW = new Date(CURRENT_YEAR, 0, 1);

function property(name: string): Property {
  return {
    name,
    address: '10 rue Gambetta',
    type: 'apartment',
    surface: 45,
    rooms: 2,
    rent: 800,
    status: 'occupied',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

/** A property with 12 rents paid during `year` and the given expenses of that year. */
async function addProperty(
  name: string,
  monthlyRent: number,
  expenses: [ExpenseCategory, number][] = [],
  year = FISCAL_YEAR
): Promise<number> {
  const propertyId = requireId(await db.properties.add(property(name)));
  const leaseId = requireId(
    await db.leases.add({
      propertyId,
      tenantIds: [1],
      startDate: new Date(year - 1, 0, 1),
      rent: monthlyRent,
      charges: 50,
      deposit: monthlyRent,
      paymentDay: 5,
      status: 'active',
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
  await db.rents.bulkAdd(
    Array.from({ length: 12 }, (_, month) => ({
      leaseId,
      dueDate: new Date(year, month, 5, 12),
      paidDate: new Date(year, month, 5, 12),
      amount: monthlyRent,
      charges: 50,
      paidAmount: monthlyRent + 50,
      status: 'paid' as const,
      createdAt: NOW,
      updatedAt: NOW,
    }))
  );
  for (const [category, amount] of expenses) {
    await db.expenses.add({
      propertyId,
      category,
      label: category,
      amount,
      date: new Date(year, 5, 1, 12),
      createdAt: NOW,
      updatedAt: NOW,
    });
  }
  return propertyId;
}

async function mountView(): Promise<VueWrapper> {
  const wrapper = mount(FiscalView);
  await vi.waitFor(() => expect(wrapper.find('.loading-state').exists()).toBe(false));
  await flushPromises();
  return wrapper;
}

function text(wrapper: VueWrapper, testId: string): string {
  return wrapper.find(`[data-testid="${testId}"]`).text().replace(/\s+/g, ' ');
}

function lineTotal(wrapper: VueWrapper, line: number): string {
  return wrapper
    .find(`[data-testid="fiscal-line-${line}"] [data-testid="fiscal-line-total"]`)
    .text()
    .replace(/\s+/g, ' ');
}

function isDisabled(wrapper: VueWrapper, testId: string): boolean {
  return wrapper.find(`[data-testid="${testId}"]`).attributes('disabled') !== undefined;
}

async function snapshotDb() {
  return {
    properties: await db.properties.toArray(),
    leases: await db.leases.toArray(),
    rents: await db.rents.toArray(),
    expenses: await db.expenses.toArray(),
  };
}

describe('FiscalView', () => {
  beforeEach(async () => {
    exportCSVContent.mockReset();
    exportCSVContent.mockResolvedValue(undefined);
    await db.open();
    await Promise.all([
      db.properties.clear(),
      db.leases.clear(),
      db.rents.clear(),
      db.expenses.clear(),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens on the previous year with the banner and the disclaimer', async () => {
    const wrapper = await mountView();
    const select = wrapper.find<HTMLSelectElement>('[data-testid="fiscal-year-select"]');
    expect(Number(select.element.value)).toBe(FISCAL_YEAR);
    expect(select.findAll('option').map(o => Number(o.text()))).toEqual([
      CURRENT_YEAR,
      FISCAL_YEAR,
    ]);
    expect(text(wrapper, 'fiscal-lmnp-banner')).toContain(
      'La déclaration 2044 concerne les locations nues.'
    );
    expect(text(wrapper, 'fiscal-disclaimer')).toContain(
      "Document d'aide à la déclaration — vérifiez les montants avant de les reporter."
    );
  });

  it('shows an empty state and disables the exports for a year without activity', async () => {
    const wrapper = await mountView();
    expect(text(wrapper, 'fiscal-empty')).toBe(
      `Aucun revenu ni dépense enregistré pour ${FISCAL_YEAR}`
    );
    expect(isDisabled(wrapper, 'fiscal-export-csv')).toBe(true);
    expect(isDisabled(wrapper, 'fiscal-print')).toBe(true);
  });

  it('displays the income recap and the 2044 table of the selected year', async () => {
    await addProperty('Appart Gambetta T2', 800, [
      ['management-fees', 480],
      ['loan-interest', 2100],
      ['other', 75],
    ]);
    await addProperty('Maison Lilas', 500, [['works', 8000]]);
    const wrapper = await mountView();

    const rows = wrapper.findAll('[data-testid="fiscal-income-row"]');
    expect(rows.map(r => r.text().replace(/\s+/g, ' '))).toEqual([
      expect.stringContaining('Appart Gambetta T2'),
      expect.stringContaining('Maison Lilas'),
    ]);
    expect(text(wrapper, 'fiscal-rent-income-total')).toBe('15 600,00 €');
    expect(lineTotal(wrapper, 211)).toBe('15 600 €');
    expect(lineTotal(wrapper, 240)).toBe('8 520 €'); // 480 + 2 × 20 + 8 000
    expect(lineTotal(wrapper, 250)).toBe('2 100 €');
    expect(lineTotal(wrapper, 261)).toBe('4 980 €');
    expect(wrapper.findAll('[data-testid="fiscal-manual-flag"]')).toHaveLength(6);
    expect(wrapper.findAll('[data-testid="fiscal-line-hint"]')).toHaveLength(2);
    expect(wrapper.find('[data-testid="fiscal-micro-foncier-hint"]').exists()).toBe(false);
    expect(text(wrapper, 'fiscal-unallocated-total')).toBe('75,00 €');
    expect(text(wrapper, 'fiscal-unallocated')).toContain(
      'Reclassez ces dépenses dans une catégorie déductible si elles le sont'
    );
    expect(wrapper.findAll('[data-testid="fiscal-expense-detail"]')).toHaveLength(2);
    expect(isDisabled(wrapper, 'fiscal-export-csv')).toBe(false);
  });

  it('shows a negative line 261 as a "Déficit foncier"', async () => {
    await addProperty('Maison Lilas', 500, [['works', 8000]]);
    const wrapper = await mountView();
    const total = wrapper.find('[data-testid="fiscal-line-261"] [data-testid="fiscal-line-total"]');
    expect(total.classes()).toContain('is-negative');
    expect(total.text()).toContain('Déficit foncier');
  });

  it('excludes an unchecked property and re-evaluates the micro-foncier hint', async () => {
    await addProperty('Appart Gambetta T2', 800);
    await addProperty('Maison Lilas', 500);
    const wrapper = await mountView();
    expect(wrapper.find('[data-testid="fiscal-micro-foncier-hint"]').exists()).toBe(false);

    const boxes = wrapper.findAll<HTMLInputElement>('[data-testid="fiscal-include-checkbox"]');
    await boxes[1]?.setValue(false);

    const headers = wrapper.findAll('[data-testid="fiscal-2044-table"] thead th');
    expect(headers.map(h => h.text())).not.toContain('Maison Lilas');
    expect(lineTotal(wrapper, 211)).toBe('9 600 €');
    expect(text(wrapper, 'fiscal-micro-foncier-hint')).toContain(
      'Vos revenus bruts sont inférieurs ou égaux à 15 000 €'
    );
    const lilasRow = wrapper.findAll('[data-testid="fiscal-income-row"]')[1];
    expect(lilasRow?.find('[data-testid="fiscal-excluded-badge"]').text()).toBe('Exclu');
  });

  it('shows "Aucun bien inclus" and disables the exports when every property is unchecked', async () => {
    await addProperty('Appart Gambetta T2', 800);
    const wrapper = await mountView();
    await wrapper.find('[data-testid="fiscal-include-checkbox"]').setValue(false);

    expect(text(wrapper, 'fiscal-none-included')).toBe('Aucun bien inclus dans la déclaration');
    expect(wrapper.find('[data-testid="fiscal-2044-table"]').exists()).toBe(false);
    expect(isDisabled(wrapper, 'fiscal-export-csv')).toBe(true);
    expect(isDisabled(wrapper, 'fiscal-print')).toBe(true);

    await wrapper.find('[data-testid="fiscal-include-checkbox"]').setValue(true);
    expect(wrapper.find('[data-testid="fiscal-2044-table"]').exists()).toBe(true);
  });

  it('resets the inclusion choice when the year changes', async () => {
    await addProperty('Appart Gambetta T2', 800);
    await addProperty('Old flat', 600, [], FISCAL_YEAR - 1);
    const wrapper = await mountView();
    await wrapper.find('[data-testid="fiscal-include-checkbox"]').setValue(false);

    const select = wrapper.find('[data-testid="fiscal-year-select"]');
    await select.setValue(String(FISCAL_YEAR - 1));
    expect(text(wrapper, 'fiscal-income-table')).toContain('Old flat');
    await select.setValue(String(FISCAL_YEAR));

    const box = wrapper.find<HTMLInputElement>('[data-testid="fiscal-include-checkbox"]');
    expect(box.element.checked).toBe(true);
  });

  it('exports the CSV of the included properties', async () => {
    await addProperty('Appart Gambetta T2', 800);
    await addProperty('Maison Lilas', 500);
    const wrapper = await mountView();
    await wrapper.findAll('[data-testid="fiscal-include-checkbox"]')[1]?.setValue(false);

    await wrapper.find('[data-testid="fiscal-export-csv"]').trigger('click');
    await flushPromises();

    expect(exportCSVContent).toHaveBeenCalledTimes(1);
    const [content, filename] = exportCSVContent.mock.calls[0] ?? [];
    expect(filename).toBe(`recapitulatif-fiscal-${FISCAL_YEAR}.csv`);
    expect(content?.split('\r\n')[0]).toBe('Ligne;Libellé;Appart Gambetta T2;Total;Remarque');
    expect(content).not.toContain('Maison Lilas');
  });

  it('swallows an export failure already notified by useExport', async () => {
    await addProperty('Appart Gambetta T2', 800);
    exportCSVContent.mockRejectedValueOnce(new Error('boom'));
    const wrapper = await mountView();
    await wrapper.find('[data-testid="fiscal-export-csv"]').trigger('click');
    await flushPromises();
    expect(exportCSVContent).toHaveBeenCalledTimes(1);
  });

  it('opens the browser print dialog', async () => {
    await addProperty('Appart Gambetta T2', 800);
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const wrapper = await mountView();
    expect(wrapper.find('.print-header').text()).toContain(`Récapitulatif fiscal ${FISCAL_YEAR}`);

    await wrapper.find('[data-testid="fiscal-print"]').trigger('click');
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('never modifies the data', async () => {
    await addProperty('Appart Gambetta T2', 800, [['insurance', 180]]);
    await addProperty('Maison Lilas', 500);
    const before = await snapshotDb();
    vi.spyOn(window, 'print').mockImplementation(() => undefined);

    const wrapper = await mountView();
    await wrapper.findAll('[data-testid="fiscal-include-checkbox"]')[1]?.setValue(false);
    await wrapper.find('[data-testid="fiscal-year-select"]').setValue(String(CURRENT_YEAR));
    await wrapper.find('[data-testid="fiscal-year-select"]').setValue(String(FISCAL_YEAR));
    await wrapper.find('[data-testid="fiscal-export-csv"]').trigger('click');
    await wrapper.find('[data-testid="fiscal-print"]').trigger('click');
    await flushPromises();

    expect(await snapshotDb()).toEqual(before);
  });

  it('notifies when the data cannot be loaded', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(db.properties, 'toArray').mockRejectedValueOnce(new Error('db down'));
    const wrapper = await mountView();
    expect(errorSpy).toHaveBeenCalled();
    expect(text(wrapper, 'fiscal-empty')).toContain('Aucun revenu ni dépense');
  });
});
