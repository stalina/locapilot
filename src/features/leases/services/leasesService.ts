import type { Lease } from '@/db/types';

export function buildTerminationUpdates(now = new Date()): Partial<Lease> {
  return {
    status: 'ended',
    endDate: now,
  };
}
