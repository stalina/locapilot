import { describe, expect, it } from 'vitest';
import type { Document, Lease, Property, Rent } from '@/db/types';
import { computeDashboardAlerts } from './dashboardAlertsService';

const NOW = new Date('2026-06-01T12:00:00');

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 1,
    name: 'Studio Belleville',
    address: '1 rue de Belleville',
    type: 'studio',
    surface: 25,
    rooms: 1,
    rent: 900,
    status: 'occupied',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeLease(overrides: Partial<Lease> = {}): Lease {
  return {
    id: 10,
    propertyId: 1,
    tenantIds: [1],
    startDate: new Date('2024-06-15'),
    rent: 900,
    charges: 50,
    deposit: 900,
    paymentDay: 5,
    status: 'active',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeRent(overrides: Partial<Rent> = {}): Rent {
  return {
    id: 100,
    leaseId: 10,
    dueDate: new Date('2026-05-05'),
    amount: 900,
    charges: 50,
    status: 'pending',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: 1000,
    name: 'DPE - Studio Belleville.pdf',
    type: 'diagnostic',
    relatedEntityType: 'property',
    relatedEntityId: 1,
    mimeType: 'application/pdf',
    size: 1234,
    data: new Blob(['x']),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function compute(
  overrides: Partial<{
    leases: Lease[];
    properties: Property[];
    rents: Rent[];
    documents: Document[];
    now: Date;
  }> = {}
) {
  return computeDashboardAlerts({
    leases: [],
    properties: [],
    rents: [],
    documents: [],
    now: NOW,
    ...overrides,
  });
}

describe('computeDashboardAlerts', () => {
  describe('critical arrears', () => {
    it('flags a late rent overdue by more than 60 days as critical with a link to /rents', () => {
      const rent = makeRent({ status: 'late', dueDate: new Date('2026-03-15') }); // 78 days
      const alerts = compute({
        rents: [rent],
        leases: [makeLease()],
        properties: [makeProperty()],
      });

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        id: 'arrears-100',
        severity: 'critical',
        title: 'Impayé critique',
        link: { path: '/rents' },
      });
      expect(alerts[0]!.description).toContain('Studio Belleville');
    });

    it('counts a partial payment as arrears', () => {
      const rent = makeRent({ status: 'partial', dueDate: new Date('2026-03-01') }); // 92 days
      const alerts = compute({ rents: [rent] });

      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.severity).toBe('critical');
    });

    it('ignores a late rent overdue by 60 days or less', () => {
      // 22 days overdue
      const recent = makeRent({ id: 101, status: 'late', dueDate: new Date('2026-05-10') });
      // exactly 60 days overdue (boundary: not critical)
      const boundary = makeRent({
        id: 102,
        status: 'late',
        dueDate: new Date('2026-04-02T12:00:00'),
      });

      expect(compute({ rents: [recent, boundary] })).toHaveLength(0);
    });

    it('ignores paid and pending rents whatever their due date', () => {
      const rents = [
        makeRent({ id: 101, status: 'paid', dueDate: new Date('2026-01-05') }),
        makeRent({ id: 102, status: 'pending', dueDate: new Date('2026-01-05') }),
      ];

      expect(compute({ rents })).toHaveLength(0);
    });
  });

  describe('expired diagnostics', () => {
    it('flags an expired diagnostic and links to the related property', () => {
      const doc = makeDocument({ expiresAt: new Date('2026-05-01') });
      const alerts = compute({ documents: [doc] });

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        id: 'diagnostic-1000',
        severity: 'warning',
        title: 'Diagnostic expiré',
        link: { path: '/properties/1' },
      });
      expect(alerts[0]!.description).toContain('DPE - Studio Belleville.pdf');
    });

    it('links to /documents when the diagnostic is not linked to a property', () => {
      const doc = makeDocument({
        expiresAt: new Date('2026-05-01'),
        relatedEntityType: undefined,
        relatedEntityId: undefined,
      });

      const alerts = compute({ documents: [doc] });
      expect(alerts[0]!.link).toEqual({ path: '/documents' });
    });

    it('never flags a diagnostic without expiresAt', () => {
      expect(compute({ documents: [makeDocument({ expiresAt: undefined })] })).toHaveLength(0);
    });

    it('ignores a diagnostic expiring in the future', () => {
      const doc = makeDocument({ expiresAt: new Date('2036-06-01') });
      expect(compute({ documents: [doc] })).toHaveLength(0);
    });

    it('ignores expired documents of another type', () => {
      const doc = makeDocument({ type: 'insurance', expiresAt: new Date('2026-05-01') });
      expect(compute({ documents: [doc] })).toHaveLength(0);
    });
  });

  describe('lease expiry', () => {
    it('flags an active lease ending within 30 days with a link to the lease detail', () => {
      const lease = makeLease({ endDate: new Date('2026-06-20') }); // 19 days
      const alerts = compute({ leases: [lease], properties: [makeProperty()] });

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        id: 'lease-expiry-10',
        severity: 'warning',
        title: 'Fin de bail proche',
        link: { path: '/leases/10' },
      });
      expect(alerts[0]!.description).toContain('Studio Belleville');
      expect(alerts[0]!.description).toContain('19 jours');
    });

    it('ignores an ended lease even if its endDate is within 30 days', () => {
      const lease = makeLease({ status: 'ended', endDate: new Date('2026-06-11') });
      expect(compute({ leases: [lease] })).toHaveLength(0);
    });

    it('ignores a pending lease', () => {
      const lease = makeLease({ status: 'pending', endDate: new Date('2026-06-11') });
      expect(compute({ leases: [lease] })).toHaveLength(0);
    });

    it('ignores an active lease ending after the 30-day window or without endDate', () => {
      const leases = [
        makeLease({ id: 11, endDate: new Date('2026-08-01') }),
        makeLease({ id: 12, endDate: undefined }),
      ];
      expect(compute({ leases })).toHaveLength(0);
    });
  });

  describe('ordering and empty state', () => {
    it('orders alerts: critical arrears, then expired diagnostics, then lease expiries', () => {
      const alerts = compute({
        leases: [makeLease({ endDate: new Date('2026-06-16') })],
        properties: [makeProperty()],
        rents: [makeRent({ status: 'late', dueDate: new Date('2026-03-15') })],
        documents: [makeDocument({ expiresAt: new Date('2026-05-01') })],
      });

      expect(alerts.map(a => a.id)).toEqual(['arrears-100', 'diagnostic-1000', 'lease-expiry-10']);
    });

    it('returns an empty array when nothing requires attention', () => {
      const alerts = compute({
        leases: [makeLease({ endDate: new Date('2027-06-01') })],
        properties: [makeProperty()],
        rents: [makeRent({ status: 'paid' })],
        documents: [makeDocument({ expiresAt: new Date('2036-01-01') })],
      });

      expect(alerts).toEqual([]);
    });
  });
});
