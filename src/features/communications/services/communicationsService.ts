import { db } from '@/db/database';
import type { Communication, Lease, Property, Tenant } from '@/db/types';

export type CommunicationType = Communication['type'];
export type CommunicationDirection = Communication['direction'];
export type CommunicationEntityType = Communication['relatedEntityType'];

export interface CommunicationFilters {
  relatedEntityType?: CommunicationEntityType | 'all';
  type?: CommunicationType | 'all';
  direction?: CommunicationDirection | 'all';
  search?: string;
}

export interface CommunicationDraft {
  relatedEntityType: CommunicationEntityType;
  relatedEntityId: number;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject?: string;
  content: string;
  date: Date;
  attachments?: number[];
}

export const ORPHAN_ENTITY_LABEL = '(entité supprimée)';

export const TYPE_LABELS: Record<CommunicationType, string> = {
  email: 'E-mail',
  phone: 'Téléphone',
  sms: 'SMS',
  meeting: 'Rendez-vous',
  letter: 'Courrier',
};

export const DIRECTION_LABELS: Record<CommunicationDirection, string> = {
  inbound: 'Reçu',
  outbound: 'Envoyé',
};

export const ENTITY_TYPE_LABELS: Record<CommunicationEntityType, string> = {
  property: 'Propriété',
  tenant: 'Locataire',
  lease: 'Bail',
  applicant: 'Candidat',
  rent: 'Loyer',
};

/**
 * Validate a manual communication draft.
 * Returns a list of human-readable error messages (empty when valid).
 * - `content` must not be empty / whitespace-only.
 * - `date` must not be in the future.
 */
export function validateCommunicationDraft(
  draft: Pick<CommunicationDraft, 'content' | 'date'>,
  now = new Date()
): string[] {
  const errors: string[] = [];

  if (!draft.content || draft.content.trim().length === 0) {
    errors.push('Le contenu est obligatoire.');
  }

  if (draft.date) {
    const date = new Date(draft.date);
    if (Number.isNaN(date.getTime())) {
      errors.push('La date est invalide.');
    } else if (date.getTime() > now.getTime()) {
      errors.push('La date ne peut pas être dans le futur.');
    }
  } else {
    errors.push('La date est obligatoire.');
  }

  return errors;
}

/**
 * Apply entity/type/direction filters and a free-text search over
 * `subject` + `content`. Filtering is case-insensitive for the search term.
 */
export function filterCommunications(
  communications: Communication[],
  filters: CommunicationFilters
): Communication[] {
  const search = filters.search?.trim().toLowerCase() ?? '';

  return communications.filter(comm => {
    if (
      filters.relatedEntityType &&
      filters.relatedEntityType !== 'all' &&
      comm.relatedEntityType !== filters.relatedEntityType
    ) {
      return false;
    }
    if (filters.type && filters.type !== 'all' && comm.type !== filters.type) {
      return false;
    }
    if (filters.direction && filters.direction !== 'all' && comm.direction !== filters.direction) {
      return false;
    }
    if (search.length > 0) {
      const haystack = `${comm.subject ?? ''} ${comm.content ?? ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

/**
 * A communication is read-only when it was auto-generated, i.e. its id is
 * referenced by a Reminder row. Detecting via the Reminder link (rather than
 * guessing from `type`/`direction`) keeps manually-logged letters editable.
 */
export function isReadOnlyCommunication(
  communication: Pick<Communication, 'id'>,
  reminderLinkedIds: Set<number>
): boolean {
  return typeof communication.id === 'number' && reminderLinkedIds.has(communication.id);
}

/**
 * Resolve a human-readable label for a communication's related entity.
 * Falls back to {@link ORPHAN_ENTITY_LABEL} when the entity no longer exists.
 */
export function resolveEntityLabel(
  communication: Pick<Communication, 'relatedEntityType' | 'relatedEntityId'>,
  context: { properties: Property[]; tenants: Tenant[]; leases: Lease[] }
): string {
  const { relatedEntityType, relatedEntityId } = communication;

  switch (relatedEntityType) {
    case 'property': {
      const p = context.properties.find(x => x.id === relatedEntityId);
      return p ? p.name : ORPHAN_ENTITY_LABEL;
    }
    case 'tenant':
    case 'applicant': {
      const t = context.tenants.find(x => x.id === relatedEntityId);
      return t ? `${t.firstName} ${t.lastName}` : ORPHAN_ENTITY_LABEL;
    }
    case 'lease': {
      const l = context.leases.find(x => x.id === relatedEntityId);
      if (!l) return ORPHAN_ENTITY_LABEL;
      const p = context.properties.find(x => x.id === l.propertyId);
      return p ? `Bail — ${p.name}` : `Bail #${String(relatedEntityId)}`;
    }
    case 'rent': {
      const rentLabel = `Loyer #${String(relatedEntityId)}`;
      return rentLabel;
    }
    default:
      return ORPHAN_ENTITY_LABEL;
  }
}

/**
 * Trigger a browser download for an attached document.
 */
export async function downloadAttachment(documentId: number): Promise<void> {
  const doc = await db.documents.get(documentId);
  if (!doc) throw new Error('Document introuvable');
  const url = URL.createObjectURL(doc.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.name || `document-${String(documentId)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
