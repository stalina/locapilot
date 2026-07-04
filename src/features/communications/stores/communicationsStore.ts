import { defineStore } from 'pinia';
import type { Communication } from '@/db/types';
import {
  createCommunication as createCommunicationRepo,
  deleteCommunication as deleteCommunicationRepo,
  fetchAllCommunications,
  fetchCommunicationsByEntity,
  fetchCommunicationsForLease as fetchCommunicationsForLeaseRepo,
  fetchReminderLinkedCommunicationIds,
  updateCommunication as updateCommunicationRepo,
} from '../repositories/communicationsRepository';
import {
  filterCommunications,
  isReadOnlyCommunication,
  validateCommunicationDraft,
  type CommunicationDraft,
  type CommunicationDirection,
  type CommunicationEntityType,
  type CommunicationType,
} from '../services/communicationsService';

interface CommunicationsState {
  communications: Communication[];
  reminderLinkedIds: number[];
  isLoading: boolean;
  error: string | null;
  filters: {
    relatedEntityType: CommunicationEntityType | 'all';
    type: CommunicationType | 'all';
    direction: CommunicationDirection | 'all';
    search: string;
  };
}

export const useCommunicationsStore = defineStore('communications', {
  state: (): CommunicationsState => ({
    communications: [],
    reminderLinkedIds: [],
    isLoading: false,
    error: null,
    filters: {
      relatedEntityType: 'all',
      type: 'all',
      direction: 'all',
      search: '',
    },
  }),

  getters: {
    reminderLinkedIdSet(state): Set<number> {
      return new Set(state.reminderLinkedIds);
    },

    filteredCommunications(state): Communication[] {
      return filterCommunications(state.communications, state.filters);
    },

    isReadOnly() {
      return (communication: Pick<Communication, 'id'>): boolean =>
        isReadOnlyCommunication(communication, this.reminderLinkedIdSet);
    },
  },

  actions: {
    async fetchCommunications() {
      this.isLoading = true;
      this.error = null;
      try {
        const [communications, linkedIds] = await Promise.all([
          fetchAllCommunications(),
          fetchReminderLinkedCommunicationIds(),
        ]);
        this.communications = communications;
        this.reminderLinkedIds = [...linkedIds];
      } catch (error) {
        this.error = 'Échec du chargement des communications';
        console.error('Failed to fetch communications:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async fetchCommunicationsForEntity(
      relatedEntityType: CommunicationEntityType,
      relatedEntityId: number
    ): Promise<Communication[]> {
      const [rows, linkedIds] = await Promise.all([
        fetchCommunicationsByEntity(relatedEntityType, relatedEntityId),
        fetchReminderLinkedCommunicationIds(),
      ]);
      this.reminderLinkedIds = [...linkedIds];
      return rows;
    },

    /**
     * Fetch the communications relevant to a lease, aggregating both
     * lease-scoped entries and rent-scoped entries (which include historized
     * reminder letters). Most-recent-first.
     */
    async fetchCommunicationsForLease(leaseId: number): Promise<Communication[]> {
      const [rows, linkedIds] = await Promise.all([
        fetchCommunicationsForLeaseRepo(leaseId),
        fetchReminderLinkedCommunicationIds(),
      ]);
      this.reminderLinkedIds = [...linkedIds];
      return rows;
    },

    resetFilters() {
      this.filters = {
        relatedEntityType: 'all',
        type: 'all',
        direction: 'all',
        search: '',
      };
    },

    /**
     * Create a manual communication after validating the draft.
     * Throws an Error whose message aggregates validation failures.
     */
    async createCommunication(draft: CommunicationDraft): Promise<Communication> {
      const errors = validateCommunicationDraft(draft);
      if (errors.length > 0) {
        throw new Error(errors.join(' '));
      }
      try {
        const created = await createCommunicationRepo({
          relatedEntityType: draft.relatedEntityType,
          relatedEntityId: draft.relatedEntityId,
          type: draft.type,
          direction: draft.direction,
          subject: draft.subject,
          content: draft.content,
          date: draft.date,
          attachments: draft.attachments,
        });
        this.communications = [created, ...this.communications].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        return created;
      } catch (error) {
        this.error = "Échec de l'enregistrement de la communication";
        console.error('Failed to create communication:', error);
        throw error;
      }
    },

    async updateCommunication(id: number, draft: CommunicationDraft): Promise<Communication> {
      if (this.isReadOnly({ id })) {
        throw new Error('Cette communication est en lecture seule.');
      }
      const errors = validateCommunicationDraft(draft);
      if (errors.length > 0) {
        throw new Error(errors.join(' '));
      }
      try {
        const updated = await updateCommunicationRepo(id, {
          relatedEntityType: draft.relatedEntityType,
          relatedEntityId: draft.relatedEntityId,
          type: draft.type,
          direction: draft.direction,
          subject: draft.subject,
          content: draft.content,
          date: draft.date,
          attachments: draft.attachments,
        });
        this.communications = this.communications
          .map(c => (c.id === id ? updated : c))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return updated;
      } catch (error) {
        this.error = 'Échec de la mise à jour de la communication';
        console.error('Failed to update communication:', error);
        throw error;
      }
    },

    async deleteCommunication(id: number): Promise<void> {
      if (this.isReadOnly({ id })) {
        throw new Error('Cette communication est en lecture seule.');
      }
      try {
        await deleteCommunicationRepo(id);
        this.communications = this.communications.filter(c => c.id !== id);
      } catch (error) {
        this.error = 'Échec de la suppression de la communication';
        console.error('Failed to delete communication:', error);
        throw error;
      }
    },
  },
});
