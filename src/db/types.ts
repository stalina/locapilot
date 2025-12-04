// Re-export all types from schema.ts
export type {
  Property,
  Tenant,
  Lease,
  Rent,
  Document,
  Inventory,
  InventoryItem,
  Communication,
  Settings,
  TenantDocument,
  TenantAudit,
  ChargesAdjustmentRow,
} from './schema';

// Application-specific settings type
export interface AppSettings {
  id?: number;
  theme: 'light' | 'dark';
  language: string;
  currency: string;
  dateFormat: string;
  notifications: {
    enabled: boolean;
    rentReminders: boolean;
    leaseExpiration: boolean;
    paymentConfirmations: boolean;
  };
  autoSave: boolean;
  compactMode: boolean;
}
