import { describe, it, expect } from 'vitest';
import type { Reminder, Rent } from '@/db/types';
import type { ReminderThresholdConfig } from '@/features/settings/stores/settingsStore';
import { computePendingReminders } from './remindersService';

const THRESHOLDS: ReminderThresholdConfig[] = [
  { level: 'amiable', days: 30, enabled: true },
  { level: 'recommandee', days: 60, enabled: true },
  { level: 'mise-en-demeure', days: 90, enabled: true },
];

function makeRent(overrides: Partial<Rent> = {}): Rent {
  const now = new Date('2026-01-01');
  return {
    id: 1,
    leaseId: 1,
    dueDate: new Date('2026-01-01'),
    amount: 800,
    charges: 50,
    status: 'late',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeReminder(overrides: Partial<Reminder> = {}): Reminder {
  const now = new Date('2026-01-01');
  return {
    id: 1,
    rentId: 1,
    level: 'amiable',
    thresholdDays: 30,
    sentDate: now,
    documentId: 1,
    communicationId: 1,
    createdAt: now,
    ...overrides,
  };
}

describe('remindersService', () => {
  describe('computePendingReminders', () => {
    it('flags the first threshold crossed when no reminder has been sent', () => {
      const now = new Date('2026-02-04'); // 34 days after 2026-01-01
      const rent = makeRent();

      const result = computePendingReminders([rent], [], THRESHOLDS, now);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ level: 'amiable', thresholdDays: 30, daysLate: 34 });
    });

    it('does not flag a rent whose due date has not passed', () => {
      const now = new Date('2026-01-01');
      const rent = makeRent({ dueDate: new Date('2026-01-10') });

      expect(computePendingReminders([rent], [], THRESHOLDS, now)).toEqual([]);
    });

    it('does not re-flag a threshold that already has a reminder', () => {
      const now = new Date('2026-02-04'); // 34 days late, only 'amiable' threshold reached
      const rent = makeRent();
      const reminder = makeReminder({ level: 'amiable' });

      expect(computePendingReminders([rent], [reminder], THRESHOLDS, now)).toEqual([]);
    });

    it('escalates to the highest reached threshold, skipping intermediate ones', () => {
      const now = new Date('2026-04-05'); // 94 days late, no reminder sent yet
      const rent = makeRent();

      const result = computePendingReminders([rent], [], THRESHOLDS, now);

      expect(result).toHaveLength(1);
      expect(result[0]?.level).toBe('mise-en-demeure');
    });

    it('proposes nothing once the highest reached threshold has already been sent', () => {
      const now = new Date('2026-04-05'); // 94 days late
      const rent = makeRent();
      const reminder = makeReminder({ level: 'mise-en-demeure', thresholdDays: 90 });

      expect(computePendingReminders([rent], [reminder], THRESHOLDS, now)).toEqual([]);
    });

    it('jumps past an already-sent lower level to the next reached threshold', () => {
      const now = new Date('2026-04-05'); // 94 days late
      const rent = makeRent();
      const reminder = makeReminder({ level: 'amiable', thresholdDays: 30 });

      const result = computePendingReminders([rent], [reminder], THRESHOLDS, now);

      expect(result).toHaveLength(1);
      expect(result[0]?.level).toBe('mise-en-demeure');
    });

    it('skips a disabled threshold', () => {
      const now = new Date('2026-03-06'); // 64 days late
      const rent = makeRent();
      const thresholds: ReminderThresholdConfig[] = [
        { level: 'amiable', days: 30, enabled: true },
        { level: 'recommandee', days: 60, enabled: false },
        { level: 'mise-en-demeure', days: 90, enabled: true },
      ];

      const result = computePendingReminders([rent], [], thresholds, now);

      expect(result).toHaveLength(1);
      expect(result[0]?.level).toBe('amiable');
    });

    it('ignores rents that are fully paid', () => {
      const now = new Date('2026-04-05');
      const rent = makeRent({ status: 'paid' });

      expect(computePendingReminders([rent], [], THRESHOLDS, now)).toEqual([]);
    });

    it('still considers a partially paid rent that is overdue', () => {
      const now = new Date('2026-02-04'); // 34 days late
      const rent = makeRent({ status: 'partial', paidAmount: 400 });

      const result = computePendingReminders([rent], [], THRESHOLDS, now);

      expect(result).toHaveLength(1);
      expect(result[0]?.level).toBe('amiable');
    });
  });
});
