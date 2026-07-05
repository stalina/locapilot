import { describe, it, expect } from 'vitest';
import type { Communication, Lease, Property, Tenant } from '@/db/types';
import {
  ORPHAN_ENTITY_LABEL,
  filterCommunications,
  isReadOnlyCommunication,
  resolveEntityLabel,
  validateCommunicationDraft,
} from './communicationsService';

function comm(overrides: Partial<Communication> = {}): Communication {
  return {
    id: 1,
    relatedEntityType: 'tenant',
    relatedEntityId: 10,
    type: 'phone',
    direction: 'inbound',
    subject: 'Sujet',
    content: 'Contenu',
    date: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('communicationsService', () => {
  describe('validateCommunicationDraft', () => {
    // Local-time (no Z suffix) to stay deterministic in any timezone.
    const now = new Date('2026-07-04T12:00:00');

    it('accepts a valid past-dated non-empty draft', () => {
      const errors = validateCommunicationDraft(
        { content: 'Un appel', date: new Date('2026-07-03T12:00:00') },
        now
      );
      expect(errors).toEqual([]);
    });

    it('rejects a future date', () => {
      const errors = validateCommunicationDraft(
        { content: 'Un appel', date: new Date('2026-07-05T12:00:00') },
        now
      );
      expect(errors).toContain('La date ne peut pas être dans le futur.');
    });

    it("accepts today's date at noon when submitted in the morning (day granularity)", () => {
      // Regression: the form stores dates at 12:00 local time; before noon,
      // "today at 12:00" is later than `now` but must NOT count as future.
      const morning = new Date('2026-07-04T08:00:00');
      const errors = validateCommunicationDraft(
        { content: 'Un appel', date: new Date('2026-07-04T12:00:00') },
        morning
      );
      expect(errors).toEqual([]);
    });

    it("accepts any time on today's calendar day, even late evening", () => {
      const morning = new Date('2026-07-04T08:00:00');
      const errors = validateCommunicationDraft(
        { content: 'Un appel', date: new Date('2026-07-04T23:30:00') },
        morning
      );
      expect(errors).toEqual([]);
    });

    it('still rejects tomorrow even when compared early in the morning', () => {
      const morning = new Date('2026-07-04T08:00:00');
      const errors = validateCommunicationDraft(
        { content: 'Un appel', date: new Date('2026-07-05T00:00:01') },
        morning
      );
      expect(errors).toContain('La date ne peut pas être dans le futur.');
    });

    it('rejects empty content', () => {
      const errors = validateCommunicationDraft(
        { content: '   ', date: new Date('2026-07-03') },
        now
      );
      expect(errors).toContain('Le contenu est obligatoire.');
    });

    it('rejects an invalid date', () => {
      const errors = validateCommunicationDraft(
        { content: 'ok', date: new Date('not-a-date') },
        now
      );
      expect(errors).toContain('La date est invalide.');
    });

    it('accumulates multiple errors', () => {
      const errors = validateCommunicationDraft(
        { content: '', date: new Date('2026-07-05T12:00:00') },
        now
      );
      expect(errors.length).toBe(2);
    });
  });

  describe('filterCommunications', () => {
    const data = [
      comm({
        id: 1,
        type: 'letter',
        direction: 'outbound',
        relatedEntityType: 'rent',
        content: 'chaudière en panne',
      }),
      comm({
        id: 2,
        type: 'phone',
        direction: 'inbound',
        relatedEntityType: 'tenant',
        content: 'rappel',
      }),
      comm({
        id: 3,
        type: 'meeting',
        direction: 'outbound',
        relatedEntityType: 'lease',
        subject: 'visite chaudière',
      }),
    ];

    it('returns all when no filter set', () => {
      expect(filterCommunications(data, {})).toHaveLength(3);
    });

    it('filters by type', () => {
      const res = filterCommunications(data, { type: 'letter' });
      expect(res.map(c => c.id)).toEqual([1]);
    });

    it('filters by direction', () => {
      const res = filterCommunications(data, { direction: 'outbound' });
      expect(res.map(c => c.id)).toEqual([1, 3]);
    });

    it('filters by related entity type', () => {
      const res = filterCommunications(data, { relatedEntityType: 'tenant' });
      expect(res.map(c => c.id)).toEqual([2]);
    });

    it('searches subject and content case-insensitively', () => {
      const res = filterCommunications(data, { search: 'CHAUDIÈRE' });
      expect(res.map(c => c.id).sort()).toEqual([1, 3]);
    });

    it('treats "all" sentinel as no filter', () => {
      const res = filterCommunications(data, {
        type: 'all',
        direction: 'all',
        relatedEntityType: 'all',
      });
      expect(res).toHaveLength(3);
    });

    it('combining filters can yield no match', () => {
      const res = filterCommunications(data, { type: 'letter', direction: 'inbound' });
      expect(res).toHaveLength(0);
    });
  });

  describe('isReadOnlyCommunication', () => {
    it('is read-only when the id is referenced by a reminder', () => {
      expect(isReadOnlyCommunication({ id: 5 }, new Set([5, 9]))).toBe(true);
    });

    it('is editable when not referenced', () => {
      expect(isReadOnlyCommunication({ id: 2 }, new Set([5, 9]))).toBe(false);
    });

    it('is editable when id is undefined', () => {
      expect(isReadOnlyCommunication({ id: undefined }, new Set([5]))).toBe(false);
    });
  });

  describe('resolveEntityLabel', () => {
    const properties: Property[] = [{ id: 1, name: 'Studio Belleville' } as Property];
    const tenants: Tenant[] = [{ id: 10, firstName: 'Marie', lastName: 'Martin' } as Tenant];
    const leases: Lease[] = [{ id: 100, propertyId: 1 } as Lease];
    const ctx = { properties, tenants, leases };

    it('resolves a property name', () => {
      expect(resolveEntityLabel({ relatedEntityType: 'property', relatedEntityId: 1 }, ctx)).toBe(
        'Studio Belleville'
      );
    });

    it('resolves a tenant full name', () => {
      expect(resolveEntityLabel({ relatedEntityType: 'tenant', relatedEntityId: 10 }, ctx)).toBe(
        'Marie Martin'
      );
    });

    it('resolves a lease with its property name', () => {
      expect(resolveEntityLabel({ relatedEntityType: 'lease', relatedEntityId: 100 }, ctx)).toBe(
        'Bail — Studio Belleville'
      );
    });

    it('falls back to orphan label for a deleted tenant', () => {
      expect(resolveEntityLabel({ relatedEntityType: 'tenant', relatedEntityId: 999 }, ctx)).toBe(
        ORPHAN_ENTITY_LABEL
      );
    });

    it('labels a rent by id', () => {
      expect(resolveEntityLabel({ relatedEntityType: 'rent', relatedEntityId: 7 }, ctx)).toBe(
        'Loyer #7'
      );
    });
  });
});
