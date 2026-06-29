import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/database';
import type { Tenant, Lease, Property, Rent, ChargesAdjustmentRow } from '@/db/types';
import {
  resolveTenantsInfo,
  prepareMandatLocationData,
  prepareKeyHandoverAttestationData,
  prepareRentReceiptData,
  prepareRegulationLetterData,
} from './documentGenerator';

const now = new Date('2026-06-29T10:00:00.000Z');

function makeTenant(overrides: Partial<Tenant>): Tenant {
  return {
    civility: 'mr',
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean@example.com',
    phone: '0102030405',
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function clearAll() {
  await Promise.all([
    db.tenants.clear(),
    db.leases.clear(),
    db.properties.clear(),
    db.rents.clear(),
    db.chargesAdjustments.clear(),
  ]);
}

beforeEach(async () => {
  await clearAll();
});

describe('resolveTenantsInfo', () => {
  it('returns empty strings when tenantIds is undefined or empty', async () => {
    expect(await resolveTenantsInfo(undefined)).toEqual({
      fullNames: '',
      names: '',
      emails: '',
      phoneNumbers: '',
    });
    expect(await resolveTenantsInfo([])).toEqual({
      fullNames: '',
      names: '',
      emails: '',
      phoneNumbers: '',
    });
  });

  it('resolves a single tenant with civility prefix', async () => {
    const id = (await db.tenants.add(
      makeTenant({
        civility: 'mme',
        firstName: 'Marie',
        lastName: 'Martin',
        email: 'm@x.fr',
        phone: '0600',
      })
    )) as number;

    const info = await resolveTenantsInfo([id]);
    expect(info.fullNames).toBe('Mme Martin Marie');
    expect(info.names).toBe('Mme Martin');
    expect(info.emails).toBe('m@x.fr');
    expect(info.phoneNumbers).toBe('0600');
  });

  it('aggregates two tenants joined with " et "', async () => {
    const id1 = (await db.tenants.add(
      makeTenant({
        civility: 'mr',
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@x.fr',
        phone: '0101',
      })
    )) as number;
    const id2 = (await db.tenants.add(
      makeTenant({
        civility: 'mme',
        firstName: 'Marie',
        lastName: 'Martin',
        email: 'marie@x.fr',
        phone: '0202',
      })
    )) as number;

    const info = await resolveTenantsInfo([id1, id2]);
    expect(info.fullNames).toBe('M. Dupont Jean et Mme Martin Marie');
    expect(info.names).toBe('M. Dupont et Mme Martin');
    expect(info.emails).toBe('jean@x.fr, marie@x.fr');
    expect(info.phoneNumbers).toBe('0101, 0202');
  });

  it('joins three or more tenants with commas and a final " et "', async () => {
    const ids = (await Promise.all([
      db.tenants.add(makeTenant({ lastName: 'A', civility: undefined, email: '', phone: '' })),
      db.tenants.add(makeTenant({ lastName: 'B', civility: undefined, email: '', phone: '' })),
      db.tenants.add(makeTenant({ lastName: 'C', civility: undefined, email: '', phone: '' })),
    ])) as number[];

    const info = await resolveTenantsInfo(ids);
    // firstName defaults to "Jean" for each
    expect(info.names).toBe('A, B et C');
    expect(info.emails).toBe('');
    expect(info.phoneNumbers).toBe('');
  });

  it('skips missing tenants and tenants without email/phone', async () => {
    const id1 = (await db.tenants.add(
      makeTenant({ lastName: 'Dupont', email: 'jean@x.fr', phone: '' })
    )) as number;

    const info = await resolveTenantsInfo([id1, 99999]);
    expect(info.fullNames).toBe('M. Dupont Jean');
    expect(info.emails).toBe('jean@x.fr');
    expect(info.phoneNumbers).toBe('');
  });
});

describe('prepare*Data with multiple tenants', () => {
  async function seedProperty(): Promise<number> {
    return (await db.properties.add({
      name: 'Studio Belleville',
      address: '1 rue de Paris',
      postalCode: '75020',
      town: 'Paris',
      type: 'studio',
      surface: 25,
      rooms: 1,
      rent: 800,
      status: 'occupied',
      createdAt: now,
      updatedAt: now,
    } as Property)) as number;
  }

  async function seedTwoTenants(): Promise<number[]> {
    const id1 = (await db.tenants.add(
      makeTenant({
        civility: 'mr',
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@x.fr',
        phone: '0101',
      })
    )) as number;
    const id2 = (await db.tenants.add(
      makeTenant({
        civility: 'mme',
        firstName: 'Marie',
        lastName: 'Martin',
        email: 'marie@x.fr',
        phone: '0202',
      })
    )) as number;
    return [id1, id2];
  }

  it('prepareMandatLocationData lists both tenants names, emails and phones', async () => {
    const propertyId = await seedProperty();
    const tenantIds = await seedTwoTenants();
    const leaseId = (await db.leases.add({
      propertyId,
      tenantIds,
      startDate: new Date('2026-01-01'),
      rent: 800,
      charges: 50,
      deposit: 800,
      paymentDay: 5,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as Lease)) as number;

    const data = await prepareMandatLocationData(leaseId);
    expect(data.tenantFullName).toBe('M. Dupont Jean et Mme Martin Marie');
    expect(data.tenantEmail).toBe('jean@x.fr, marie@x.fr');
    expect(data.tenantPhoneNumber).toBe('0101, 0202');
  });

  it('prepareKeyHandoverAttestationData lists both tenants', async () => {
    const propertyId = await seedProperty();
    const tenantIds = await seedTwoTenants();
    const leaseId = (await db.leases.add({
      propertyId,
      tenantIds,
      startDate: new Date('2026-01-01'),
      rent: 800,
      charges: 50,
      deposit: 800,
      paymentDay: 5,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as Lease)) as number;

    const data = await prepareKeyHandoverAttestationData(leaseId);
    expect(data.tenantFullName).toBe('M. Dupont Jean et Mme Martin Marie');
  });

  it('prepareRentReceiptData lists both tenants', async () => {
    const propertyId = await seedProperty();
    const tenantIds = await seedTwoTenants();
    const leaseId = (await db.leases.add({
      propertyId,
      tenantIds,
      startDate: new Date('2026-01-01'),
      rent: 800,
      charges: 50,
      deposit: 800,
      paymentDay: 5,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as Lease)) as number;
    const rentId = (await db.rents.add({
      leaseId,
      dueDate: new Date('2026-06-05'),
      amount: 800,
      charges: 50,
      paidAmount: 850,
      paidDate: new Date('2026-06-03'),
      status: 'paid',
      createdAt: now,
      updatedAt: now,
    } as Rent)) as number;

    const data = await prepareRentReceiptData(rentId);
    expect(data.tenantFullName).toBe('M. Dupont Jean et Mme Martin Marie');
  });

  it('prepareRegulationLetterData lists both tenants names and short names', async () => {
    const propertyId = await seedProperty();
    const tenantIds = await seedTwoTenants();
    const leaseId = (await db.leases.add({
      propertyId,
      tenantIds,
      startDate: new Date('2026-01-01'),
      rent: 800,
      charges: 50,
      deposit: 800,
      paymentDay: 5,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as Lease)) as number;
    const adjustmentRow: ChargesAdjustmentRow = {
      id: 1,
      leaseId,
      year: 2025,
      monthlyRent: 800,
      chargesProvisionPaid: 600,
      rentsPaidCount: 12,
      rentsPaidTotal: 10200,
      createdAt: now,
      updatedAt: now,
    };

    const data = await prepareRegulationLetterData(
      adjustmentRow,
      () => 690,
      () => 90
    );
    expect(data.tenantFullName).toBe('M. Dupont Jean et Mme Martin Marie');
    expect(data.tenantName).toBe('M. Dupont et Mme Martin');
  });
});
