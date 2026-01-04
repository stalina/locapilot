import { db } from '@/db/database';
import type { Document, TenantDocument } from '@/db/types';

export async function listTenantDocuments(tenantId: number): Promise<TenantDocument[]> {
  return db.tenantDocuments.where({ tenantId }).sortBy('uploadedAt');
}

export async function addTenantDocument(params: {
  tenantId: number;
  file: File;
  notes?: string;
}): Promise<TenantDocument | null> {
  const now = new Date();

  return db.transaction('rw', [db.documents, db.tenantDocuments], async () => {
    const globalDoc: Omit<Document, 'id'> = {
      name: params.file.name,
      type: 'other',
      relatedEntityType: 'tenant',
      relatedEntityId: params.tenantId,
      mimeType: params.file.type,
      size: params.file.size,
      data: params.file.slice(),
      description: params.notes,
      createdAt: now,
      updatedAt: now,
    };

    const globalId = (await db.documents.add(globalDoc as any)) as number;

    const tenantDoc: Omit<TenantDocument, 'id'> = {
      tenantId: params.tenantId,
      name: params.file.name,
      mimeType: params.file.type,
      size: params.file.size,
      data: params.file.slice(),
      notes: params.notes,
      uploadedAt: now,
      documentId: globalId,
    };

    const id = (await db.tenantDocuments.add(tenantDoc as TenantDocument)) as number;
    const created = await db.tenantDocuments.get(id);
    return created || null;
  });
}

export async function removeTenantDocument(id: number): Promise<void> {
  await db.transaction('rw', [db.documents, db.tenantDocuments], async () => {
    const td = await db.tenantDocuments.get(id);
    if (td?.documentId) {
      await db.documents.delete(td.documentId);
    }
    await db.tenantDocuments.delete(id);
  });
}
