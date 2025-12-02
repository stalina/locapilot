import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../database';

describe('Database Schema', () => {
  beforeEach(async () => {
    await db.open();
    // Clear all tables before each test
    await db.properties.clear();
    await db.tenants.clear();
    await db.leases.clear();
    await db.rents.clear();
    await db.documents.clear();
    await db.inventories.clear();
    await db.communications.clear();
    await db.tenantDocuments.clear();
    await db.tenantAudits.clear();
    await db.settings.clear();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Database initialization', () => {
    it('should initialize database with correct version', async () => {
      expect(db.verno).toBe(5);
    });

    it('should have all required tables', async () => {
      const tables = db.tables.map(t => t.name);

      expect(tables).toContain('properties');
      expect(tables).toContain('tenants');
      expect(tables).toContain('leases');
      expect(tables).toContain('rents');
      expect(tables).toContain('documents');
      expect(tables).toContain('inventories');
      expect(tables).toContain('communications');
      expect(tables).toContain('tenantDocuments');
      expect(tables).toContain('tenantAudits');
      expect(tables).toContain('settings');

      expect(tables).toHaveLength(10);
    });
  });

  describe('Table structures', () => {
    it('should have correct indexes for properties table', () => {
      const schema = db.properties.schema;

      expect(schema.primKey.name).toBe('id');
      expect(schema.primKey.auto).toBe(true);
      expect(schema.indexes.map(i => i.name)).toContain('status');
      expect(schema.indexes.map(i => i.name)).toContain('name');
    });

    it('should have correct indexes for tenants table', () => {
      const schema = db.tenants.schema;

      expect(schema.primKey.name).toBe('id');
      expect(schema.primKey.auto).toBe(true);
      expect(schema.indexes.map(i => i.name)).toContain('status');
      expect(schema.indexes.map(i => i.name)).toContain('email');
    });

    it('should have correct indexes for leases table', () => {
      const schema = db.leases.schema;

      expect(schema.primKey.name).toBe('id');
      expect(schema.primKey.auto).toBe(true);
      expect(schema.indexes.map(i => i.name)).toContain('propertyId');
      expect(schema.indexes.map(i => i.name)).toContain('status');
    });

    it('should have correct indexes for rents table', () => {
      const schema = db.rents.schema;

      expect(schema.primKey.name).toBe('id');
      expect(schema.primKey.auto).toBe(true);
      expect(schema.indexes.map(i => i.name)).toContain('leaseId');
      expect(schema.indexes.map(i => i.name)).toContain('status');
      expect(schema.indexes.map(i => i.name)).toContain('dueDate');
    });

    it('should have correct indexes for documents table', () => {
      const schema = db.documents.schema;

      expect(schema.primKey.name).toBe('id');
      expect(schema.primKey.auto).toBe(true);
      expect(schema.indexes.map(i => i.name)).toContain('type');
    });

    it('should have correct indexes for settings table', () => {
      const schema = db.settings.schema;

      expect(schema.primKey.name).toBe('id');
      expect(schema.primKey.auto).toBe(true);
    });
  });

  describe('CRUD operations', () => {
    describe('Properties table', () => {
      it('should create a property', async () => {
        const property = {
          name: 'Test Property',
          address: '123 Test St',
          type: 'apartment' as const,
          surface: 50,
          rooms: 2,
          rent: 1000,
          status: 'vacant' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const id = await db.properties.add(property);
        expect(id).toBeTypeOf('number');

        const saved = await db.properties.get(id);
        expect(saved).toBeDefined();
        expect(saved?.name).toBe('Test Property');
        expect(saved?.type).toBe('apartment');
      });

      it('should update a property', async () => {
        const id = await db.properties.add({
          name: 'Original Name',
          address: '123 Test St',
          type: 'apartment' as const,
          surface: 50,
          rooms: 2,
          rent: 1000,
          status: 'vacant' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.properties.update(id, {
          name: 'Updated Name',
          updatedAt: new Date(),
        });

        const updated = await db.properties.get(id);
        expect(updated?.name).toBe('Updated Name');
      });

      it('should delete a property', async () => {
        const id = await db.properties.add({
          name: 'To Delete',
          address: '123 Test St',
          type: 'apartment' as const,
          surface: 50,
          rooms: 2,
          rent: 1000,
          status: 'vacant' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await db.properties.delete(id);

        const deleted = await db.properties.get(id);
        expect(deleted).toBeUndefined();
      });

      it('should query properties by status', async () => {
        await db.properties.bulkAdd([
          {
            name: 'Property 1',
            address: '123 Test St',
            type: 'apartment' as const,
            surface: 50,
            rooms: 2,
            rent: 1000,
            status: 'vacant' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            name: 'Property 2',
            address: '456 Test Ave',
            type: 'house' as const,
            surface: 100,
            rooms: 4,
            rent: 2000,
            status: 'occupied' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const vacantProperties = await db.properties.where('status').equals('vacant').toArray();

        expect(vacantProperties).toHaveLength(1);
        expect(vacantProperties[0]?.name).toBe('Property 1');
      });
    });

    describe('Tenants table', () => {
      it('should create a tenant', async () => {
        const tenant = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+33612345678',
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const id = await db.tenants.add(tenant);
        expect(id).toBeTypeOf('number');

        const saved = await db.tenants.get(id);
        expect(saved).toBeDefined();
        expect(saved?.firstName).toBe('John');
        expect(saved?.email).toBe('john@example.com');
      });

      it('should query tenants by status', async () => {
        await db.tenants.bulkAdd([
          {
            firstName: 'Active',
            lastName: 'Tenant',
            email: 'active@example.com',
            phone: '+33612345678',
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            firstName: 'Candidate',
            lastName: 'Tenant',
            email: 'candidate@example.com',
            phone: '+33612345679',
            status: 'candidate' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const activeTenants = await db.tenants.where('status').equals('active').toArray();

        expect(activeTenants).toHaveLength(1);
        expect(activeTenants[0]?.firstName).toBe('Active');
      });
    });

    describe('Leases table', () => {
      it('should create a lease', async () => {
        const lease = {
          propertyId: 1,
          tenantIds: [1, 2],
          startDate: new Date('2025-01-01'),
          rent: 1000,
          charges: 100,
          deposit: 2000,
          paymentDay: 1,
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const id = await db.leases.add(lease);
        expect(id).toBeTypeOf('number');

        const saved = await db.leases.get(id);
        expect(saved).toBeDefined();
        expect(saved?.propertyId).toBe(1);
        expect(saved?.tenantIds).toEqual([1, 2]);
      });

      it('should query leases by property', async () => {
        await db.leases.bulkAdd([
          {
            propertyId: 1,
            tenantIds: [1],
            startDate: new Date('2025-01-01'),
            rent: 1000,
            charges: 100,
            deposit: 2000,
            paymentDay: 1,
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            propertyId: 2,
            tenantIds: [2],
            startDate: new Date('2025-01-01'),
            rent: 1500,
            charges: 150,
            deposit: 3000,
            paymentDay: 1,
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const property1Leases = await db.leases.where('propertyId').equals(1).toArray();

        expect(property1Leases).toHaveLength(1);
        expect(property1Leases[0]?.rent).toBe(1000);
      });
    });

    describe('Rents table', () => {
      it('should create a rent', async () => {
        const rent = {
          leaseId: 1,
          dueDate: new Date('2025-01-01'),
          amount: 1000,
          charges: 100,
          status: 'pending' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const id = await db.rents.add(rent);
        expect(id).toBeTypeOf('number');

        const saved = await db.rents.get(id);
        expect(saved).toBeDefined();
        expect(saved?.amount).toBe(1000);
        expect(saved?.status).toBe('pending');
      });

      it('should query rents by status', async () => {
        await db.rents.bulkAdd([
          {
            leaseId: 1,
            dueDate: new Date('2025-01-01'),
            amount: 1000,
            charges: 100,
            status: 'paid' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            leaseId: 1,
            dueDate: new Date('2025-02-01'),
            amount: 1000,
            charges: 100,
            status: 'pending' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

        const pendingRents = await db.rents.where('status').equals('pending').toArray();

        expect(pendingRents).toHaveLength(1);
      });
    });
  });

  describe('Relations between tables', () => {
    it('should link property to lease', async () => {
      const propertyId = await db.properties.add({
        name: 'Test Property',
        address: '123 Test St',
        type: 'apartment' as const,
        surface: 50,
        rooms: 2,
        rent: 1000,
        status: 'vacant' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(propertyId).toBeDefined();

      const leaseId = await db.leases.add({
        propertyId: propertyId!,
        tenantIds: [1],
        startDate: new Date('2025-01-01'),
        rent: 1000,
        charges: 100,
        deposit: 2000,
        paymentDay: 1,
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const lease = await db.leases.get(leaseId);
      const property = await db.properties.get(propertyId!);

      expect(lease?.propertyId).toBe(propertyId);
      expect(property).toBeDefined();
    });

    it('should link lease to rents', async () => {
      const leaseId = await db.leases.add({
        propertyId: 1,
        tenantIds: [1],
        startDate: new Date('2025-01-01'),
        rent: 1000,
        charges: 100,
        deposit: 2000,
        paymentDay: 1,
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(leaseId).toBeDefined();

      await db.rents.bulkAdd([
        {
          leaseId: leaseId!,
          dueDate: new Date('2025-01-01'),
          amount: 1000,
          charges: 100,
          status: 'paid' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          leaseId: leaseId!,
          dueDate: new Date('2025-02-01'),
          amount: 1000,
          charges: 100,
          status: 'pending' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const leaseRents = await db.rents.where('leaseId').equals(leaseId!).toArray();

      expect(leaseRents).toHaveLength(2);
    });

    it('should link tenant to multiple leases', async () => {
      const tenantId = await db.tenants.add({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+33612345678',
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(tenantId).toBeDefined();

      await db.leases.bulkAdd([
        {
          propertyId: 1,
          tenantIds: [tenantId!],
          startDate: new Date('2023-01-01'),
          endDate: new Date('2024-01-01'),
          rent: 800,
          charges: 80,
          deposit: 1600,
          paymentDay: 1,
          status: 'ended' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          propertyId: 2,
          tenantIds: [tenantId!],
          startDate: new Date('2024-02-01'),
          rent: 1000,
          charges: 100,
          deposit: 2000,
          paymentDay: 1,
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const tenantLeases = await db.leases
        .filter(lease => lease.tenantIds.includes(tenantId!))
        .toArray();

      expect(tenantLeases).toHaveLength(2);
    });
  });
});
