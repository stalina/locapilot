import { db } from '@/db/database';

export async function fetchSettingValue<T>(key: string): Promise<T | undefined> {
  const setting = await db.settings.where('key').equals(key).first();
  return setting ? (setting.value as T) : undefined;
}

export async function saveSettingValue(
  key: string,
  value: unknown,
  now = new Date()
): Promise<void> {
  try {
    // Fast path: simple put (many environments and tests expect this)
    await db.settings.put({ key, value, updatedAt: now } as any);
  } catch {
    // Fallback to explicit upsert (handles edge cases with unique index)
    const existing = await db.settings.where('key').equals(key).first();
    if (existing && (existing as any).id) {
      await db.settings.update((existing as any).id, { value, updatedAt: now } as any);
    } else {
      await db.settings.add({ key, value, updatedAt: now } as any);
    }
  }
}
