import { db } from '@/db/database';
import type { IrlIndex } from '@/db/types';

export async function fetchAllIrlIndices(): Promise<IrlIndex[]> {
  const indices = await db.irlIndices.toArray();
  // Tri décroissant : année puis trimestre
  return indices.sort((a, b) => b.year - a.year || b.quarter - a.quarter);
}

/**
 * Crée ou met à jour la valeur d'IRL pour un couple (année, trimestre) donné.
 * La contrainte d'unicité (année + trimestre) est garantie applicativement.
 */
export async function upsertIrlIndex(
  index: Pick<IrlIndex, 'year' | 'quarter' | 'value'>,
  now = new Date()
): Promise<IrlIndex | undefined> {
  const existing = await db.irlIndices
    .where('[year+quarter]')
    .equals([index.year, index.quarter])
    .first();

  if (existing?.id) {
    await db.irlIndices.update(existing.id, { value: index.value, updatedAt: now });
    return db.irlIndices.get(existing.id);
  }

  const id = await db.irlIndices.add({
    year: index.year,
    quarter: index.quarter,
    value: index.value,
    createdAt: now,
    updatedAt: now,
  } as IrlIndex);
  return db.irlIndices.get(id);
}

export async function deleteIrlIndex(id: number): Promise<void> {
  await db.irlIndices.delete(id);
}
