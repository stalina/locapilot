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

import { fetchRawExportData, importBusinessData } from '../repositories/dataTransferRepository';

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

function validDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'photo.jpg',
    type: 'photo',
    mimeType: 'image/jpeg',
    size: 0,
    data: null,
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
  };
}

function validExpense(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    propertyId: 1,
    category: 'works',
    label: 'Remplacement chaudière',
    amount: 2000,
    date: iso,
    createdAt: iso,
    updatedAt: iso,
    ...overrides,
  };
}

function validTenantDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tenantId: 1,
    name: 'cni.png',
    mimeType: 'image/png',
    size: 0,
    uploadedAt: iso,
    data: null,
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
    const arg = vi.mocked(importBusinessData).mock.calls[0]![0];
    expect(arg.properties).toHaveLength(1);
    expect(arg.leases).toEqual([]);
    expect(arg.settings).toEqual([]);
    // Legacy backup produced before the expenses module (issue #47).
    expect(arg.expenses).toEqual([]);
  });

  it('passes the validated expenses and their documents to the repository', async () => {
    const store = useDataTransferStore();

    await store.importFromObject({
      properties: [validProperty()],
      tenants: [],
      expenses: [validExpense(), validExpense({ id: 2, category: 'insurance', amount: 145.6 })],
      documents: [
        validDocument({ type: 'invoice', relatedEntityType: 'expense', relatedEntityId: 1 }),
      ],
      version: '1.2.0',
    });

    const arg = vi.mocked(importBusinessData).mock.calls[0]![0];
    expect(arg.expenses).toHaveLength(2);
    expect(arg.documents?.[0]).toMatchObject({ relatedEntityType: 'expense', relatedEntityId: 1 });
  });

  it('rejects an invalid expense before any DB mutation', async () => {
    const store = useDataTransferStore();

    await expect(
      store.importFromObject({
        properties: [validProperty()],
        tenants: [],
        expenses: [validExpense({ amount: -10 })],
        version: '1.2.0',
      })
    ).rejects.toThrow(/expenses\.0\.amount/);

    expect(importBusinessData).not.toHaveBeenCalled();
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

  // Issue #122: P2P documents arrive as reassembled Blobs.
  it('imports documents whose data is a Blob, keeping the Blob', async () => {
    const store = useDataTransferStore();
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' });
    const tenantBlob = new Blob([new Uint8Array([9])], { type: 'image/png' });

    await store.importFromObject({
      properties: [validProperty()],
      tenants: [validTenant()],
      documents: [validDocument({ data: blob })],
      tenantDocuments: [validTenantDocument({ data: tenantBlob })],
      version: '1.2.0',
    });

    expect(importBusinessData).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(importBusinessData).mock.calls[0]![0];
    const [doc] = arg.documents as Array<Record<string, unknown>>;
    const [tenantDoc] = arg.tenantDocuments as Array<Record<string, unknown>>;
    expect(doc?.data).toBe(blob);
    expect(doc?.size).toBe(3);
    expect(doc?.mimeType).toBe('image/jpeg');
    expect(tenantDoc?.data).toBe(tenantBlob);
  });

  it('leaves the DB untouched when a Blob payload fails validation', async () => {
    const store = useDataTransferStore();

    await expect(
      store.importFromObject({
        properties: [validProperty()],
        tenants: [],
        // Leftover protocol field → strict schema rejects the whole payload.
        documents: [validDocument({ data: new Blob([new Uint8Array(1)]), blobRef: {} })],
        version: '1.2.0',
      })
    ).rejects.toThrow(/documents\.0/);

    expect(importBusinessData).not.toHaveBeenCalled();
  });
});

describe('dataTransferStore.buildSyncSource', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('returns the raw tables with Blobs untouched (no serialization) and the totals', async () => {
    const blob = new Blob([new Uint8Array(100)], { type: 'image/jpeg' });
    const tenantBlob = new Blob([new Uint8Array(20)], { type: 'image/png' });
    const raw = {
      properties: [validProperty()],
      tenants: [validTenant()],
      leases: [],
      rents: [],
      documents: [validDocument({ data: blob })],
      tenantDocuments: [validTenantDocument({ data: tenantBlob })],
      tenantAudits: [],
      inventories: [],
      communications: [],
      chargesAdjustments: [],
      irlIndices: [],
      rentRevisions: [],
      reminders: [],
      expenses: [validExpense()],
      settings: [],
    };
    vi.mocked(fetchRawExportData).mockResolvedValue(
      raw as unknown as Awaited<ReturnType<typeof fetchRawExportData>>
    );
    const store = useDataTransferStore();

    const source = await store.buildSyncSource('1.2.0');

    expect(source.appVersion).toBe('1.2.0');
    expect(source.tables.documents[0]).toBe(raw.documents[0]);
    expect((source.tables.documents[0] as { data: unknown }).data).toBe(blob);
    expect(source.counts.properties).toBe(1);
    expect(source.counts.documents).toBe(1);
    expect(source.tables.expenses).toBe(raw.expenses);
    expect(source.counts.expenses).toBe(1);
    expect(source.documents).toBe(2);
    expect(source.totalBytes).toBe(120);
  });
});
