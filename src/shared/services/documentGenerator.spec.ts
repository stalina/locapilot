import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/db/database';
import type { Tenant, Lease, Property, Rent, ChargesAdjustmentRow } from '@/db/types';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import {
  resolveTenantsInfo,
  prepareMandatLocationData,
  prepareKeyHandoverAttestationData,
  prepareRentReceiptData,
  prepareRegulationLetterData,
  prepareEtatDesLieuxData,
  prepareDepositReceptionData,
  prepareDepositRestitutionData,
  generateRegulationLetter,
  generateRentReceipt,
  type RegulationLetterData,
  type RentReceiptData,
} from './documentGenerator';
import type { Inventory } from '@/db/types';

// `pizzip` and `docxtemplater` are loaded lazily (dynamic `import()`) inside the
// generation functions so they are code-split out of the initial bundle. Mock
// both so we can assert the dynamic-import render path is exercised without
// touching a real .docx template.
vi.mock('pizzip', () => ({
  __esModule: true,
  // Regular function so it can be called with `new` inside renderDocxTemplate.
  default: vi.fn(function () {
    return {};
  }),
}));
vi.mock('docxtemplater', () => ({
  __esModule: true,
  default: vi.fn(function () {
    return {
      render: vi.fn(),
      getZip: () => ({
        generate: () =>
          new Blob(['docx'], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
      }),
    };
  }),
}));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

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

  it('prepareEtatDesLieuxData maps rooms, conditions, parties and signature', async () => {
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

    const inventory: Inventory = {
      leaseId,
      type: 'checkin',
      date: new Date('2026-01-02'),
      observations: 'RAS',
      rooms: [
        {
          name: 'Cuisine + séjour',
          items: [
            { label: 'Murs', condition: 'good', notes: 'Propre' },
            { label: 'Évier', condition: 'damaged' },
          ],
        },
      ],
      signature: { landlordAccepted: true, tenantAccepted: false, acceptedAt: now },
    };

    const data = await prepareEtatDesLieuxData(inventory);

    expect(data.kindLabel).toBe('ENTRANT');
    expect(data.number).toBe('20260102');
    expect(data.tenantFullNames).toBe('M. Dupont Jean et Mme Martin Marie');
    expect(data.propertyType).toBe('Studio');
    expect(data.propertyAddress).toContain('Studio Belleville');
    expect(data.rooms).toHaveLength(1);
    expect(data.rooms[0]!.items[0]).toEqual({
      label: 'Murs',
      condition: 'Bon état',
      notes: 'Propre',
    });
    expect(data.rooms[0]!.items[1]).toEqual({ label: 'Évier', condition: 'Détérioré', notes: '' });
    expect(data.landlordAccepted).toBe('Oui');
    expect(data.tenantAccepted).toBe('Non');
    expect(data.hasAcceptedAt).toBe(true);
    expect(data.observations).toBe('RAS');
  });

  it('prepareEtatDesLieuxData uses SORTANT for a check-out inventory', async () => {
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

    const data = await prepareEtatDesLieuxData({
      leaseId,
      type: 'checkout',
      date: new Date('2026-12-31'),
    } as Inventory);

    expect(data.kindLabel).toBe('SORTANT');
    expect(data.rooms).toEqual([]);
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

  it('prepareDepositReceptionData computes the total received and lists co-tenants', async () => {
    const propertyId = await seedProperty();
    const tenantIds = await seedTwoTenants();
    const leaseId = (await db.leases.add({
      propertyId,
      tenantIds,
      startDate: new Date('2026-01-01'),
      rent: 750,
      charges: 80,
      deposit: 750,
      depositReceivedDate: new Date('2026-01-03'),
      paymentDay: 5,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as Lease)) as number;

    const data = await prepareDepositReceptionData(leaseId);
    expect(data.tenantFullName).toBe('M. Dupont Jean et Mme Martin Marie');
    expect(data.propertyName).toBe('Studio Belleville');
    expect(data.depositAmount).toBe('750');
    expect(data.firstMonthRent).toBe('750');
    expect(data.charges).toBe('80');
    // total = deposit + rent + charges = 1580 (fr-FR uses a narrow no-break space)
    expect(data.totalReceived.replace(/\s/g, ' ')).toBe('1 580');
    expect(data.totalReceivedInLetterUppercase).toContain('EURO');
    expect(data.receptionDate).toBe('03/01/2026');
  });

  it('prepareDepositReceptionData works for a single tenant', async () => {
    const propertyId = await seedProperty();
    const tenantId = (await db.tenants.add(
      makeTenant({ civility: 'mr', firstName: 'Jean', lastName: 'Dupont' })
    )) as number;
    const leaseId = (await db.leases.add({
      propertyId,
      tenantIds: [tenantId],
      startDate: new Date('2026-01-01'),
      rent: 750,
      charges: 0,
      deposit: 750,
      depositReceivedDate: new Date('2026-01-03'),
      paymentDay: 5,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as Lease)) as number;

    const data = await prepareDepositReceptionData(leaseId);
    expect(data.tenantFullName).toBe('M. Dupont Jean');
    expect(data.totalReceived.replace(/\s/g, ' ')).toBe('1 500');
  });

  it('prepareDepositRestitutionData computes deductions for a partial restitution', async () => {
    const propertyId = await seedProperty();
    const tenantIds = await seedTwoTenants();
    const leaseId = (await db.leases.add({
      propertyId,
      tenantIds,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      rent: 750,
      charges: 80,
      deposit: 750,
      depositReceivedDate: new Date('2026-01-03'),
      depositReturnedDate: new Date('2027-01-15'),
      depositReturnedAmount: 600,
      paymentDay: 5,
      status: 'ended',
      createdAt: now,
      updatedAt: now,
    } as Lease)) as number;

    const data = await prepareDepositRestitutionData(leaseId);
    expect(data.tenantFullName).toBe('M. Dupont Jean et Mme Martin Marie');
    expect(data.originalDeposit).toBe('750');
    expect(data.returnedAmount).toBe('600');
    expect(data.deductions).toBe('150');
    expect(data.restitutionDate).toBe('15/01/2027');
  });

  it('prepareDepositRestitutionData reports no deductions for a full restitution', async () => {
    const propertyId = await seedProperty();
    const tenantIds = await seedTwoTenants();
    const leaseId = (await db.leases.add({
      propertyId,
      tenantIds,
      startDate: new Date('2026-01-01'),
      rent: 750,
      charges: 80,
      deposit: 750,
      depositReceivedDate: new Date('2026-01-03'),
      depositReturnedDate: new Date('2027-01-15'),
      depositReturnedAmount: 750,
      paymentDay: 5,
      status: 'ended',
      createdAt: now,
      updatedAt: now,
    } as Lease)) as number;

    const data = await prepareDepositRestitutionData(leaseId);
    expect(data.returnedAmount).toBe('750');
    expect(data.deductions).toBe('0');
  });
});

describe('typed entity access with missing optional fields', () => {
  // Documents spec (documents.md): "Missing optional entity fields fall back to
  // empty values" — a property without postalCode/town must render empty strings,
  // not throw, now that fields are read through the typed Property entity.
  async function seedPropertyWithoutLocation(): Promise<number> {
    return (await db.properties.add({
      name: 'Local sans localité',
      address: '9 impasse des Tests',
      // postalCode and town intentionally omitted (both optional on Property)
      type: 'other',
      surface: 40,
      rooms: 2,
      rent: 600,
      status: 'vacant',
      createdAt: now,
      updatedAt: now,
    } as Property)) as number;
  }

  async function seedOneTenant(): Promise<number> {
    return (await db.tenants.add(
      makeTenant({ firstName: 'Paul', lastName: 'Durand', email: 'paul@x.fr', phone: '0303' })
    )) as number;
  }

  it('prepareMandatLocationData renders empty strings for a property with no postalCode/town', async () => {
    const propertyId = await seedPropertyWithoutLocation();
    const tenantId = await seedOneTenant();
    const leaseId = (await db.leases.add({
      propertyId,
      tenantIds: [tenantId],
      startDate: new Date('2026-01-01'),
      rent: 600,
      charges: 0,
      deposit: 600,
      paymentDay: 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as Lease)) as number;

    const data = await prepareMandatLocationData(leaseId);
    expect(data.propertyName).toBe('Local sans localité');
    expect(data.propertyPostalCode).toBe('');
    expect(data.propertyTown).toBe('');
    // The document data still resolves without throwing.
    expect(data.tenantFullName).toBe('M. Durand Paul');
  });

  it('prepareKeyHandoverAttestationData renders empty strings for missing optional fields', async () => {
    const propertyId = await seedPropertyWithoutLocation();
    const tenantId = await seedOneTenant();
    const leaseId = (await db.leases.add({
      propertyId,
      tenantIds: [tenantId],
      startDate: new Date('2026-01-01'),
      rent: 600,
      charges: 0,
      deposit: 600,
      paymentDay: 1,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as Lease)) as number;

    const data = await prepareKeyHandoverAttestationData(leaseId);
    expect(data.propertyPostalCode).toBe('');
    expect(data.propertyTown).toBe('');
  });
});

describe('DOCX generation via lazily-loaded pizzip/docxtemplater', () => {
  const PizZipMock = vi.mocked(PizZip);
  const DocxtemplaterMock = vi.mocked(Docxtemplater);
  const saveAsMock = vi.mocked(saveAs);

  const regulationData: RegulationLetterData = {
    year: 2025,
    provisionPaid: 600,
    totalCharges: 690,
    regulation: 90,
    ownerAddress: '1 rue du Bailleur',
    ownerFullName: 'M. Bailleur',
    ownerEmail: 'owner@x.fr',
    ownerPhoneNumber: '0600000000',
    date: '13/07/2026',
    tenantFullName: 'M. Dupont Jean',
    tenantName: 'M. Dupont',
    propertyName: 'Studio Belleville',
    propertyAddress: '1 rue de Paris',
    propertyPostalCode: '75020',
    propertyTown: 'Paris',
  };

  const receiptData: RentReceiptData = {
    ownerFullName: 'M. Bailleur',
    ownerAddress: '1 rue du Bailleur',
    ownerAddressInLine: '1 rue du Bailleur',
    tenantFullName: 'M. Dupont Jean',
    propertyName: 'Studio Belleville',
    propertyAddress: '1 rue de Paris',
    propertyPostalCode: '75020',
    propertyTown: 'Paris',
    month: 'juin',
    year: 2026,
    totalPayedAmount: 850,
    totalPayedAmountInLetterUppercase: 'HUIT CENT CINQUANTE EUROS',
    rentAmount: 800,
    chargeAmount: 50,
    paymentDate: '03/06/2026',
    today: '13/07/2026',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // loadBinary() calls fetch(templatePath).arrayBuffer(); stub it so no real
    // template file is required.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }))
    );
  });

  it('generateRegulationLetter loads the libs on demand and returns a blob + filename', async () => {
    const { blob, filename } = await generateRegulationLetter(regulationData);

    // The dynamic import path constructed both libs exactly once.
    expect(PizZipMock).toHaveBeenCalledTimes(1);
    expect(DocxtemplaterMock).toHaveBeenCalledTimes(1);
    expect(blob).toBeInstanceOf(Blob);
    expect(filename).toMatch(/_courrierInfoRegulCharge\.docx$/);
  });

  it('generateRentReceipt loads the libs on demand and triggers a download', async () => {
    await generateRentReceipt(receiptData);

    expect(PizZipMock).toHaveBeenCalledTimes(1);
    expect(DocxtemplaterMock).toHaveBeenCalledTimes(1);
    // The generated blob is handed to file-saver for download.
    expect(saveAsMock).toHaveBeenCalledTimes(1);
    expect(saveAsMock.mock.calls[0]![0]).toBeInstanceOf(Blob);
    expect(saveAsMock.mock.calls[0]![1]).toMatch(/_quittanceLoyer\.docx$/);
  });

  it('propagates errors when template loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );

    await expect(generateRegulationLetter(regulationData)).rejects.toThrow('network down');
  });
});
