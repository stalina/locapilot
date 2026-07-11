/**
 * Strict Zod validation of imported backup payloads (issue #80, C2).
 *
 * Every record of every table is validated against a strict per-entity schema
 * (aligned with the types in `src/db/schema.ts`) BEFORE any destructive
 * operation (`clear()` / `bulkAdd()`) is performed on the database. A single
 * non-conforming record — wrong type, missing required field, unknown extra
 * field — rejects the entire import.
 *
 * This is the single validation point for every import channel: JSON file
 * import and P2P sync both go through `dataTransferStore.importFromObject`,
 * which calls `validateImportPayload`.
 *
 * Note: `documents` and `tenantDocuments` are validated in their SERIALIZED
 * form (`data` as a base64 data-URL string or null), as produced by the export
 * feature, before `deserializeDocuments` converts them back to Blob.
 */

import { z } from 'zod';

// Dates survive a JSON round-trip as ISO strings; in-memory payloads may still
// hold Date objects. Accept both, reject anything that does not parse.
const dateLike = z.union([
  z.date(),
  z.string().refine(value => !Number.isNaN(Date.parse(value)), { message: 'Date invalide' }),
]);

const idField = z.number().int().optional();

export const propertySchema = z.strictObject({
  id: idField,
  name: z.string(),
  address: z.string(),
  postalCode: z.string().optional(),
  town: z.string().optional(),
  type: z.enum(['apartment', 'house', 'studio', 'commercial', 'parking', 'other']),
  surface: z.number(),
  rooms: z.number(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  rent: z.number(),
  charges: z.number().optional(),
  deposit: z.number().optional(),
  annonce: z.string().optional(),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  photos: z.array(z.number()).optional(),
  status: z.enum(['vacant', 'occupied', 'maintenance']),
  createdAt: dateLike,
  updatedAt: dateLike,
});

export const tenantSchema = z.strictObject({
  id: idField,
  civility: z.enum(['mr', 'mme']).optional(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string(),
  birthDate: dateLike.optional(),
  currentAddress: z.string().optional(),
  occupation: z.string().optional(),
  employer: z.string().optional(),
  income: z.number().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'candidate', 'former', 'candidature-refusee']),
  createdAt: dateLike,
  updatedAt: dateLike,
});

export const leaseSchema = z.strictObject({
  id: idField,
  propertyId: z.number(),
  tenantIds: z.array(z.number()),
  startDate: dateLike,
  endDate: dateLike.optional(),
  rent: z.number(),
  charges: z.number(),
  deposit: z.number(),
  paymentDay: z.number(),
  status: z.enum(['active', 'ended', 'pending']),
  documentId: z.number().optional(),
  createdAt: dateLike,
  updatedAt: dateLike,
});

export const rentSchema = z.strictObject({
  id: idField,
  leaseId: z.number(),
  dueDate: dateLike,
  amount: z.number(),
  charges: z.number(),
  paidDate: dateLike.optional(),
  paidAmount: z.number().optional(),
  paymentMethod: z.enum(['cash', 'check', 'transfer', 'card']).optional(),
  status: z.enum(['pending', 'paid', 'late', 'partial']),
  receiptId: z.number().optional(),
  createdAt: dateLike,
  updatedAt: dateLike,
});

// Serialized form: `data` is a base64 data-URL string (or null when the blob
// could not be serialized), never a Blob — see dataTransferService.
export const serializedDocumentSchema = z.strictObject({
  id: idField,
  name: z.string(),
  type: z.enum([
    'lease',
    'receipt',
    'inventory',
    'id',
    'payslip',
    'invoice',
    'insurance',
    'photo',
    'diagnostic',
    'other',
  ]),
  relatedEntityType: z
    .enum(['property', 'tenant', 'lease', 'rent', 'applicant', 'inventory'])
    .optional(),
  relatedEntityId: z.number().optional(),
  mimeType: z.string(),
  size: z.number(),
  data: z.string().nullable(),
  description: z.string().optional(),
  expiresAt: dateLike.optional(),
  createdAt: dateLike,
  updatedAt: dateLike,
});

