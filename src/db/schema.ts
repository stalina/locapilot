import Dexie, { type EntityTable } from 'dexie';

// ========== Types & Interfaces ==========

export interface Property {
  id?: number;
  name: string;
  address: string;
  postalCode?: string;
  town?: string;
  type: 'apartment' | 'house' | 'studio' | 'commercial' | 'parking' | 'other';
  surface: number; // m²
  rooms: number;
  bedrooms?: number;
  bathrooms?: number;
  rent: number; // base rent amount
  charges?: number;
  deposit?: number;
  annonce?: string; // Default announcement HTML/text for listings
  description?: string;
  features?: string[];
  photos?: number[]; // Document IDs for property photos
  status: 'vacant' | 'occupied' | 'maintenance';
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id?: number;
  // Civilité: 'mr' pour Monsieur, 'mme' pour Madame
  civility?: 'mr' | 'mme';
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
  status: 'active' | 'candidate' | 'former' | 'candidature-refusee';
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
  type:
    | 'lease'
    | 'receipt'
    | 'inventory'
    | 'id'
    | 'payslip'
    | 'invoice'
    | 'insurance'
    | 'photo'
    | 'other';
  relatedEntityType?: 'property' | 'tenant' | 'lease' | 'rent' | 'applicant' | 'inventory';
  relatedEntityId?: number;
  mimeType: string;
  size: number;
  data: Blob; // File content
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantDocument {
  id?: number;
  tenantId: number;
  name: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  notes?: string;
  data?: Blob; // optional - some exports may exclude blob
  documentId?: number; // reference to main documents table
}

export interface TenantAudit {
  id?: number;
  tenantId: number;
  action: 'validated' | 'refused' | 'created' | 'updated';
  actorId?: number | null; // user id performing the action (optional)
  timestamp: Date;
  reason?: string;
  documentIds?: number[]; // linked document ids used as evidence
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
  photos?: number[]; // Document IDs - harmonisé avec Property.photos
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

export interface ChargesAdjustmentRow {
  id?: number;
  leaseId: number;
  year: number;
  monthlyRent: number; // rent amount for that year
  annualCharges?: number; // montant des charges pour l'année (total)
  chargesProvisionPaid: number; // total provision paid for the year
  rentsPaidCount: number; // number of rents paid in that year
  rentsPaidTotal: number; // total amount of rents paid in that year
  // Custom charges stored as a key->number map, keys are column labels
  customCharges?: Record<string, number>;
  createdAt: Date;
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
  tenantDocuments!: EntityTable<TenantDocument, 'id'>;
  tenantAudits!: EntityTable<TenantAudit, 'id'>;
  settings!: EntityTable<Settings, 'id'>;
  chargesAdjustments!: EntityTable<ChargesAdjustmentRow, 'id'>;

