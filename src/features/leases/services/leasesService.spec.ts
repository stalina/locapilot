import { describe, it, expect } from 'vitest';
import type { Lease } from '@/db/types';
import {
  buildTerminationUpdates,
  buildDepositReceptionUpdates,
  buildDepositRestitutionUpdates,
} from './leasesService';

describe('buildTerminationUpdates', () => {
  it('marks the lease as ended with the given date', () => {
    const now = new Date('2026-05-01');
    expect(buildTerminationUpdates(now)).toEqual({ status: 'ended', endDate: now });
  });
});

describe('buildDepositReceptionUpdates', () => {
  it('returns the reception date update for a valid date', () => {
    const date = new Date('2026-01-03');
    expect(buildDepositReceptionUpdates(date)).toEqual({ depositReceivedDate: date });
  });

  it('accepts a date-like string', () => {
    const updates = buildDepositReceptionUpdates('2026-01-03' as unknown as Date);
    expect(updates.depositReceivedDate).toBeInstanceOf(Date);
    expect(updates.depositReceivedDate!.getFullYear()).toBe(2026);
  });

  it('throws on an invalid date', () => {
    expect(() => buildDepositReceptionUpdates(new Date('not-a-date'))).toThrow(
      /date de réception/i
    );
  });
});

describe('buildDepositRestitutionUpdates', () => {
  const received: Pick<Lease, 'deposit' | 'depositReceivedDate'> = {
    deposit: 750,
    depositReceivedDate: new Date('2026-01-03'),
  };

  it('returns the full restitution update', () => {
    const date = new Date('2027-01-15');
    expect(buildDepositRestitutionUpdates(received, date, 750)).toEqual({
      depositReturnedDate: date,
      depositReturnedAmount: 750,
    });
  });

  it('allows a partial restitution', () => {
    const date = new Date('2027-01-15');
    const updates = buildDepositRestitutionUpdates(received, date, 600);
    expect(updates.depositReturnedAmount).toBe(600);
  });

  it('allows a restitution on the exact reception date', () => {
    const date = new Date('2026-01-03');
    expect(() => buildDepositRestitutionUpdates(received, date, 0)).not.toThrow();
  });

  it('throws when the deposit has not been received', () => {
    expect(() =>
      buildDepositRestitutionUpdates({ deposit: 750 }, new Date('2027-01-15'), 750)
    ).toThrow(/marqué comme reçu/i);
  });

  it('throws when the returned amount exceeds the deposit', () => {
    expect(() => buildDepositRestitutionUpdates(received, new Date('2027-01-15'), 800)).toThrow(
      'Le montant restitué ne peut pas dépasser le dépôt'
    );
  });

  it('throws on a negative returned amount', () => {
    expect(() => buildDepositRestitutionUpdates(received, new Date('2027-01-15'), -1)).toThrow(
      /positif/i
    );
  });

  it('throws when the restitution date precedes the reception date', () => {
    expect(() => buildDepositRestitutionUpdates(received, new Date('2025-12-01'), 750)).toThrow(
      'La date de restitution doit être postérieure à la réception'
    );
  });

  it('throws on an invalid restitution date', () => {
    expect(() => buildDepositRestitutionUpdates(received, new Date('bad'), 750)).toThrow(
      /date de restitution/i
    );
  });
});
