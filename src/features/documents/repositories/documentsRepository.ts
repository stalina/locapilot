import { db } from '@/db/database';
import type { Document } from '@/db/types';

export async function fetchAllDocuments(): Promise<Document[]> {
  return db.documents.toArray();
}

export async function fetchDocumentById(id: number): Promise<Document | undefined> {
  return db.documents.get(id);
}

export async function createDocument(data: Omit<Document, 'id'>): Promise<Document | null> {
  const id = (await db.documents.add(data as any)) as number;
  const created = await db.documents.get(id);
  return created ?? null;
}

export async function updateDocument(
  id: number,
  updates: Partial<Omit<Document, 'id' | 'createdAt' | 'data'>>
): Promise<number> {
  return db.documents.update(id, updates as any);
}

export async function deleteDocument(id: number): Promise<void> {
  await db.documents.delete(id);
}
