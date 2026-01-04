import type { Tenant } from '@/db/types';

export type TenantStatusConfig = {
  label: string;
  color: 'success' | 'accent' | 'error' | 'default';
};

export function computeTenantAge(birthDate: unknown, now = new Date()): number | null {
  if (!birthDate) return null;
  const birth = birthDate instanceof Date ? birthDate : new Date(birthDate as any);
  if (Number.isNaN(birth.getTime())) return null;

  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years--;
  return years;
}

export function getTenantStatusConfig(
  status: Tenant['status'] | undefined | null
): TenantStatusConfig {
  switch (status) {
    case 'active':
      return { label: 'Actif', color: 'success' };
    case 'candidate':
      return { label: 'Candidat', color: 'accent' };
    case 'candidature-refusee':
      return { label: 'Candidature refusée', color: 'error' };
    case 'former':
      return { label: 'Ancien', color: 'error' };
    default:
      return { label: 'Inconnu', color: 'default' };
  }
}

export function resolveTenantStatusTransition(status: Tenant['status'] | 'validated' | 'refused'): {
  newStatus: Tenant['status'];
  auditAction: 'validated' | 'refused' | 'updated';
} {
  if (status === 'validated') return { newStatus: 'active', auditAction: 'validated' };
  if (status === 'refused') return { newStatus: 'candidature-refusee', auditAction: 'refused' };
  return { newStatus: status, auditAction: 'updated' };
}
