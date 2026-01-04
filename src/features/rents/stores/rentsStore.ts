import { defineStore } from 'pinia';
import type { Rent, Lease, Property } from '@/db/types';
import {
  createRent as createRentRepo,
  deleteRent as deleteRentRepo,
  fetchAllRents,
  fetchRentById as fetchRentByIdRepo,
  updateRent as updateRentRepo,
} from '../repositories/rentsRepository';
import {
  buildCalendarEvents,
  buildPaidRentUpdates,
  computeOverdueRentIds,
  generateVirtualRents as generateVirtualRentsService,
} from '../services/rentsService';

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
    paidRents: state => state.rents.filter(r => r.status === 'paid'),

    // Loyers en attente
    pendingRents: state => state.rents.filter(r => r.status === 'pending'),

    // Loyers en retard
    overdueRents: state => state.rents.filter((r: Rent) => r.status === 'late'),

    // Total des loyers payés
    totalPaidAmount: state =>
      state.rents
        .filter((r: Rent) => r.status === 'paid')
        .reduce((sum: number, r: Rent) => sum + r.amount, 0),

    // Total des loyers en attente
    totalPendingAmount: state =>
      state.rents
        .filter((r: Rent) => r.status === 'pending')
        .reduce((sum: number, r: Rent) => sum + r.amount, 0),

    // Total des loyers en retard
    totalOverdueAmount: state =>
      state.rents
        .filter((r: Rent) => r.status === 'late')
        .reduce((sum: number, r: Rent) => sum + r.amount, 0),

    // Loyers par mois/année
    rentsByMonth: state => (month: number, year: number) =>
      state.rents.filter((r: Rent) => {
        const date = new Date(r.dueDate);
        return date.getMonth() === month && date.getFullYear() === year;
      }),

    // Loyers groupés par bail
    rentsByLease: state => (leaseId: number) =>
      state.rents.filter((r: Rent) => r.leaseId === leaseId),

    // Upcoming rents helper (next N days)
    upcomingRents:
      state =>
      (days = 30, limit = 5) => {
        const today = new Date();
        const end = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
        return state.rents
          .filter((rent: Rent) => {
            const due = new Date(rent.dueDate);
            return due >= today && due <= end && rent.status !== 'paid';
          })
          .sort((a: Rent, b: Rent) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .slice(0, limit);
      },

    // Taux de paiement (% loyers payés)
    paymentRate: state => {
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
        this.rents = await fetchAllRents();

        // Mettre à jour le statut des loyers en retard
        await this.updateOverdueRents();
      } catch (error) {
        this.error = 'Échec du chargement des loyers';
        console.error('Failed to fetch rents:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async fetchRentById(id: number) {
      this.isLoading = true;
      this.error = null;
      try {
        const rent = await fetchRentByIdRepo(id);
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
        const createdRent = await createRentRepo(rent);
        this.rents.push(createdRent);
        return createdRent;
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
        const updatedRent = await updateRentRepo(id, updates);

        if (updatedRent) {
          const index = this.rents.findIndex((r: Rent) => r.id === id);
          if (index !== -1) {
            this.rents[index] = updatedRent;
          }

          if (this.currentRent?.id === id) {
            this.currentRent = updatedRent;
          }
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
        await deleteRentRepo(id);
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
      await this.updateRent(id, buildPaidRentUpdates(paidDate));
    },

    // Generate virtual pending rents from active leases when no rent exists for the month
    generateVirtualRents(leases: Lease[], referenceDate = new Date()) {
      return generateVirtualRentsService({
        leases,
        existingRents: this.rents,
        referenceDate,
      }) as any;
    },

    // Build calendar event objects from real rents and virtual rents (leases required)
    buildCalendarEvents(leases: Lease[], properties: Property[]) {
      return buildCalendarEvents({
        rents: this.rents,
        leases,
        properties,
      });
    },

    // Create a rent from a virtual rent payload
    async createRentFromVirtual(payload: {
      leaseId: number;
      dueDate: Date;
      amount: number;
      charges?: number;
    }) {
      try {
        const created = await this.createRent({
          leaseId: payload.leaseId,
          dueDate: payload.dueDate,
          amount: payload.amount,
          charges: payload.charges || 0,
          status: 'pending',
        });
        return created;
      } catch (err) {
        console.error('createRentFromVirtual failed', err);
        throw err;
      }
    },

    async updateOverdueRents() {
      const overdueIds = computeOverdueRentIds(this.rents);
      await Promise.all(overdueIds.map(id => this.updateRent(id, { status: 'late' })));
    },

    clearError() {
      this.error = null;
    },
  },
});
