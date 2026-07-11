import { describe, expect, it } from 'vitest';
import { validateImportPayload } from './importValidationService';

const iso = '2026-01-01T00:00:00.000Z';

function buildValidProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Appartement Centre',
    address: '1 rue de la Paix',
    type: 'apartment',
    surface: 45,
    rooms: 2,
    rent: 800,
    charges: 50,
    status: 'vacant',
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
  };
}

function buildValidTenant(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean.dupont@example.com',
    phone: '0601020304',
    status: 'active',
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
  };
}

function buildFullValidPayload() {
  return {
    properties: [buildValidProperty()],
    tenants: [buildValidTenant()],
    leases: [
      {
        id: 1,
        propertyId: 1,
        tenantIds: [1],
        startDate: iso,
        rent: 800,
        charges: 50,
        deposit: 800,
        paymentDay: 5,
        status: 'active',
        createdAt: iso,
        updatedAt: iso,
      },
    ],
    rents: [
      {
        id: 1,
        leaseId: 1,
        dueDate: iso,
        amount: 800,
        charges: 50,
        status: 'pending',
        createdAt: iso,
        updatedAt: iso,
      },
    ],
    documents: [
      {
        id: 1,
        name: 'bail.pdf',
        type: 'lease',
        relatedEntityType: 'lease',
        relatedEntityId: 1,
        mimeType: 'application/pdf',
        size: 2,
        data: 'data:application/pdf;base64,SGk=',
        createdAt: iso,
        updatedAt: iso,
      },
    ],
    tenantDocuments: [
      {
        id: 1,
        tenantId: 1,
        name: 'cni.png',
        mimeType: 'image/png',
        size: 2,
        uploadedAt: iso,
        data: null,
      },
    ],
    tenantAudits: [
      {
        id: 1,
        tenantId: 1,
        action: 'validated',
        actorId: null,
        timestamp: iso,
      },
    ],
    inventories: [
      {
        id: 1,
        leaseId: 1,
        type: 'checkin',
        date: iso,
        rooms: [
          {
            name: 'Salon',
            items: [{ label: 'Murs', condition: 'good' }],
          },
        ],
        signature: { tenantAccepted: true, landlordAccepted: true, acceptedAt: iso },
        createdAt: iso,
        updatedAt: iso,
      },
    ],
    communications: [
      {
        id: 1,
        relatedEntityType: 'tenant',
        relatedEntityId: 1,
        type: 'email',
        direction: 'outbound',
        content: 'Bonjour',
        date: iso,
        createdAt: iso,
      },
    ],
    chargesAdjustments: [
      {
        id: 1,
        leaseId: 1,
        year: 2025,
        monthlyRent: 800,
        chargesProvisionPaid: 600,
        rentsPaidCount: 12,
        rentsPaidTotal: 9600,
        customCharges: { eau: 120 },
        createdAt: iso,
        updatedAt: iso,
      },
    ],
    irlIndices: [{ id: 1, year: 2025, quarter: 2, value: 145.17, createdAt: iso, updatedAt: iso }],
    rentRevisions: [
      {
        id: 1,
        leaseId: 1,
        year: 2025,
        anniversaryDate: iso,
        effectiveDate: iso,
        referenceQuarter: 2,
        oldRent: 780,
        newRent: 800,
        currentIrl: 145.17,
        previousIrl: 142.06,
        charges: 50,
        status: 'applied',
        createdAt: iso,
        updatedAt: iso,
      },
    ],
    reminders: [
      {
        id: 1,
        rentId: 1,
        level: 'amiable',
        thresholdDays: 5,
        sentDate: iso,
        documentId: 1,
        communicationId: 1,
        createdAt: iso,
      },
    ],
    settings: [{ id: 1, key: 'ownerName', value: 'Jean Propriétaire', updatedAt: iso }],
    exportedAt: iso,
    version: '1.0.0',
  };
}

