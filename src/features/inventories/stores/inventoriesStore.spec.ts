import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useInventoriesStore } from './inventoriesStore';
import type { Inventory } from '@/db/types';

vi.mock('../repositories/inventoriesRepository', () => ({
  fetchAllInventories: vi.fn(),
  fetchInventoryById: vi.fn(),
  createInventory: vi.fn(),
  updateInventory: vi.fn(),
  deleteInventory: vi.fn(),
}));

import {
  fetchAllInventories,
  fetchInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
} from '../repositories/inventoriesRepository';

describe('inventoriesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('initialise un etat vide', () => {
    const store = useInventoriesStore();
    expect(store.inventories).toEqual([]);
    expect(store.currentInventory).toBeNull();
    expect(store.isLoading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('filtre les inventaires checkin/checkout', () => {
    const store = useInventoriesStore();
    store.inventories = [
      { id: 1, type: 'checkin' } as Inventory,
      { id: 2, type: 'checkout' } as Inventory,
      { id: 3, type: 'checkin' } as Inventory,
    ];

    expect(store.checkInInventories).toHaveLength(2);
    expect(store.checkOutInventories).toHaveLength(1);
  });

  it('filtre par bail', () => {
    const store = useInventoriesStore();
    store.inventories = [
      { id: 1, leaseId: 10 } as Inventory,
      { id: 2, leaseId: 11 } as Inventory,
      { id: 3, leaseId: 10 } as Inventory,
    ];

    expect(store.getInventoriesByLease(10)).toHaveLength(2);
  });

  it('charge la liste', async () => {
    const mockInventories = [{ id: 1 } as Inventory, { id: 2 } as Inventory];
    vi.mocked(fetchAllInventories).mockResolvedValue(mockInventories);

    const store = useInventoriesStore();
    await store.fetchInventories();

    expect(fetchAllInventories).toHaveBeenCalled();
    expect(store.inventories).toHaveLength(2);
  });

  it('charge par id', async () => {
    const inv = { id: 1 } as Inventory;
    vi.mocked(fetchInventoryById).mockResolvedValue(inv);

    const store = useInventoriesStore();
    await store.fetchInventoryById(1);

    expect(fetchInventoryById).toHaveBeenCalledWith(1);
    expect(store.currentInventory).toEqual(inv);
    expect(store.error).toBeNull();
  });

  it("signale 'Inventory not found' si absent", async () => {
    vi.mocked(fetchInventoryById).mockResolvedValue(undefined);

    const store = useInventoriesStore();
    await store.fetchInventoryById(123);

    expect(store.currentInventory).toBeNull();
    expect(store.error).toBe('Inventory not found');
  });

  it('cree puis rafraichit', async () => {
    vi.mocked(createInventory).mockResolvedValue(42);
    vi.mocked(fetchAllInventories).mockResolvedValue([]);

    const store = useInventoriesStore();
    const id = await store.createInventory({} as any);

    expect(id).toBe(42);
    expect(createInventory).toHaveBeenCalled();
    expect(fetchAllInventories).toHaveBeenCalled();
  });

  it('met a jour et rafraichit', async () => {
    vi.mocked(updateInventory).mockResolvedValue(1);
    vi.mocked(fetchAllInventories).mockResolvedValue([]);
    vi.mocked(fetchInventoryById).mockResolvedValue({ id: 1 } as Inventory);

    const store = useInventoriesStore();
    store.currentInventory = { id: 1 } as any;

    await store.updateInventory(1, { observations: 'x' } as any);

    expect(updateInventory).toHaveBeenCalledWith(1, expect.objectContaining({ observations: 'x' }));
    expect(fetchAllInventories).toHaveBeenCalled();
    expect(fetchInventoryById).toHaveBeenCalledWith(1);
  });

  it('supprime et rafraichit', async () => {
    vi.mocked(deleteInventory).mockResolvedValue(undefined);
    vi.mocked(fetchAllInventories).mockResolvedValue([]);

    const store = useInventoriesStore();
    store.currentInventory = { id: 1 } as any;

    await store.deleteInventory(1);

    expect(deleteInventory).toHaveBeenCalledWith(1);
    expect(fetchAllInventories).toHaveBeenCalled();
    expect(store.currentInventory).toBeNull();
  });

  it('clearError remet error a null', () => {
    const store = useInventoriesStore();
    store.error = 'boom';
    store.clearError();
    expect(store.error).toBeNull();
  });
});