  constructor() {
    super('locapilot');

    // Version 1 - Schema initial
    this.version(1).stores({
      properties: '++id, name, status, createdAt',
      tenants: '++id, email, status, lastName, createdAt',
      leases: '++id, propertyId, status, startDate, endDate',
      rents: '++id, leaseId, dueDate, status, paidDate',
      documents: '++id, type, relatedEntityType, relatedEntityId, createdAt',
      inventories: '++id, leaseId, type, date',
      communications: '++id, relatedEntityType, relatedEntityId, date, type',
      settings: '++id, &key',
      // charges adjustments table
      chargesAdjustments: '++id, leaseId, year',
    });

    // Version 2 - Ajout du support des photos pour les propriétés
    this.version(2)
      .stores({
        properties: '++id, name, status, createdAt',
        tenants: '++id, email, status, lastName, createdAt',
        leases: '++id, propertyId, status, startDate, endDate',
        rents: '++id, leaseId, dueDate, status, paidDate',
        documents: '++id, type, relatedEntityType, relatedEntityId, createdAt',
        inventories: '++id, leaseId, type, date',
        communications: '++id, relatedEntityType, relatedEntityId, date, type',
        settings: '++id, &key',
      })
      .upgrade(async transaction => {
        // Initialiser le champ photos pour toutes les propriétés existantes
        const properties = await transaction.table('properties').toArray();
        await Promise.all(
          properties.map(p => transaction.table('properties').update(p.id!, { photos: [] }))
        );
      });

    // Version 3: Harmonize Inventory.photos to use number[] (like Property.photos)
    this.version(3)
      .stores({
        properties: '++id, name, address, type, surface, status, createdAt',
        tenants: '++id, firstName, lastName, email, phone, status, createdAt',
        leases: '++id, propertyId, startDate, endDate, status, createdAt',
        rents: '++id, leaseId, dueDate, paidDate, status, month, year',
        documents: '++id, type, relatedEntityType, relatedEntityId, createdAt',
        inventories: '++id, leaseId, type, date',
        communications: '++id, relatedEntityType, relatedEntityId, date, type',
        settings: '++id, &key',
      })
      .upgrade(async transaction => {
        // Migrate existing inventories: convert photos from string[] to number[]
        const inventories = await transaction.table('inventories').toArray();
        await Promise.all(
          inventories.map(inventory =>
            transaction.table('inventories').update(inventory.id!, {
              photos: Array.isArray(inventory.photos) ? [] : [],
            })
          )
        );
      });

    // Version 4: Add `annonce` field to properties (rich text). Backward compatible: existing records keep their data.
    this.version(4).stores({
      properties: '++id, name, address, type, surface, status, createdAt',
      tenants: '++id, firstName, lastName, email, phone, status, createdAt',
      leases: '++id, propertyId, startDate, endDate, status, createdAt',
      rents: '++id, leaseId, dueDate, paidDate, status, month, year',
      documents: '++id, type, relatedEntityType, relatedEntityId, createdAt',
      inventories: '++id, leaseId, type, date',
      communications: '++id, relatedEntityType, relatedEntityId, date, type',
      settings: '++id, &key',
    });

    // Version 5: Add tenantDocuments and tenantAudits tables to support attaching documents to tenants
    this.version(5)
      .stores({
        properties: '++id, name, address, type, surface, status, createdAt',
        tenants: '++id, firstName, lastName, email, phone, status, createdAt',
        leases: '++id, propertyId, startDate, endDate, status, createdAt',
        rents: '++id, leaseId, dueDate, paidDate, status, month, year',
        documents: '++id, type, relatedEntityType, relatedEntityId, createdAt',
        inventories: '++id, leaseId, type, date',
        communications: '++id, relatedEntityType, relatedEntityId, date, type',
        tenantDocuments: '++id, tenantId, uploadedAt, name',
        tenantAudits: '++id, tenantId, action, timestamp',
        settings: '++id, &key',
        chargesAdjustments: '++id, leaseId, year',
      })
      .upgrade(async () => {
        // No data transformation necessary; ensure tables exist for future use.
      });

    // Version 6: Add chargesAdjustments table to store yearly breakdowns and custom charge columns
    this.version(6).stores({
      properties: '++id, name, address, type, surface, status, createdAt',
      tenants: '++id, firstName, lastName, email, phone, status, createdAt',
      leases: '++id, propertyId, startDate, endDate, status, createdAt',
      rents: '++id, leaseId, dueDate, paidDate, status, month, year',
      documents: '++id, type, relatedEntityType, relatedEntityId, createdAt',
      inventories: '++id, leaseId, type, date',
      communications: '++id, relatedEntityType, relatedEntityId, date, type',
      tenantDocuments: '++id, tenantId, uploadedAt, name',
      tenantAudits: '++id, tenantId, action, timestamp',
      settings: '++id, &key',
      chargesAdjustments: '++id, leaseId, year, [leaseId+year]',
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
    const version = db.verno;
    console.log(`✅ Database initialized successfully (version ${version})`);
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
    tenantDocuments: await db.tenantDocuments.toArray(),
    tenantAudits: await db.tenantAudits.toArray(),
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
    [
      db.properties,
      db.tenants,
      db.leases,
      db.rents,
      db.documents,
      db.inventories,
      db.communications,
      db.settings,
    ],
    async () => {
      // Clear existing data
      await Promise.all([
        db.properties.clear(),
        db.tenants.clear(),
        db.leases.clear(),
        db.rents.clear(),
        db.documents.clear(),
        db.tenantDocuments.clear(),
        db.tenantAudits.clear(),
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
      if (data.tenantDocuments) await db.tenantDocuments.bulkAdd(data.tenantDocuments);
      if (data.tenantAudits) await db.tenantAudits.bulkAdd(data.tenantAudits);
      if (data.inventories) await db.inventories.bulkAdd(data.inventories);
      if (data.communications) await db.communications.bulkAdd(data.communications);
      if (data.settings) await db.settings.bulkAdd(data.settings);
    }
  );

  console.log('✅ Data imported successfully');
}
