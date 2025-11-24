import { defineStore } from 'pinia';
import { db } from '@/db/database';
import type { Lease } from '@/db/schema';

interface LeasesState {
  leases: Lease[];
  currentLease: Lease | null;
  isLoading: boolean;
  error: string | null;
}

export const useLeasesStore = defineStore('leases', {
  state: (): LeasesState => ({
    leases: [],
    currentLease: null,
    isLoading: false,
    error: null,
  }),

  getters: {
    // Baux actifs
    activeLeases: (state) => state.leases.filter(l => l.status === 'active'),

    // Baux terminés
    endedLeases: (state) => state.leases.filter(l => l.status === 'ended'),

    // Baux en attente
    pendingLeases: (state) => state.leases.filter(l => l.status === 'pending'),

    // Baux par propriété
    leasesByProperty: (state) => (propertyId: number) =>
      state.leases.filter(l => l.propertyId === propertyId),

    // Baux par locataire
    leasesByTenant: (state) => (tenantId: number) =>
      state.leases.filter(l => l.tenantIds.includes(tenantId)),

    // Baux expirant bientôt (dans les 30 jours)
    expiringLeases: (state) => {
      const today = new Date();
      const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      return state.leases.filter(l => {
        if (l.status !== 'active' || !l.endDate) return false;
        const endDate = new Date(l.endDate);
        return endDate >= today && endDate <= next30Days;
      });
    },

    // Durée moyenne des baux (en mois)
    averageLeaseDuration: (state) => {
      const activeLeases = state.leases.filter(l => l.status === 'active' && l.endDate);
      if (activeLeases.length === 0) return 0;

      const totalMonths = activeLeases.reduce((sum, l) => {
        const start = new Date(l.startDate);
        const end = l.endDate ? new Date(l.endDate) : new Date();
        const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        return sum + months;
      }, 0);

      return Math.round(totalMonths / activeLeases.length);
    },
  },

  actions: {
    async fetchLeases() {
      this.isLoading = true;
      this.error = null;
      try {
        this.leases = await db.leases.toArray();
      } catch (error) {
        this.error = 'Échec du chargement des baux';
        console.error('Failed to fetch leases:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async fetchLeaseById(id: number) {
      this.isLoading = true;
      this.error = null;
      try {
        const lease = await db.leases.get(id);
        if (lease) {
          this.currentLease = lease;
        } else {
          this.error = 'Bail non trouvé';
        }
      } catch (error) {
        this.error = 'Échec du chargement du bail';
        console.error('Failed to fetch lease:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async createLease(lease: Omit<Lease, 'id' | 'createdAt' | 'updatedAt'>) {
      this.isLoading = true;
      this.error = null;
      try {
        const now = new Date();
        const newLease: Omit<Lease, 'id'> = {
          ...lease,
          createdAt: now,
          updatedAt: now,
        };

        const id = await db.leases.add(newLease);
        const createdLease = { ...newLease, id } as Lease;
        this.leases.push(createdLease);
        return createdLease;
      } catch (error) {
        this.error = 'Échec de la création du bail';
        console.error('Failed to create lease:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async updateLease(id: number, updates: Partial<Omit<Lease, 'id' | 'createdAt'>>) {
      this.isLoading = true;
      this.error = null;
      try {
        const updatedFields = {
          ...updates,
          updatedAt: new Date(),
        };

        await db.leases.update(id, updatedFields);

        // Refetch to get updated lease
        const updatedLease = await db.leases.get(id);
        if (updatedLease) {
          const index = this.leases.findIndex(l => l.id === id);
          if (index !== -1) {
            this.leases[index] = updatedLease;
          }

          if (this.currentLease?.id === id) {
            this.currentLease = updatedLease;
          }
        }
      } catch (error) {
        this.error = 'Échec de la mise à jour du bail';
        console.error('Failed to update lease:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async deleteLease(id: number) {
      this.isLoading = true;
      this.error = null;
      try {
        await db.leases.delete(id);
        this.leases = this.leases.filter(l => l.id !== id);
        if (this.currentLease?.id === id) {
          this.currentLease = null;
        }
      } catch (error) {
        this.error = 'Échec de la suppression du bail';
        console.error('Failed to delete lease:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    async terminateLease(id: number) {
      await this.updateLease(id, {
        status: 'ended',
        endDate: new Date(),
      });
    },

    clearError() {
      this.error = null;
    },
  },
});
