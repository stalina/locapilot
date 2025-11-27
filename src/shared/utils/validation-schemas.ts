/**
 * Schémas de validation Zod pour les entités
 * Utilisés pour valider les imports/exports et garantir l'intégrité des données
 */

import { z } from 'zod';

/**
 * Schéma pour les propriétés
 */
export const PropertySchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, 'Le nom est requis'),
  address: z.string().min(1, "L'adresse est requise"),
  city: z.string().min(1, 'La ville est requise'),
  postalCode: z.string().regex(/^\d{5}$/, 'Code postal invalide (5 chiffres)'),
  type: z.enum(['apartment', 'house', 'studio', 'commercial', 'parking', 'land']),
  surface: z.number().positive('La surface doit être positive'),
  rooms: z.number().int().min(0, 'Le nombre de pièces doit être >= 0'),
  price: z.number().positive('Le prix doit être positif'),
  charges: z.number().min(0, 'Les charges doivent être >= 0').optional(),
  deposit: z.number().min(0, 'Le dépôt de garantie doit être >= 0').optional(),
  status: z.enum(['available', 'rented', 'maintenance']),
  description: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

/**
 * Schéma pour les locataires
 */
export const TenantSchema = z.object({
  id: z.number().optional(),
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide'),
  phone: z.string().regex(/^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/, 'Téléphone invalide'),
  birthDate: z.string().optional(),
  profession: z.string().optional(),
  income: z.number().min(0, 'Le revenu doit être >= 0').optional(),
  status: z.enum(['active', 'candidate', 'former']),
  notes: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

/**
 * Schéma pour les baux
 */
export const LeaseSchema = z.object({
  id: z.number().optional(),
  propertyId: z.number().int().positive('ID propriété invalide'),
  tenantIds: z.array(z.number().int().positive()).min(1, 'Au moins un locataire requis'),
  startDate: z.string().min(1, 'La date de début est requise'),
  endDate: z.string().optional(),
  rent: z.number().positive('Le loyer doit être positif'),
  charges: z.number().min(0, 'Les charges doivent être >= 0').optional(),
  deposit: z.number().min(0, 'Le dépôt de garantie doit être >= 0').optional(),
  paymentDay: z.number().int().min(1).max(31, 'Jour de paiement invalide (1-31)'),
  type: z.enum(['furnished', 'unfurnished', 'commercial', 'seasonal']),
  status: z.enum(['active', 'terminated', 'draft']),
  notes: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

/**
 * Schéma pour les loyers
 */
export const RentSchema = z.object({
  id: z.number().optional(),
  leaseId: z.number().int().positive('ID bail invalide'),
  propertyId: z.number().int().positive('ID propriété invalide'),
  tenantId: z.number().int().positive('ID locataire invalide'),
  amount: z.number().positive('Le montant doit être positif'),
  charges: z.number().min(0, 'Les charges doivent être >= 0').optional(),
  dueDate: z.string().min(1, "La date d'échéance est requise"),
  paidDate: z.string().optional(),
  status: z.enum(['pending', 'paid', 'late', 'partial']),
  paymentMethod: z.enum(['cash', 'check', 'transfer', 'card', 'other']).optional(),
  notes: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

/**
 * Schéma pour les documents
 */
export const DocumentSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, 'Le nom est requis'),
  type: z.enum([
    'lease',
    'receipt',
    'inventory',
    'insurance',
    'identity',
    'pay_slip',
    'tax_notice',
    'other',
  ]),
  category: z.enum(['lease', 'tenant', 'property', 'rent', 'other']),
  file: z.instanceof(Blob).optional(),
  size: z.number().int().min(0).optional(),
  mimeType: z.string().optional(),
  relatedId: z.number().int().positive().optional(),
  uploadDate: z.number().optional(),
  notes: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

/**
 * Schéma pour les paramètres
 */
export const SettingsSchema = z.object({
  id: z.number().optional(),
  key: z.string().min(1, 'La clé est requise'),
  value: z.any(),
  updatedAt: z.number().optional(),
});

/**
 * Schémas pour les exports/imports de données
 */
export const ExportDataSchema = z.object({
  version: z.string(),
  exportDate: z.string(),
  data: z.object({
    properties: z.array(PropertySchema).optional(),
    tenants: z.array(TenantSchema).optional(),
    leases: z.array(LeaseSchema).optional(),
    rents: z.array(RentSchema).optional(),
    documents: z.array(DocumentSchema).optional(),
    settings: z.array(SettingsSchema).optional(),
  }),
});

/**
 * Types TypeScript dérivés des schémas Zod
 */
export type PropertyValidation = z.infer<typeof PropertySchema>;
export type TenantValidation = z.infer<typeof TenantSchema>;
export type LeaseValidation = z.infer<typeof LeaseSchema>;
export type RentValidation = z.infer<typeof RentSchema>;
export type DocumentValidation = z.infer<typeof DocumentSchema>;
export type SettingsValidation = z.infer<typeof SettingsSchema>;
export type ExportDataValidation = z.infer<typeof ExportDataSchema>;
