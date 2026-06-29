import { defineStore } from 'pinia';
import type { IrlIndex, RentRevision } from '@/db/types';
import {
  deleteIrlIndex as deleteIrlIndexRepo,
  fetchAllIrlIndices,
  upsertIrlIndex as upsertIrlIndexRepo,
} from '../repositories/irlIndicesRepository';
import {
  deleteRevision as deleteRevisionRepo,
  fetchRevisionsByLeaseId,
  updateRevision as updateRevisionRepo,
  upsertRevision as upsertRevisionRepo,
} from '../repositories/rentRevisionsRepository';
import { updateLease } from '@/features/leases/repositories/leasesRepository';
import type { RentRevisionProposal } from '../services/indexationService';

interface IndexationState {
  irlIndices: IrlIndex[];
  revisionsByLease: Record<number, RentRevision[]>;
  isLoading: boolean;
  error: string | null;
}

export const useIndexationStore = defineStore('indexation', {
  state: (): IndexationState => ({
    irlIndices: [],
    revisionsByLease: {},
    isLoading: false,
    error: null,
  }),

  getters: {
    revisionsForLease: state => (leaseId: number) => state.revisionsByLease[leaseId] ?? [],
  },

  actions: {
    async fetchIrlIndices() {
      this.isLoading = true;
      this.error = null;
      try {
        this.irlIndices = await fetchAllIrlIndices();
      } catch (error) {
        this.error = 'Échec du chargement des indices IRL';
        console.error('Failed to fetch IRL indices:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async upsertIrlIndex(index: Pick<IrlIndex, 'year' | 'quarter' | 'value'>) {
      try {
        await upsertIrlIndexRepo(index);
        await this.fetchIrlIndices();
      } catch (error) {
        this.error = "Échec de l'enregistrement de l'indice IRL";
        console.error('Failed to upsert IRL index:', error);
        throw error;
      }
    },

    async removeIrlIndex(id: number) {
      try {
        await deleteIrlIndexRepo(id);
        await this.fetchIrlIndices();
      } catch (error) {
        console.error('Failed to delete IRL index:', error);
        throw error;
      }
    },

    async fetchRevisions(leaseId: number) {
      try {
        const rows = await fetchRevisionsByLeaseId(leaseId);
        this.revisionsByLease = { ...this.revisionsByLease, [leaseId]: rows };
        return rows;
      } catch (error) {
        console.error('Failed to fetch rent revisions:', error);
        throw error;
      }
    },

    /**
     * Valide une proposition de révision : enregistre la révision en statut
     * `applied` et met à jour le loyer du bail.
     */
    async applyRevision(proposal: RentRevisionProposal) {
      try {
        const revision = await upsertRevisionRepo({
          leaseId: proposal.leaseId,
          year: proposal.year,
          anniversaryDate: proposal.anniversaryDate,
          effectiveDate: proposal.effectiveDate,
          referenceQuarter: proposal.referenceQuarter,
          oldRent: proposal.oldRent,
          newRent: proposal.newRent,
          currentIrl: proposal.currentIrl,
          previousIrl: proposal.previousIrl,
          charges: proposal.charges,
          status: 'applied',
        });
        await updateLease(proposal.leaseId, { rent: proposal.newRent });
        await this.fetchRevisions(proposal.leaseId);
        return revision;
      } catch (error) {
        this.error = "Échec de l'application de la révision";
        console.error('Failed to apply rent revision:', error);
        throw error;
      }
    },

    /**
     * Enregistre une proposition de révision refusée (sans toucher au loyer).
     */
    async rejectRevision(proposal: RentRevisionProposal) {
      try {
        const revision = await upsertRevisionRepo({
          leaseId: proposal.leaseId,
          year: proposal.year,
          anniversaryDate: proposal.anniversaryDate,
          effectiveDate: proposal.effectiveDate,
          referenceQuarter: proposal.referenceQuarter,
          oldRent: proposal.oldRent,
          newRent: proposal.newRent,
          currentIrl: proposal.currentIrl,
          previousIrl: proposal.previousIrl,
          charges: proposal.charges,
          status: 'rejected',
        });
        await this.fetchRevisions(proposal.leaseId);
        return revision;
      } catch (error) {
        console.error('Failed to reject rent revision:', error);
        throw error;
      }
    },

    async attachDocumentToRevision(revisionId: number, documentId: number, leaseId: number) {
      try {
        await updateRevisionRepo(revisionId, { documentId });
        await this.fetchRevisions(leaseId);
      } catch (error) {
        console.error('Failed to attach document to revision:', error);
        throw error;
      }
    },

    async removeRevision(id: number, leaseId: number) {
      try {
        await deleteRevisionRepo(id);
        await this.fetchRevisions(leaseId);
      } catch (error) {
        console.error('Failed to delete rent revision:', error);
        throw error;
      }
    },
  },
});
