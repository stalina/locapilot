import { db } from '@/db/database';

export type AddTenantAuditParams = {
  tenantId: number;
  action: 'validated' | 'refused' | 'created' | 'updated';
  actorId?: number | null;
  reason?: string;
  documentIds?: number[];
};

export async function addTenantAudit(audit: AddTenantAuditParams): Promise<number> {
  const id = await db.tenantAudits.add({
    tenantId: audit.tenantId,
    action: audit.action,
    actorId: audit.actorId ?? null,
    reason: audit.reason,
    documentIds: audit.documentIds || [],
    timestamp: new Date(),
  });

  return id as number;
}

export async function fetchLastRefusalReason(tenantId: number): Promise<string | null> {
  const audits = await db.tenantAudits.where({ tenantId, action: 'refused' }).sortBy('timestamp');
  if (!audits.length) return null;
  const last = audits[audits.length - 1];
  return last && typeof (last as any).reason === 'string' ? (last as any).reason || null : null;
}
