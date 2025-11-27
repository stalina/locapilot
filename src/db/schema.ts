import Dexie, { type EntityTable } from 'dexie';

// ========== Types & Interfaces ==========

export interface Property {
  id?: number;
  name: string;
  address: string;
  type: 'apartment' | 'house' | 'studio' | 'commercial' | 'parking' | 'other';
  surface: number; // m²
  rooms: number;
  bedrooms?: number;
  bathrooms?: number;
  rent: number; // base rent amount
  charges?: number;
  deposit?: number;
  description?: string;
  features?: string[];
  status: 'vacant' | 'occupied' | 'maintenance';
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthDate?: Date;
  currentAddress?: string;
  occupation?: string;
  employer?: string;
  income?: number;
  notes?: string;
  status: 'active' | 'candidate' | 'former';
  createdAt: Date;
  updatedAt: Date;
}

export interface Lease {
  id?: number;
  propertyId: number;
  tenantIds: number[]; // Multiple tenants possible
  startDate: Date;
  endDate?: Date;
  rent: number;
  charges: number;
  deposit: number;
  paymentDay: number; // Day of month (1-31)
  status: 'active' | 'ended' | 'pending';
  documentId?: number; // PDF of lease contract
  createdAt: Date;
  updatedAt: Date;
}

export interface Rent {
  id?: number;
  leaseId: number;
  dueDate: Date;
  amount: number;
  charges: number;
  paidDate?: Date;
  paidAmount?: number;
  paymentMethod?: 'cash' | 'check' | 'transfer' | 'card';
  status: 'pending' | 'paid' | 'late' | 'partial';
  receiptId?: number; // Link to generated receipt
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id?: number;
  name: string;
  type: 'lease' | 'receipt' | 'inventory' | 'id' | 'payslip' | 'invoice' | 'insurance' | 'other';
  relatedEntityType?: 'property' | 'tenant' | 'lease' | 'rent' | 'applicant';
  relatedEntityId?: number;
  mimeType: string;
  size: number;
  data: Blob; // File content
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  room: string;
  item: string;
  condition: 'excellent' | 'good' | 'fair' | 'poor' | 'damaged';
  notes?: string;
  photos?: number[]; // Document IDs
}

export interface Inventory {
  id?: number;
  leaseId: number;
  type: 'checkin' | 'checkout';
  date: Date;
  observations?: string;
  photos?: string[];
  roomsData?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Communication {
  id?: number;
  relatedEntityType: 'property' | 'tenant' | 'lease' | 'applicant';
  relatedEntityId: number;
  type: 'email' | 'phone' | 'sms' | 'meeting' | 'letter';
  direction: 'inbound' | 'outbound';
  subject?: string;
  content: string;
  date: Date;
  attachments?: number[]; // Document IDs
  createdAt: Date;
}

export interface Settings {
  id?: number;
  key: string; // Unique key
  value: unknown;
  updatedAt: Date;
}

// ========== Database Class ==========

export class LocapilotDB extends Dexie {
  properties!: EntityTable<Property, 'id'>;
  tenants!: EntityTable<Tenant, 'id'>;
  leases!: EntityTable<Lease, 'id'>;
  rents!: EntityTable<Rent, 'id'>;
  documents!: EntityTable<Document, 'id'>;
  inventories!: EntityTable<Inventory, 'id'>;
  communications!: EntityTable<Communication, 'id'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor() {
    super('locapilot');

    this.version(1).stores({
      properties: '++id, name, status, createdAt',
      tenants: '++id, email, status, lastName, createdAt',
      leases: '++id, propertyId, status, startDate, endDate',
      rents: '++id, leaseId, dueDate, status, paidDate',
      documents: '++id, type, relatedEntityType, relatedEntityId, createdAt',
      inventories: '++id, leaseId, type, date',
      communications: '++id, relatedEntityType, relatedEntityId, date, type',
      settings: '++id, &key',
    });
  }
}

// ========== Database Instance ==========

export const db = new LocapilotDB();

// ========== Helper Functions ==========

/**
 * Initialize database and run any necessary migrations
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await db.open();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  }
}

/**
 * Export all database data as JSON
 */
export async function exportData(): Promise<string> {
  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    properties: await db.properties.toArray(),
    tenants: await db.tenants.toArray(),
    leases: await db.leases.toArray(),
    rents: await db.rents.toArray(),
    documents: await db.documents.toArray(),
    inventories: await db.inventories.toArray(),
    communications: await db.communications.toArray(),
    settings: await db.settings.toArray(),
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Import data from JSON export
 */
export async function importData(jsonData: string): Promise<void> {
  const data = JSON.parse(jsonData);

  await db.transaction(
    'rw',
    [db.properties, db.tenants, db.leases, db.rents, db.documents, db.inventories, db.communications, db.settings],
    async () => {
      // Clear existing data
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

      // Import new data
      if (data.properties) await db.properties.bulkAdd(data.properties);
      if (data.tenants) await db.tenants.bulkAdd(data.tenants);
      if (data.leases) await db.leases.bulkAdd(data.leases);
      if (data.rents) await db.rents.bulkAdd(data.rents);
      if (data.documents) await db.documents.bulkAdd(data.documents);
      if (data.inventories) await db.inventories.bulkAdd(data.inventories);
      if (data.communications) await db.communications.bulkAdd(data.communications);
      if (data.settings) await db.settings.bulkAdd(data.settings);
    }
  );

  console.log('✅ Data imported successfully');
}
