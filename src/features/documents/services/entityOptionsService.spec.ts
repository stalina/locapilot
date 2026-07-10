import { describe, it, expect, vi, beforeEach } from 'vitest';

const bulkGet = {
  properties: vi.fn(),
  tenants: vi.fn(),
  leases: vi.fn(),
  rents: vi.fn(),
  inventories: vi.fn(),
};

vi.mock('@/db/database', () => ({
  db: {
    properties: { bulkGet: (ids: number[]) => bulkGet.properties(ids) },
    tenants: { bulkGet: (ids: number[]) => bulkGet.tenants(ids) },
    leases: { bulkGet: (ids: number[]) => bulkGet.leases(ids) },
    rents: { bulkGet: (ids: number[]) => bulkGet.rents(ids) },
    inventories: { bulkGet: (ids: number[]) => bulkGet.inventories(ids) },
  },
}));

import { loadEntityOptions } from './entityOptionsService';

describe('loadEntityOptions', () => {
  beforeEach(() => {
    Object.values(bulkGet).forEach(m => m.mockReset());
  });

  it('returns an empty array when no ids are provided', async () => {
    const result = await loadEntityOptions('property', []);
    expect(result).toEqual([]);
    expect(bulkGet.properties).not.toHaveBeenCalled();
  });

  it('deduplicates ids and filters out non-finite values before querying', async () => {
    bulkGet.properties.mockResolvedValue([{ id: 1, name: 'Appart Gambetta' }]);
    await loadEntityOptions('property', [1, 1, NaN]);
    expect(bulkGet.properties).toHaveBeenCalledWith([1]);
  });

  it('builds property options and sorts them alphabetically (fr)', async () => {
    bulkGet.properties.mockResolvedValue([
      { id: 2, name: 'Studio Belleville' },
      { id: 1, name: 'Appart Gambetta' },
    ]);
    const result = await loadEntityOptions('property', [2, 1]);
    expect(result).toEqual([
      { id: 1, label: 'Appart Gambetta' },
      { id: 2, label: 'Studio Belleville' },
    ]);
  });

  it('falls back to a synthetic label when a property has no name', async () => {
    bulkGet.properties.mockResolvedValue([{ id: 3, name: '' }]);
    const result = await loadEntityOptions('property', [3]);
    expect(result).toEqual([{ id: 3, label: 'Bien #3' }]);
  });

  it('skips unknown ids (undefined entries returned by bulkGet)', async () => {
    bulkGet.tenants.mockResolvedValue([undefined, { id: 5, firstName: 'Jean', lastName: 'Dupont' }]);
    const result = await loadEntityOptions('tenant', [4, 5]);
    expect(result).toEqual([{ id: 5, label: 'Jean Dupont' }]);
  });

  it('labels leases with their related property name', async () => {
    bulkGet.leases.mockResolvedValue([{ id: 42, propertyId: 1 }]);
    bulkGet.properties.mockResolvedValue([{ id: 1, name: 'Appart Gambetta' }]);
    const result = await loadEntityOptions('lease', [42]);
    expect(result).toEqual([{ id: 42, label: 'Bail #42 — Appart Gambetta' }]);
  });

  it('labels leases without a property name gracefully', async () => {
    bulkGet.leases.mockResolvedValue([{ id: 42, propertyId: 99 }]);
    bulkGet.properties.mockResolvedValue([undefined]);
    const result = await loadEntityOptions('lease', [42]);
    expect(result).toEqual([{ id: 42, label: 'Bail #42' }]);
  });

  it('labels rents with a formatted month/year period', async () => {
    bulkGet.rents.mockResolvedValue([{ id: 7, dueDate: new Date('2026-03-05') }]);
    const result = await loadEntityOptions('rent', [7]);
    expect(result[0].id).toBe(7);
    expect(result[0].label).toMatch(/^Loyer #7 — /);
  });

  it('labels inventories by type (checkin/checkout)', async () => {
    bulkGet.inventories.mockResolvedValue([
      { id: 1, type: 'checkin', date: new Date('2026-01-01') },
      { id: 2, type: 'checkout', date: new Date('2026-06-01') },
    ]);
    const result = await loadEntityOptions('inventory', [1, 2]);
    const labels = result.map(o => o.label);
    expect(labels.some(l => l.startsWith("État des lieux d'entrée"))).toBe(true);
    expect(labels.some(l => l.startsWith('État des lieux de sortie'))).toBe(true);
  });
});
