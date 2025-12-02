import { defineStore } from 'pinia';
import { db } from '@/db/database';
import type { Rent, Lease, Property } from '@/db/types';

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

    async fetchRentById(id: number) {
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
        const now = new Date();
        const newRent: Omit<Rent, 'id'> = {
          ...rent,
          createdAt: now,
          updatedAt: now,
        };

        const id = await db.rents.add(newRent as Rent);
        const createdRent: Rent = { ...newRent, id: id as number };
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
        const updatedRent = {
          ...updates,
          updatedAt: new Date(),
        };

        await db.rents.update(id, updatedRent);

        const index = this.rents.findIndex((r: Rent) => r.id === id);
        if (index !== -1) {
          this.rents[index] = { ...this.rents[index], ...updatedRent } as Rent;
        }

        if (this.currentRent?.id === id) {
          this.currentRent = { ...this.currentRent, ...updatedRent } as Rent;
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

    // Generate virtual pending rents from active leases when no rent exists for the month
    generateVirtualRents(leases: Lease[], referenceDate = new Date()) {
      const activeLeases = leases.filter(l => l.status === 'active');
      const today = new Date(referenceDate);
      today.setHours(0, 0, 0, 0);

      return activeLeases
        .map((lease: Lease) => {
          const paymentDay = (lease as any).paymentDay || 1;
          const candidate = new Date(today.getFullYear(), today.getMonth(), paymentDay);
          if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);

          const exists = this.rents.some(r => {
            if (r.leaseId !== lease.id) return false;
            const d = new Date(r.dueDate);
            return (
              d.getFullYear() === candidate.getFullYear() && d.getMonth() === candidate.getMonth()
            );
          });

          if (exists) return null;

          return {
            id: `virtual-${lease.id}-${candidate.getFullYear()}-${candidate.getMonth()}`,
            leaseId: lease.id,
            dueDate: candidate,
            amount: (lease as any).rent,
            charges: (lease as any).charges || 0,
            status: 'pending' as const,
            isVirtual: true,
          } as any;
        })
        .filter(Boolean) as any[];
    },

    // Build calendar event objects from real rents and virtual rents (leases required)
    buildCalendarEvents(leases: Lease[], properties: Property[]) {
      const real = this.rents.map((rent: Rent) => {
        const lease = leases.find(l => l.id === rent.leaseId);
        const property = lease ? properties.find(p => p.id === lease.propertyId) : null;
        const calendarStatus =
          rent.status === 'late' ? 'overdue' : rent.status === 'partial' ? 'pending' : rent.status;
        const id = `${rent.id ?? 'r'}-${rent.leaseId}-${new Date(rent.dueDate).setHours(0, 0, 0, 0)}`;
        return {
          id,
          rentId: rent.id,
          leaseId: rent.leaseId,
          date: new Date(rent.dueDate),
          title: property?.name || 'Bien inconnu',
          status: calendarStatus as 'pending' | 'paid' | 'overdue',
          amount: rent.amount,
          isVirtual: false,
        } as any;
      });

      const virtual = this.generateVirtualRents(leases);
      const virtualEvents = virtual.map((v: any) => {
        const lease = leases.find(l => l.id === v.leaseId);
        const property = lease ? properties.find(p => p.id === lease.propertyId) : null;
        const id = `${String(v.id)}-${v.leaseId}-${new Date(v.dueDate).setHours(0, 0, 0, 0)}`;
        return {
          id,
          rentId: undefined,
          leaseId: v.leaseId,
          date: new Date(v.dueDate),
          title: property?.name || 'Bien inconnu',
          status: 'pending' as const,
          amount: v.amount,
          isVirtual: true,
        } as any;
      });

      return [...real, ...virtualEvents];
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
