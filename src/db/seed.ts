import { db } from './schema';
import type { Property, Tenant, Lease, Rent } from './schema';

/**
 * Seed the database with sample data for development
 */
export async function seedDatabase(): Promise<void> {
  console.log('🌱 Starting database seeding...');

  try {
    // Check if data already exists
    const existingProperties = await db.properties.count();
    if (existingProperties > 0) {
      console.log('⚠️  Database already seeded. Skipping...');
      return;
    }

    // Seed properties
    const properties: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: '123 Rue de la Paix',
        address: '123 Rue de la Paix, 75002 Paris',
        type: 'apartment',
        surface: 85,
        rooms: 4,
        rent: 1250,
        charges: 150,
        status: 'occupied',
        description: 'Bel appartement lumineux avec balcon, proche des commerces',
      },
      {
        name: '45 Avenue Mozart',
        address: '45 Avenue Mozart, 75016 Paris',
        type: 'apartment',
        surface: 120,
        rooms: 5,
        rent: 2100,
        charges: 200,
        status: 'occupied',
        description: 'Grand appartement familial avec vue dégagée',
      },
      {
        name: '78 Boulevard Haussmann',
        address: '78 Boulevard Haussmann, 75008 Paris',
        type: 'apartment',
        surface: 65,
        rooms: 3,
        rent: 1500,
        charges: 100,
        status: 'vacant',
        description: 'Studio moderne entièrement rénové',
      },
      {
        name: '12 Rue Victor Hugo',
        address: '12 Rue Victor Hugo, 92100 Boulogne',
        type: 'house',
        surface: 150,
        rooms: 6,
        rent: 2800,
        charges: 250,
        status: 'vacant',
        description: 'Maison avec jardin et garage',
      },
      {
        name: '89 Avenue de la République',
        address: '89 Avenue de la République, 75011 Paris',
        type: 'apartment',
        surface: 75,
        rooms: 3,
        rent: 1350,
        charges: 120,
        status: 'occupied',
        description: 'Appartement calme dans résidence sécurisée',
      },
    ];

    const propertyIds: number[] = [];
    for (const property of properties) {
      const id = await db.properties.add({
        ...property,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      propertyIds.push(id as number);
    }
    console.log(`✅ Created ${propertyIds.length} properties`);

    // Seed tenants
    const tenants: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@example.com',
        phone: '+33 6 12 34 56 78',
        birthDate: new Date('1985-05-15'),
        status: 'active',
      },
      {
        firstName: 'Marie',
        lastName: 'Martin',
        email: 'marie.martin@example.com',
        phone: '+33 6 23 45 67 89',
        birthDate: new Date('1990-08-20'),
        status: 'active',
      },
      {
        firstName: 'Sophie',
        lastName: 'Bernard',
        email: 'sophie.bernard@example.com',
        phone: '+33 6 34 56 78 90',
        birthDate: new Date('1988-03-10'),
        status: 'active',
      },
    ];

    const tenantIds: number[] = [];
    for (const tenant of tenants) {
      const id = await db.tenants.add({
        ...tenant,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      tenantIds.push(id as number);
    }
    console.log(`✅ Created ${tenantIds.length} tenants`);

    // Seed leases (only for rented properties)
    const leases: Omit<Lease, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        propertyId: propertyIds[0]!, // 123 Rue de la Paix
        tenantIds: [tenantIds[0]!], // Jean Dupont
        startDate: new Date('2023-01-01'),
        endDate: new Date('2024-12-31'),
        rent: 1250,
        charges: 150,
        deposit: 2500,
        paymentDay: 1,
        status: 'active',
      },
      {
        propertyId: propertyIds[1]!, // 45 Avenue Mozart
        tenantIds: [tenantIds[1]!], // Marie Martin
        startDate: new Date('2023-06-01'),
        endDate: new Date('2026-05-31'),
        rent: 2100,
        charges: 200,
        deposit: 4200,
        paymentDay: 1,
        status: 'active',
      },
      {
        propertyId: propertyIds[4]!, // 89 Avenue de la République
        tenantIds: [tenantIds[2]!], // Sophie Bernard
        startDate: new Date('2023-09-01'),
        endDate: new Date('2024-08-31'),
        rent: 1350,
        charges: 120,
        deposit: 2700,
        paymentDay: 1,
        status: 'active',
      },
    ];

    const leaseIds: number[] = [];
    for (const lease of leases) {
      const id = await db.leases.add({
        ...lease,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      leaseIds.push(id as number);
    }
    console.log(`✅ Created ${leaseIds.length} leases`);

    // Seed rents for current month and previous months
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const rents: Omit<Rent, 'id' | 'createdAt' | 'updatedAt'>[] = [];

    // Generate rents for the last 3 months
    for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
      const month = currentMonth - monthOffset;
      const year = month < 0 ? currentYear - 1 : currentYear;
      const adjustedMonth = month < 0 ? 12 + month : month;

      for (let i = 0; i < leases.length; i++) {
        const lease = leases[i]!;
        const dueDate = new Date(year, adjustedMonth, lease.paymentDay || 5); // Due on paymentDay

        let status: 'pending' | 'paid' | 'late' | 'partial';
        let paidDate: Date | undefined;

        if (monthOffset === 0) {
          // Current month - some paid, some pending
          if (i === 0) {
            status = 'paid';
            paidDate = new Date(year, adjustedMonth, 2);
          } else if (i === 1) {
            status = 'pending';
          } else {
            status = 'late';
          }
        } else {
          // Previous months - all paid
          status = 'paid';
          paidDate = new Date(year, adjustedMonth, 3);
        }

        rents.push({
          leaseId: leaseIds[i]!,
          dueDate,
          amount: lease.rent + lease.charges,
          charges: lease.charges,
          status,
          paidDate,
          paidAmount: status === 'paid' ? lease.rent + lease.charges : undefined,
        });
      }
    }

    for (const rent of rents) {
      await db.rents.add({
        ...rent,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    console.log(`✅ Created ${rents.length} rent entries`);

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

/**
 * Clear all data from the database
 */
export async function clearDatabase(): Promise<void> {
  console.log('🗑️  Clearing database...');
  
  try {
    await Promise.all([
      db.properties.clear(),
      db.tenants.clear(),
      db.leases.clear(),
      db.rents.clear(),
      db.documents.clear(),
      db.inventories.clear(),
      db.communications.clear(),
      db.settings.clear(),
    ]);
    
    console.log('✅ Database cleared successfully!');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  }
}