export const serializedTenantDocumentSchema = z.strictObject({
  id: idField,
  tenantId: z.number(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  uploadedAt: dateLike,
  notes: z.string().optional(),
  data: z.string().nullable().optional(),
  documentId: z.number().optional(),
});

export const tenantAuditSchema = z.strictObject({
  id: idField,
  tenantId: z.number(),
  action: z.enum(['validated', 'refused', 'created', 'updated']),
  actorId: z.number().nullable().optional(),
  timestamp: dateLike,
  reason: z.string().optional(),
  documentIds: z.array(z.number()).optional(),
});

const inventoryConditionSchema = z.enum(['excellent', 'good', 'fair', 'poor', 'damaged']);

const inventoryRoomItemSchema = z.strictObject({
  label: z.string(),
  condition: inventoryConditionSchema,
  notes: z.string().optional(),
  photos: z.array(z.number()).optional(),
});

const inventoryRoomSchema = z.strictObject({
  name: z.string(),
  items: z.array(inventoryRoomItemSchema),
});

const inventorySignatureSchema = z.strictObject({
  tenantAccepted: z.boolean(),
  landlordAccepted: z.boolean(),
  acceptedAt: dateLike.optional(),
  tenantName: z.string().optional(),
});

export const inventorySchema = z.strictObject({
  id: idField,
  leaseId: z.number(),
  type: z.enum(['checkin', 'checkout']),
  date: dateLike,
  observations: z.string().optional(),
  photos: z.array(z.number()).optional(),
  rooms: z.array(inventoryRoomSchema).optional(),
  // Deprecated legacy free-form per-room data — kept for backward compatibility.
  roomsData: z.record(z.string(), z.unknown()).optional(),
  signature: inventorySignatureSchema.optional(),
  createdAt: dateLike.optional(),
  updatedAt: dateLike.optional(),
});

export const communicationSchema = z.strictObject({
  id: idField,
  relatedEntityType: z.enum(['property', 'tenant', 'lease', 'applicant', 'rent']),
  relatedEntityId: z.number(),
  type: z.enum(['email', 'phone', 'sms', 'meeting', 'letter']),
  direction: z.enum(['inbound', 'outbound']),
  subject: z.string().optional(),
  content: z.string(),
  date: dateLike,
  attachments: z.array(z.number()).optional(),
  createdAt: dateLike,
});

export const chargesAdjustmentRowSchema = z.strictObject({
  id: idField,
  leaseId: z.number(),
  year: z.number(),
  monthlyRent: z.number(),
  annualCharges: z.number().optional(),
  chargesProvisionPaid: z.number(),
  rentsPaidCount: z.number(),
  rentsPaidTotal: z.number(),
  customCharges: z.record(z.string(), z.number()).optional(),
  createdAt: dateLike,
  updatedAt: dateLike,
});

const quarterSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export const irlIndexSchema = z.strictObject({
  id: idField,
  year: z.number(),
  quarter: quarterSchema,
  value: z.number(),
  createdAt: dateLike,
  updatedAt: dateLike,
});

export const rentRevisionSchema = z.strictObject({
  id: idField,
  leaseId: z.number(),
  year: z.number(),
  anniversaryDate: dateLike,
  effectiveDate: dateLike,
  referenceQuarter: quarterSchema,
  oldRent: z.number(),
  newRent: z.number(),
  currentIrl: z.number(),
  previousIrl: z.number(),
  charges: z.number(),
  status: z.enum(['pending', 'applied', 'rejected']),
  documentId: z.number().optional(),
  createdAt: dateLike,
  updatedAt: dateLike,
});

export const reminderSchema = z.strictObject({
  id: idField,
  rentId: z.number(),
  level: z.enum(['amiable', 'recommandee', 'mise-en-demeure']),
  thresholdDays: z.number(),
  sentDate: dateLike,
  documentId: z.number(),
  communicationId: z.number(),
  createdAt: dateLike,
});

export const settingsSchema = z.strictObject({
  id: idField,
  key: z.string(),
  value: z.unknown(),
  updatedAt: dateLike,
});

/**
 * Full backup payload schema. `properties`, `tenants` and `version` are
 * required (same contract as the historical shape check); the other tables are
 * optional and default to empty arrays. Empty arrays are valid.
 */
export const importPayloadSchema = z.strictObject({
  properties: z.array(propertySchema),
  tenants: z.array(tenantSchema),
  leases: z.array(leaseSchema).default([]),
  rents: z.array(rentSchema).default([]),
  documents: z.array(serializedDocumentSchema).default([]),
  tenantDocuments: z.array(serializedTenantDocumentSchema).default([]),
  tenantAudits: z.array(tenantAuditSchema).default([]),
  inventories: z.array(inventorySchema).default([]),
  communications: z.array(communicationSchema).default([]),
  chargesAdjustments: z.array(chargesAdjustmentRowSchema).default([]),
  irlIndices: z.array(irlIndexSchema).default([]),
  rentRevisions: z.array(rentRevisionSchema).default([]),
  reminders: z.array(reminderSchema).default([]),
  settings: z.array(settingsSchema).default([]),
  exportedAt: z.string().optional(),
  version: z.string(),
});

export type ValidatedImportPayload = z.infer<typeof importPayloadSchema>;

/**
 * Validate an untrusted backup payload (JSON file or P2P) and return the
 * parsed, defaulted payload. Throws a descriptive Error on the first
 * violation; the caller MUST NOT touch the database when this throws.
 */
export function validateImportPayload(data: unknown): ValidatedImportPayload {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Format de fichier invalide');
  }

  const result = importPayloadSchema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first && first.path.length > 0 ? first.path.join('.') : '(racine)';
    const detail = first?.message ?? 'erreur de validation';
    throw new Error(`Sauvegarde invalide — champ « ${path} » : ${detail}`);
  }

  return result.data;
}
