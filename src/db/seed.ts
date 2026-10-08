import { db } from './database';

export async function seedDemoData(): Promise<void> {
  // Check if already seeded
  const props = await db.properties.toArray();
  if (props.length > 0) return;

  const now = new Date();

  const propId = await db.properties.add({
    name: '12 Rue Victor Hugo',
    address: '12 Rue Victor Hugo',
    type: 'apartment',
    surface: 45,
    rooms: 2,
    rent: 1250,
    purchasePrice: 210000,
    acquisitionCosts: 16000,
    status: 'occupied',
    createdAt: now,
    updatedAt: now,
  });

  const tenantId = await db.tenants.add({
    firstName: 'Jean',
    lastName: 'Dupont',
    email: 'jean.dupont@example.com',
    phone: '+33600000000',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  const leaseId = await db.leases.add({
    propertyId: propId!,
    tenantIds: [tenantId!],
    startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    rent: 1250,
    charges: 50,
    deposit: 2500,
    paymentDay: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  await db.rents.bulkAdd([
    {
      leaseId: leaseId!,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 1),
      amount: 1250,
      charges: 50,
      status: 'paid',
      paidDate: new Date(now.getFullYear(), now.getMonth(), 1, 9),
      paidAmount: 1250,
      createdAt: now,
      updatedAt: now,
    },
    {
      leaseId: leaseId!,
      dueDate: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      amount: 1250,
      charges: 50,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.inventories.add({
    leaseId: leaseId!,
    type: 'checkin',
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
    createdAt: now,
    updatedAt: now,
  });

  await db.communications.add({
    relatedEntityType: 'lease',
    relatedEntityId: leaseId!,
    type: 'meeting',
    direction: 'outbound',
    subject: 'Visite appartement',
    content: 'Visite réalisée avec 3 candidats',
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 10, 0),
    createdAt: now,
  });

  await db.expenses.bulkAdd([
    {
      propertyId: propId!,
      category: 'property-tax',
      label: `Taxe foncière ${now.getFullYear()}`,
      amount: 1180,
      date: new Date(now.getFullYear(), 9, 15, 12),
      createdAt: now,
      updatedAt: now,
    },
    {
      propertyId: propId!,
      category: 'insurance',
      label: 'Assurance PNO',
      amount: 145.6,
      date: new Date(now.getFullYear(), 0, 10, 12),
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log('✅ Demo data seeded');
}
