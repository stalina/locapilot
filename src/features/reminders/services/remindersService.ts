import type { Reminder, ReminderLevel, Rent } from '@/db/types';
import type { ReminderThresholdConfig } from '@/features/settings/stores/settingsStore';

export interface PendingReminder {
  rent: Rent;
  level: ReminderLevel;
  thresholdDays: number;
  daysLate: number;
}

function daysLateFor(rent: Rent, now: Date): number {
  const due = new Date(rent.dueDate);
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Détermine, pour chaque loyer encore dû et en retard, le prochain niveau de
 * relance à envoyer : le seuil (activé) le plus élevé atteint par le retard et
 * pour lequel aucune relance n'a encore été envoyée. Un loyer très en retard
 * peut ainsi sauter directement au niveau le plus formel si aucune relance
 * n'a été envoyée avant — l'échéancier fixe le niveau approprié à l'instant T,
 * il n'impose pas d'envoyer les 3 courriers dans l'ordre.
 */
export function computePendingReminders(
  rents: Rent[],
  reminders: Reminder[],
  thresholds: ReminderThresholdConfig[],
  now: Date = new Date()
): PendingReminder[] {
  // Track the highest threshold (in days) already sent per rent, not just the
  // set of sent levels: once the most formal letter has gone out, a lower one
  // must never be proposed again, even if it was skipped on the way there.
  const maxSentDaysByRent = new Map<number, number>();
  for (const reminder of reminders) {
    const current = maxSentDaysByRent.get(reminder.rentId) ?? -Infinity;
    if (reminder.thresholdDays > current) {
      maxSentDaysByRent.set(reminder.rentId, reminder.thresholdDays);
    }
  }

  const enabledThresholds = thresholds.filter(t => t.enabled).sort((a, b) => b.days - a.days);

  const pending: PendingReminder[] = [];
  for (const rent of rents) {
    if (!rent.id || rent.status === 'paid') continue;

    const daysLate = daysLateFor(rent, now);
    if (daysLate <= 0) continue;

    const maxSentDays = maxSentDaysByRent.get(rent.id) ?? -Infinity;
    const nextThreshold = enabledThresholds.find(t => daysLate >= t.days && t.days > maxSentDays);

    if (nextThreshold) {
      pending.push({
        rent,
        level: nextThreshold.level,
        thresholdDays: nextThreshold.days,
        daysLate,
      });
    }
  }

  return pending;
}
