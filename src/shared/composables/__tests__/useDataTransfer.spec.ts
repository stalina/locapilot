import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDataTransfer } from '../useDataTransfer';
import { z } from 'zod';

// Mock useImport and useExport
vi.mock('../useImport', () => ({
  useImport: () => ({
    importFromJSON: vi.fn(),
    pickAndImportJSON: vi.fn(),
  }),
}));

vi.mock('../useExport', () => ({
  useExport: () => ({
    exportToJSON: vi.fn(),
  }),
}));

describe('useDataTransfer', () => {
  let dataTransfer: ReturnType<typeof useDataTransfer>;

  beforeEach(() => {
    dataTransfer = useDataTransfer();
  });

  describe('validateProperties', () => {
    it('should validate valid properties', () => {
      const validProperties = [
        {
          name: 'Appartement Test',
          address: '123 Rue de Test',
          city: 'Paris',
          postalCode: '75001',
          type: 'apartment',
          surface: 50,
          rooms: 2,
          price: 1200,
          status: 'available',
        },
      ];

      const result = dataTransfer.validateProperties(validProperties);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should reject invalid properties', () => {
      const invalidProperties = [
        {
          name: '', // Invalid: empty name
          address: '123 Rue de Test',
          city: 'Paris',
          postalCode: '75001',
          type: 'apartment',
          surface: 50,
          rooms: 2,
          price: 1200,
          status: 'available',
        },
      ];

      const result = dataTransfer.validateProperties(invalidProperties);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors).toBeInstanceOf(z.ZodError);
    });

    it('should reject properties with invalid postal code', () => {
      const invalidProperties = [
        {
          name: 'Appartement Test',
          address: '123 Rue de Test',
          city: 'Paris',
          postalCode: '750', // Invalid: not 5 digits
          type: 'apartment',
          surface: 50,
          rooms: 2,
          price: 1200,
          status: 'available',
        },
      ];

      const result = dataTransfer.validateProperties(invalidProperties);
      expect(result.valid).toBe(false);
    });

    it('should reject properties with negative price', () => {
      const invalidProperties = [
        {
          name: 'Appartement Test',
          address: '123 Rue de Test',
          city: 'Paris',
          postalCode: '75001',
          type: 'apartment',
          surface: 50,
          rooms: 2,
          price: -100, // Invalid: negative price
          status: 'available',
        },
      ];

      const result = dataTransfer.validateProperties(invalidProperties);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateTenants', () => {
    it('should validate valid tenants', () => {
      const validTenants = [
        {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          phone: '0612345678',
          status: 'active',
        },
      ];

      const result = dataTransfer.validateTenants(validTenants);
      expect(result.valid).toBe(true);
    });

    it('should reject tenants with invalid email', () => {
      const invalidTenants = [
        {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'invalid-email', // Invalid email
          phone: '0612345678',
          status: 'active',
        },
      ];

      const result = dataTransfer.validateTenants(invalidTenants);
      expect(result.valid).toBe(false);
    });

    it('should reject tenants with invalid phone', () => {
      const invalidTenants = [
        {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@example.com',
          phone: '123', // Invalid phone
          status: 'active',
        },
      ];

      const result = dataTransfer.validateTenants(invalidTenants);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateLeases', () => {
    it('should validate valid leases', () => {
      const validLeases = [
        {
          propertyId: 1,
          tenantIds: [1, 2],
          startDate: '2024-01-01',
          rent: 1200,
          paymentDay: 5,
          type: 'unfurnished',
          status: 'active',
        },
      ];

      const result = dataTransfer.validateLeases(validLeases);
      expect(result.valid).toBe(true);
    });

    it('should reject leases with empty tenantIds', () => {
      const invalidLeases = [
        {
          propertyId: 1,
          tenantIds: [], // Invalid: empty array
          startDate: '2024-01-01',
          rent: 1200,
          paymentDay: 5,
          type: 'unfurnished',
          status: 'active',
        },
      ];

      const result = dataTransfer.validateLeases(invalidLeases);
      expect(result.valid).toBe(false);
    });

    it('should reject leases with invalid paymentDay', () => {
      const invalidLeases = [
        {
          propertyId: 1,
          tenantIds: [1],
          startDate: '2024-01-01',
          rent: 1200,
          paymentDay: 35, // Invalid: > 31
          type: 'unfurnished',
          status: 'active',
        },
      ];

      const result = dataTransfer.validateLeases(invalidLeases);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateRents', () => {
    it('should validate valid rents', () => {
      const validRents = [
        {
          leaseId: 1,
          propertyId: 1,
          tenantId: 1,
          amount: 1200,
          dueDate: '2024-01-01',
          status: 'pending',
        },
      ];

      const result = dataTransfer.validateRents(validRents);
      expect(result.valid).toBe(true);
    });

    it('should reject rents with negative amount', () => {
      const invalidRents = [
        {
          leaseId: 1,
          propertyId: 1,
          tenantId: 1,
          amount: -100, // Invalid: negative
          dueDate: '2024-01-01',
          status: 'pending',
        },
      ];

      const result = dataTransfer.validateRents(invalidRents);
      expect(result.valid).toBe(false);
    });

    it('should validate rent with optional fields', () => {
      const validRents = [
        {
          leaseId: 1,
          propertyId: 1,
          tenantId: 1,
          amount: 1200,
          charges: 100,
          dueDate: '2024-01-01',
          paidDate: '2024-01-05',
          status: 'paid',
          paymentMethod: 'transfer',
          notes: 'Payé en avance',
        },
      ];

      const result = dataTransfer.validateRents(validRents);
      expect(result.valid).toBe(true);
    });
  });
});
