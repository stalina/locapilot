import { defineStore } from 'pinia';
import { db } from '@/db/database';
import type { Rent } from '@/db/types';

interface RentsState {
  rents: Rent[];
  currentRent: Rent | null;
  isLoading: boolean;
  error: string | null;
}

export const useRentsStore = defineStore('rents', {
  state: (): RentsState => ({
    rents: [],
    currentRent: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    // Loyers payés
    paidRents: (state) => state.rents.filter(r => r.status === 'paid'),

    // Loyers en attente
    pendingRents: (state) => state.rents.filter(r => r.status === 'pending'),

    // Loyers en retard
    overdueRents: (state) => state.rents.filter((r: Rent) => r.status === 'late'),

    // Total des loyers payés
    totalPaidAmount: (state) =>
      state.rents
        .filter((r: Rent) => r.status === 'paid')
        .reduce((sum: number, r: Rent) => sum + r.amount, 0),

    // Total des loyers en attente
    totalPendingAmount: (state) =>
      state.rents
        .filter((r: Rent) => r.status === 'pending')
        .reduce((sum: number, r: Rent) => sum + r.amount, 0),

    // Total des loyers en retard
    totalOverdueAmount: (state) =>
      state.rents
        .filter((r: Rent) => r.status === 'late')
        .reduce((sum: number, r: Rent) => sum + r.amount, 0),

    // Loyers par mois/année
    rentsByMonth: (state) => (month: number, year: number) =>
      state.rents.filter((r: Rent) => {
        const date = new Date(r.dueDate);
        return date.getMonth() === month && date.getFullYear() === year;
      }),

    // Loyers groupés par bail
    rentsByLease: (state) => (leaseId: number) =>
      state.rents.filter((r: Rent) => r.leaseId === leaseId),

    // Taux de paiement (% loyers payés)
    paymentRate: (state) => {
      const total = state.rents.length;
      if (total === 0) return 0;
      const paid = state.rents.filter((r: Rent) => r.status === 'paid').length;
      return Math.round((paid / total) * 100);
    },
  },

  actions: {
    async fetchRents() {
      this.isLoading = true;
      this.error = null;
      try {
        this.rents = await db.rents.toArray();
        
        // Mettre à jour le statut des loyers en retard
        await this.updateOverdueRents();
      } catch (error) {
        this.error = 'Échec du chargement des loyers';
        console.error('Failed to fetch rents:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async fetchRentById(id: string) {
      this.isLoading = true;
      this.error = null;
      try {
        const rent = await db.rents.get(id);
        if (rent) {
          this.currentRent = rent;
        } else {
          this.error = 'Loyer non trouvé';
        }
      } catch (error) {
        this.error = 'Échec du chargement du loyer';
        console.error('Failed to fetch rent:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async createRent(rent: Omit<Rent, 'id' | 'createdAt' | 'updatedAt'>) {
      this.isLoading = true;
      this.error = null;
      try {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const newRent: Rent = {
          ...rent,
          id,
          createdAt: now,
          updatedAt: now,
        };

        await db.rents.add(newRent);
        this.rents.push(newRent);
        return newRent;
      } catch (error) {
        this.error = 'Échec de la création du loyer';
        console.error('Failed to create rent:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async updateRent(id: number, updates: Partial<Omit<Rent, 'id' | 'createdAt'>>) {
      this.isLoading = true;
      this.error = null;
      try {
        const updatedRent = {
          ...updates,
          updatedAt: new Date(),
        };

        await db.rents.update(id, updatedRent);
        
        const index = this.rents.findIndex((r: Rent) => r.id === id);
        if (index !== -1) {
          this.rents[index] = { ...this.rents[index], ...updatedRent };
        }

        if (this.currentRent?.id === id) {
          this.currentRent = { ...this.currentRent, ...updatedRent };
        }
      } catch (error) {
        this.error = 'Échec de la mise à jour du loyer';
        console.error('Failed to update rent:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async deleteRent(id: number) {
      this.isLoading = true;
      this.error = null;
      try {
        await db.rents.delete(id);
        this.rents = this.rents.filter((r: Rent) => r.id !== id);
        if (this.currentRent?.id === id) {
          this.currentRent = null;
        }
      } catch (error) {
        this.error = 'Échec de la suppression du loyer';
        console.error('Failed to delete rent:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async payRent(id: number, paidDate?: Date) {
      await this.updateRent(id, {
        status: 'paid',
        paidDate: paidDate || new Date(),
      });
    },

    async updateOverdueRents() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const updates = this.rents
        .filter((r: Rent) => {
          if (r.status === 'paid') return false;
          const dueDate = new Date(r.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate < today;
        })
        .map((r: Rent) => r.id! && this.updateRent(r.id!, { status: 'late' }));

      await Promise.all(updates);
    },

    clearError() {
      this.error = null;
    },
  },
});