describe('importValidationService', () => {
  describe('validateImportPayload — valid payloads', () => {
    it('accepts a full payload with a record in every table', () => {
      const payload = buildFullValidPayload();
      const validated = validateImportPayload(payload);

      expect(validated.properties).toHaveLength(1);
      expect(validated.tenants).toHaveLength(1);
      expect(validated.leases).toHaveLength(1);
      expect(validated.rents).toHaveLength(1);
      expect(validated.documents).toHaveLength(1);
      expect(validated.tenantDocuments).toHaveLength(1);
      expect(validated.tenantAudits).toHaveLength(1);
      expect(validated.inventories).toHaveLength(1);
      expect(validated.communications).toHaveLength(1);
      expect(validated.chargesAdjustments).toHaveLength(1);
      expect(validated.irlIndices).toHaveLength(1);
      expect(validated.rentRevisions).toHaveLength(1);
      expect(validated.reminders).toHaveLength(1);
      expect(validated.settings).toHaveLength(1);
      expect(validated.version).toBe('1.0.0');
    });

    it('accepts empty arrays for every table', () => {
      const validated = validateImportPayload({
        properties: [],
        tenants: [],
        version: '1.0.0',
      });
      expect(validated.properties).toEqual([]);
      expect(validated.tenants).toEqual([]);
    });

    it('defaults missing optional tables to empty arrays', () => {
      const validated = validateImportPayload({
        properties: [buildValidProperty()],
        tenants: [buildValidTenant()],
        version: '1.0.0',
      });
      expect(validated.leases).toEqual([]);
      expect(validated.rents).toEqual([]);
      expect(validated.documents).toEqual([]);
      expect(validated.tenantDocuments).toEqual([]);
      expect(validated.settings).toEqual([]);
    });

    it('accepts Date objects as well as ISO strings for date fields', () => {
      const payload = {
        properties: [buildValidProperty({ createdAt: new Date(iso), updatedAt: new Date(iso) })],
        tenants: [],
        version: '1.0.0',
      };
      expect(() => validateImportPayload(payload)).not.toThrow();
    });
  });

  describe('validateImportPayload — invalid payloads', () => {
    it('rejects a non-object payload', () => {
      expect(() => validateImportPayload(null)).toThrow('Format de fichier invalide');
      expect(() => validateImportPayload('not an object')).toThrow('Format de fichier invalide');
      expect(() => validateImportPayload(42)).toThrow('Format de fichier invalide');
      expect(() => validateImportPayload([])).toThrow('Format de fichier invalide');
      expect(() => validateImportPayload(undefined)).toThrow('Format de fichier invalide');
    });

    it('rejects a payload without the required version field', () => {
      expect(() => validateImportPayload({ properties: [], tenants: [] })).toThrow(/version/);
    });

    it('rejects a record with a wrong field type (email as number)', () => {
      const payload = {
        properties: [],
        tenants: [buildValidTenant({ email: 12345 })],
        version: '1.0.0',
      };
      expect(() => validateImportPayload(payload)).toThrow(/tenants\.0\.email/);
    });

    it('rejects a record with a missing required field', () => {
      const property = buildValidProperty();
      delete (property as Record<string, unknown>).name;
      expect(() =>
        validateImportPayload({ properties: [property], tenants: [], version: '1.0.0' })
      ).toThrow(/properties\.0\.name/);
    });

    it('rejects a record with an unknown extra field (.strict())', () => {
      const payload = {
        properties: [buildValidProperty({ hacked: true })],
        tenants: [],
        version: '1.0.0',
      };
      expect(() => validateImportPayload(payload)).toThrow(/properties\.0/);
    });

    it('rejects a record carrying a "__proto__" key', () => {
      const property = JSON.parse(
        `{"id":1,"name":"P","address":"1 rue","type":"apartment","surface":45,"rooms":2,` +
          `"rent":800,"status":"vacant","createdAt":"${iso}","updatedAt":"${iso}","__proto__":{"polluted":true}}`
      );
      expect(() =>
        validateImportPayload({ properties: [property], tenants: [], version: '1.0.0' })
      ).toThrow();
    });

    it('rejects a payload with an unknown top-level field', () => {
      expect(() =>
        validateImportPayload({
          properties: [],
          tenants: [],
          version: '1.0.0',
          extraTable: [],
        })
      ).toThrow();
    });

    it('rejects a table that is not an array (rents as string)', () => {
      expect(() =>
        validateImportPayload({
          properties: [],
          tenants: [],
          rents: 'not-an-array',
          version: '1.0.0',
        })
      ).toThrow(/rents/);
    });

    it('rejects an invalid enum value (property status)', () => {
      expect(() =>
        validateImportPayload({
          properties: [buildValidProperty({ status: 'available' })],
          tenants: [],
          version: '1.0.0',
        })
      ).toThrow(/properties\.0\.status/);
    });

    it('rejects an unparseable date string', () => {
      expect(() =>
        validateImportPayload({
          properties: [buildValidProperty({ createdAt: 'not-a-date' })],
          tenants: [],
          version: '1.0.0',
        })
      ).toThrow(/properties\.0\.createdAt/);
    });

    it('rejects a document whose serialized data is neither string nor null', () => {
      const payload = buildFullValidPayload();
      (payload.documents[0] as Record<string, unknown>).data = 123;
      expect(() => validateImportPayload(payload)).toThrow(/documents\.0\.data/);
    });

    it('rejects when a single record among many is invalid (whole import rejected)', () => {
      const payload = {
        properties: [buildValidProperty(), buildValidProperty({ id: 2, surface: 'grande' })],
        tenants: [buildValidTenant()],
        version: '1.0.0',
      };
      expect(() => validateImportPayload(payload)).toThrow(/properties\.1\.surface/);
    });
  });
});
