import { defineStore } from 'pinia';
import type { Expense, Lease, Rent } from '@/db/types';
import {
  createExpense as createExpenseRepo,
  deleteWithDocuments,
  fetchPropertyIncomeSources,
  findByProperty,
  updateExpense as updateExpenseRepo,
} from '../repositories/expensesRepository';
import { validateExpense, type ExpenseDraft } from '../services/expensesService';

interface ExpensesState {
  /** Property whose expenses are loaded in `expenses`. */
  propertyId: number | null;
  expenses: Expense[];
  /** Leases and rents of the loaded property (income side of the profitability). */
  leases: Lease[];
  rents: Rent[];
  isLoading: boolean;
  error: string | null;
}

function byDateDesc(a: Expense, b: Expense): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

export const useExpensesStore = defineStore('expenses', {
  state: (): ExpensesState => ({
    propertyId: null,
    expenses: [],
    leases: [],
    rents: [],
    isLoading: false,
    error: null,
  }),

  actions: {
    /** Load the expenses (most recent first), leases and rents of one property. */
    async fetchExpensesByProperty(propertyId: number): Promise<void> {
      this.isLoading = true;
      this.error = null;
      try {
        const [expenses, sources] = await Promise.all([
          findByProperty(propertyId),
          fetchPropertyIncomeSources(propertyId),
        ]);
        this.expenses = expenses;
        this.leases = sources.leases;
        this.rents = sources.rents;
        this.propertyId = propertyId;
      } catch (error) {
        this.error = 'Échec du chargement des dépenses';
        console.error('Failed to fetch expenses:', error);
      } finally {
        this.isLoading = false;
      }
    },

    /** Validate then create an expense. Throws with a French message when invalid. */
    async createExpense(draft: ExpenseDraft): Promise<Expense> {
      const data = await validateExpense(draft);
      try {
        const created = await createExpenseRepo(data);
        if (this.propertyId === created.propertyId) {
          this.expenses = [created, ...this.expenses].sort(byDateDesc);
        }
        return created;
      } catch (error) {
        this.error = "Échec de l'enregistrement de la dépense";
        console.error('Failed to create expense:', error);
        throw error;
      }
    },

    /** Validate then update an expense. The stored expense is unchanged when invalid. */
    async updateExpense(id: number, draft: ExpenseDraft): Promise<Expense> {
      const data = await validateExpense(draft);
      try {
        // `notes` is cleared explicitly when emptied in the form.
        const updated = await updateExpenseRepo(id, { notes: undefined, ...data });
        this.expenses = this.expenses
          .map(e => (e.id === id ? updated : e))
          .filter(e => e.propertyId === this.propertyId)
          .sort(byDateDesc);
        return updated;
      } catch (error) {
        this.error = 'Échec de la mise à jour de la dépense';
        console.error('Failed to update expense:', error);
        throw error;
      }
    },

    /** Delete an expense and its supporting documents. */
    async deleteExpense(id: number): Promise<void> {
      try {
        await deleteWithDocuments(id);
        this.expenses = this.expenses.filter(e => e.id !== id);
      } catch (error) {
        this.error = 'Échec de la suppression de la dépense';
        console.error('Failed to delete expense:', error);
        throw error;
      }
    },
  },
});
