import { db } from '@/db/database';
import type { Tenant } from '@/db/types';

export async function fetchAllTenants(): Promise<Tenant[]> {
  return db.tenants.toArray();
}

export async function fetchTenantById(id: number): Promise<Tenant | undefined> {
  return db.tenants.get(id);
}

export async function createTenant(
  data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const id = await db.tenants.add({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id as number;
}

export async function updateTenant(
  id: number,
  data: Partial<Omit<Tenant, 'id' | 'createdAt'>>
): Promise<void> {
  await db.tenants.update(id, {
    ...data,
    updatedAt: new Date(),
  });
}

export async function deleteTenant(id: number): Promise<void> {
  await db.tenants.delete(id);
}

export async function updateTenantStatus(id: number, status: Tenant['status']): Promise<void> {
  await db.tenants.update(id, { status, updatedAt: new Date() });
}
