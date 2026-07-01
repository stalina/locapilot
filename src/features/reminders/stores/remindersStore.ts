import { defineStore } from 'pinia';
import { db } from '@/db/database';
import type { Reminder, ReminderLevel } from '@/db/types';
import {
  createReminder as createReminderRepo,
  fetchAllReminders,
} from '../repositories/remindersRepository';

interface RemindersState {
  reminders: Reminder[];
  isLoading: boolean;
  error: string | null;
}

export const useRemindersStore = defineStore('reminders', {
  state: (): RemindersState => ({
    reminders: [],
    isLoading: false,
    error: null,
  }),

  actions: {
    async fetchReminders() {
      this.isLoading = true;
      this.error = null;
      try {
        this.reminders = await fetchAllReminders();
      } catch (error) {
        this.error = 'Échec du chargement des relances';
        console.error('Failed to fetch reminders:', error);
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Historise l'envoi d'une relance déjà générée : crée l'entrée
     * Communications (module F5) puis marque le niveau comme envoyé pour ce
     * loyer. Le courrier DOCX lui-même (fetch du template + rendu) est généré
     * en amont par l'appelant, comme pour les autres lettres du projet
     * (cf. RentRevisionCard.vue), pour garder cette action testable sans réseau.
     */
    async recordReminderSent(params: {
      rentId: number;
      level: ReminderLevel;
      thresholdDays: number;
      documentId: number;
      levelLabel: string;
      amountDue: string;
      daysLate: number;
    }) {
      try {
        const now = new Date();
        const communicationId = (await db.communications.add({
          relatedEntityType: 'rent',
          relatedEntityId: params.rentId,
          type: 'letter',
          direction: 'outbound',
          subject: params.levelLabel,
          content: `${params.levelLabel} envoyée pour un impayé de ${params.amountDue} € (${params.daysLate} jours de retard).`,
          date: now,
          attachments: [params.documentId],
          createdAt: now,
        } as any)) as number;

        const reminder = await createReminderRepo({
          rentId: params.rentId,
          level: params.level,
          thresholdDays: params.thresholdDays,
          sentDate: now,
          documentId: params.documentId,
          communicationId,
        });

        this.reminders = [...this.reminders, reminder];
        return reminder;
      } catch (error) {
        this.error = "Échec de l'enregistrement de la relance";
        console.error('Failed to record reminder:', error);
        throw error;
      }
    },
  },
});
