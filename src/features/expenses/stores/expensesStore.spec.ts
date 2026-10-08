import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { Expense, Lease, Rent } from '@/db/types';

vi.mock('../repositories/expensesRepository', () => ({
  createExpense: vi.fn(),
  deleteWithDocuments: vi.fn(),
  fetchPropertyIncomeSources: vi.fn(),
  findByProperty: vi.fn(),
  updateExpense: vi.fn(),
}));

vi.mock('../services/expensesService', () => ({
  validateExpense: vi.fn(),
}));

import {
  createExpense,
  deleteWithDocuments,
  fetchPropertyIncomeSources,
  findByProperty,
  updateExpense,
} from '../repositories/expensesRepository';
import { validateExpense, type ExpenseDraft } from '../services/expensesService';
import { useExpensesStore } from './expensesStore';

const NOW = new Date('2026-03-10T10:00:00.000Z');

function expense(id: number, date: string, overrides: Partial<Expense> = {}): Expense {
  return {
    id,
    propertyId: 1,
    category: 'works',
    label: `Dépense ${id}`,
    amount: 100,
    date: new Date(date),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const draft: ExpenseDraft = {
  propertyId: 1,
  category: 'works',
  label: 'Travaux',
  amount: 100,
  date: new Date('2026-05-01'),
};

describe('expensesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(validateExpense).mockImplementation(async d => ({
      propertyId: d.propertyId,
      category: 'works',
      label: String(d.label),
      amount: Number(d.amount),
      date: new Date(String(d.date)),
    }));
  });

  describe('fetchExpensesByProperty', () => {
    it('loads the expenses, leases and rents of the property', async () => {
      const expenses = [expense(1, '2026-04-01')];
      const leases = [{ id: 7, propertyId: 1 } as Lease];
      const rents = [{ id: 9, leaseId: 7 } as Rent];
      vi.mocked(findByProperty).mockResolvedValue(expenses);
      vi.mocked(fetchPropertyIncomeSources).mockResolvedValue({ leases, rents });

      const store = useExpensesStore();
      await store.fetchExpensesByProperty(1);

      expect(findByProperty).toHaveBeenCalledWith(1);
      expect(store.propertyId).toBe(1);
      expect(store.expenses).toEqual(expenses);
      expect(store.leases).toEqual(leases);
      expect(store.rents).toEqual(rents);
      expect(store.isLoading).toBe(false);
      expect(store.error).toBeNull();
    });

    it('sets an error when loading fails', async () => {
      vi.mocked(findByProperty).mockRejectedValue(new Error('boom'));
      vi.mocked(fetchPropertyIncomeSources).mockResolvedValue({ leases: [], rents: [] });

      const store = useExpensesStore();
      await store.fetchExpensesByProperty(1);

      expect(store.error).toBe('Échec du chargement des dépenses');
      expect(store.isLoading).toBe(false);
    });
  });

  describe('createExpense', () => {
    it('validates, creates and inserts the expense sorted by date', async () => {
      const store = useExpensesStore();
      store.propertyId = 1;
      store.expenses = [expense(1, '2026-06-01'), expense(2, '2026-01-01')];
      const created = expense(3, '2026-03-01');
      vi.mocked(createExpense).mockResolvedValue(created);

      const result = await store.createExpense(draft);

      expect(validateExpense).toHaveBeenCalledWith(draft);
      expect(createExpense).toHaveBeenCalled();
      expect(result).toEqual(created);
      expect(store.expenses.map(e => e.id)).toEqual([1, 3, 2]);
    });

    it('does not add an expense of another property to the loaded list', async () => {
      const store = useExpensesStore();
      store.propertyId = 2;
      vi.mocked(createExpense).mockResolvedValue(expense(3, '2026-03-01'));

      await store.createExpense(draft);

      expect(store.expenses).toEqual([]);
    });

    it('does not create anything when validation fails', async () => {
      vi.mocked(validateExpense).mockRejectedValue(new Error('Le montant doit être supérieur à 0'));
      const store = useExpensesStore();

      await expect(store.createExpense({ ...draft, amount: 0 })).rejects.toThrow(
        'Le montant doit être supérieur à 0'
      );
      expect(createExpense).not.toHaveBeenCalled();
    });

    it('sets an error when the repository fails', async () => {
      vi.mocked(createExpense).mockRejectedValue(new Error('db'));
      const store = useExpensesStore();

      await expect(store.createExpense(draft)).rejects.toThrow('db');
      expect(store.error).toBe("Échec de l'enregistrement de la dépense");
    });
  });

  describe('updateExpense', () => {
    it('updates the expense (clearing removed notes) and re-sorts the list', async () => {
      const store = useExpensesStore();
      store.propertyId = 1;
      store.expenses = [expense(1, '2026-06-01'), expense(2, '2026-01-01')];
      const updated = expense(2, '2026-12-01', { amount: 135 });
      vi.mocked(updateExpense).mockResolvedValue(updated);

      await store.updateExpense(2, draft);

      expect(updateExpense).toHaveBeenCalledWith(2, expect.objectContaining({ notes: undefined }));
      expect(store.expenses.map(e => e.id)).toEqual([2, 1]);
      expect(store.expenses[0]?.amount).toBe(135);
    });

    it('keeps the stored expense unchanged when validation fails', async () => {
      vi.mocked(validateExpense).mockRejectedValue(new Error('Le libellé est requis'));
      const store = useExpensesStore();
      store.expenses = [expense(1, '2026-06-01')];

      await expect(store.updateExpense(1, { ...draft, label: '' })).rejects.toThrow(
        'Le libellé est requis'
      );
      expect(updateExpense).not.toHaveBeenCalled();
      expect(store.expenses[0]?.label).toBe('Dépense 1');
    });

    it('sets an error when the repository fails', async () => {
      vi.mocked(updateExpense).mockRejectedValue(new Error('db'));
      const store = useExpensesStore();

      await expect(store.updateExpense(1, draft)).rejects.toThrow('db');
      expect(store.error).toBe('Échec de la mise à jour de la dépense');
    });
  });

  describe('deleteExpense', () => {
    it('deletes the expense with its documents and removes it from the list', async () => {
      vi.mocked(deleteWithDocuments).mockResolvedValue();
      const store = useExpensesStore();
      store.expenses = [expense(1, '2026-06-01'), expense(2, '2026-01-01')];

      await store.deleteExpense(1);

      expect(deleteWithDocuments).toHaveBeenCalledWith(1);
      expect(store.expenses.map(e => e.id)).toEqual([2]);
    });

    it('keeps the list and sets an error when deletion fails', async () => {
      vi.mocked(deleteWithDocuments).mockRejectedValue(new Error('db'));
      const store = useExpensesStore();
      store.expenses = [expense(1, '2026-06-01')];

      await expect(store.deleteExpense(1)).rejects.toThrow('db');
      expect(store.expenses).toHaveLength(1);
      expect(store.error).toBe('Échec de la suppression de la dépense');
    });
  });
});
