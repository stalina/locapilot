import { describe, expect, it } from 'vitest';
import {
  computeTenantAge,
  getTenantStatusConfig,
  resolveTenantStatusTransition,
} from './tenantsService';

describe('tenantsService', () => {
  it('computeTenantAge returns null when missing/invalid', () => {
    expect(computeTenantAge(undefined)).toBeNull();
    expect(computeTenantAge('not-a-date')).toBeNull();
  });

  it('computeTenantAge computes age with birthday adjustment', () => {
    const now = new Date('2026-01-04T12:00:00.000Z');
    expect(computeTenantAge('2000-01-05', now)).toBe(25);
    expect(computeTenantAge('2000-01-03', now)).toBe(26);
  });

  it('getTenantStatusConfig maps status to label/color', () => {
    expect(getTenantStatusConfig('active').label).toBe('Actif');
    expect(getTenantStatusConfig('candidate').label).toBe('Candidat');
    expect(getTenantStatusConfig('candidature-refusee').color).toBe('error');
    expect(getTenantStatusConfig(undefined).label).toBe('Inconnu');
  });

  it('resolveTenantStatusTransition maps validated/refused to target status and audit action', () => {
    expect(resolveTenantStatusTransition('validated')).toEqual({
      newStatus: 'active',
      auditAction: 'validated',
    });
    expect(resolveTenantStatusTransition('refused')).toEqual({
      newStatus: 'candidature-refusee',
      auditAction: 'refused',
    });
    expect(resolveTenantStatusTransition('active')).toEqual({
      newStatus: 'active',
      auditAction: 'updated',
    });
  });
});
