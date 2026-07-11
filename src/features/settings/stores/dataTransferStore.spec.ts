import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDataTransferStore } from './dataTransferStore';

// The repository performs the destructive clear()+bulkAdd() transaction. It is
// mocked so we can assert whether it is ever reached for a given payload
// (issue #80, C2: it must NOT be reached when validation fails).
vi.mock('../repositories/dataTransferRepository', () => ({
  fetchRawExportData: vi.fn(),
  importBusinessData: vi.fn().mockResolvedValue(undefined),
  clearBusinessData: vi.fn(),
}));

import { importBusinessData } from '../repositories/dataTransferRepository';

const iso = '2026-01-01T00:00:00.000Z';

function validProperty(overrides: Record<string, unknown> = {}) {
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

function validTenant(overrides: Record<string, unknown> = {}) {
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

describe('dataTransferStore.importFromObject', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('imports a valid payload: repository called exactly once, no error', async () => {
    const store = useDataTransferStore();

    await store.importFromObject({
      properties: [validProperty()],
      tenants: [validTenant()],
      version: '1.0.0',
    });

    expect(importBusinessData).toHaveBeenCalledTimes(1);
    expect(store.error).toBeNull();
    // Missing optional tables are defaulted to empty arrays before the write.
    const arg = vi.mocked(importBusinessData).mock.calls[0][0];
    expect(arg.properties).toHaveLength(1);
    expect(arg.leases).toEqual([]);
    expect(arg.settings).toEqual([]);
  });

  it('rejects an invalid record: importBusinessData is NEVER called and error is set', async () => {
    const store = useDataTransferStore();

    await expect(
      store.importFromObject({
        // email as a number violates the tenant schema.
        properties: [validProperty()],
        tenants: [validTenant({ email: 12345 })],
        version: '1.0.0',
      })
    ).rejects.toThrow();

    expect(importBusinessData).not.toHaveBeenCalled();
    expect(store.error).toMatch(/tenants\.0\.email/);
  });

  it('rejects a payload with an unknown extra field before any DB mutation', async () => {
    const store = useDataTransferStore();

    await expect(
      store.importFromObject({
        properties: [validProperty({ hacked: true })],
        tenants: [],
        version: '1.0.0',
      })
    ).rejects.toThrow();

    expect(importBusinessData).not.toHaveBeenCalled();
    expect(store.error).not.toBeNull();
  });

  it('rejects a non-object payload (malformed P2P payload)', async () => {
    const store = useDataTransferStore();

    await expect(store.importFromObject('not-an-object')).rejects.toThrow(
      'Format de fichier invalide'
    );

    expect(importBusinessData).not.toHaveBeenCalled();
    expect(store.error).toBe('Format de fichier invalide');
  });
});
