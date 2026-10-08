/**
 * Narrow the key returned by a Dexie `add()` (typed `number | undefined` for
 * auto-incremented tables) to a number in tests.
 */
export function requireId(id: number | undefined): number {
  if (typeof id !== 'number') throw new Error('Expected an auto-generated numeric id');
  return id;
}
