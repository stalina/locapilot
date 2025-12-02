import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  migrations,
  getMigrationHistory,
  hasPendingMigrations,
  exportDatabaseSchema,
} from '../migrations';
import { db } from '../schema';

describe('Database Migrations', () => {
  beforeEach(async () => {
    await db.open();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('migrations', () => {
    it('should have at least version 1', () => {
      expect(migrations.length).toBeGreaterThanOrEqual(1);
      expect(migrations[0]).toMatchObject({
        version: 1,
        description: expect.any(String),
        upgrade: expect.any(Function),
      });
    });

    it('should have unique version numbers', () => {
      const versions = migrations.map(m => m.version);
      const uniqueVersions = new Set(versions);
      expect(uniqueVersions.size).toBe(versions.length);
    });

    it('should have ordered version numbers', () => {
      const versions = migrations.map(m => m.version);
      const sortedVersions = [...versions].sort((a, b) => a - b);
      expect(versions).toEqual(sortedVersions);
    });

    it('should have descriptions for all migrations', () => {
      migrations.forEach(migration => {
        expect(migration.description).toBeTruthy();
        expect(typeof migration.description).toBe('string');
      });
    });
  });

  describe('getMigrationHistory', () => {
    it('should return migration history', () => {
      const history = getMigrationHistory();

      expect(history).toMatchObject({
        current: expect.any(Number),
        available: expect.any(Number),
        pending: expect.any(Array),
        applied: expect.any(Array),
      });
    });

    it('should have correct current version', () => {
      const history = getMigrationHistory();
      expect(history.current).toBe(db.verno);
    });

    it('should count available migrations', () => {
      const history = getMigrationHistory();
      expect(history.available).toBe(migrations.length);
    });

    it('should split migrations into applied and pending', () => {
      const history = getMigrationHistory();
      expect(history.applied.length + history.pending.length).toBe(migrations.length);
    });

    it('should mark version 1 as applied', () => {
      const history = getMigrationHistory();
      const version1 = history.applied.find(m => m.version === 1);
      expect(version1).toBeDefined();
      expect(version1?.description).toContain('Schema initial');
    });
  });

  describe('hasPendingMigrations', () => {
    it('should return boolean', () => {
      const result = hasPendingMigrations();
      expect(typeof result).toBe('boolean');
    });

    it('should return false for current version', () => {
      // Avec seulement version 1 et DB à version 1, pas de pending
      const result = hasPendingMigrations();
      expect(result).toBe(false);
    });
  });

  describe('exportDatabaseSchema', () => {
    it('should export schema information', async () => {
      const schema = await exportDatabaseSchema();

      expect(schema).toMatchObject({
        version: expect.any(Number),
        tables: expect.any(Object),
      });
    });

    it('should include all tables', async () => {
      const schema = await exportDatabaseSchema();

      expect(schema.tables).toHaveProperty('properties');
      expect(schema.tables).toHaveProperty('tenants');
      expect(schema.tables).toHaveProperty('leases');
      expect(schema.tables).toHaveProperty('rents');
      expect(schema.tables).toHaveProperty('documents');
      expect(schema.tables).toHaveProperty('settings');
    });

    it('should have current version', async () => {
      const schema = await exportDatabaseSchema();
      expect(schema.version).toBe(db.verno);
    });

    it('should have table schemas as strings', async () => {
      const schema = await exportDatabaseSchema();

      Object.values(schema.tables).forEach(tableSchema => {
        expect(typeof tableSchema).toBe('string');
        expect(tableSchema).toBeTruthy();
      });
    });

    it('should include primary key in schema', async () => {
      const schema = await exportDatabaseSchema();

      // Properties table devrait avoir ++id
      expect(schema.tables.properties).toContain('++id');

      // Settings table devrait avoir &key (unique index)
      expect(schema.tables.settings).toContain('&key');
    });
  });

  describe('Database version', () => {
    it('should be at version 3', () => {
      expect(db.verno).toBe(4);
    });

    it('should have all required tables', () => {
      const tableNames = db.tables.map(t => t.name);

      expect(tableNames).toContain('properties');
      expect(tableNames).toContain('tenants');
      expect(tableNames).toContain('leases');
      expect(tableNames).toContain('rents');
      expect(tableNames).toContain('documents');
      expect(tableNames).toContain('inventories');
      expect(tableNames).toContain('communications');
      expect(tableNames).toContain('settings');
    });

    it('should have correct indexes for properties', () => {
      const table = db.table('properties');
      const schema = table.schema;

      // Primary key
      expect(schema.primKey.name).toBe('id');
      expect(schema.primKey.auto).toBe(true);

      // Indexes
      const indexNames = schema.indexes.map(idx => idx.name);
      expect(indexNames).toContain('name');
      expect(indexNames).toContain('status');
      expect(indexNames).toContain('createdAt');
    });

    it('should have unique key index for settings', () => {
      const table = db.table('settings');
      const schema = table.schema;

      const keyIndex = schema.indexes.find(idx => idx.name === 'key');
      expect(keyIndex).toBeDefined();
      expect(keyIndex?.unique).toBe(true);
    });
  });
});
