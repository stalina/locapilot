import { db } from '@/db/database';

/** Entity types offered in the documents related-entity filter. */
export type FilterableEntityType = 'property' | 'tenant' | 'lease' | 'rent' | 'inventory';

export interface EntityOption {
  id: number;
  label: string;
}

const MONTH_YEAR_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

function formatMonthYear(date: Date | string | undefined): string {
  if (!date) return '';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('fr-FR', MONTH_YEAR_FORMAT);
}

/**
 * Loads display labels for the given entity ids (manual joins with bulkGet —
 * no foreign keys in IndexedDB). Unknown ids are skipped.
 */
export async function loadEntityOptions(
  entityType: FilterableEntityType,
  ids: number[]
): Promise<EntityOption[]> {
  const uniqueIds = [...new Set(ids)].filter(id => Number.isFinite(id));
  if (uniqueIds.length === 0) return [];

  let options: EntityOption[] = [];

  switch (entityType) {
    case 'property': {
      const properties = await db.properties.bulkGet(uniqueIds);
      options = properties.flatMap(p =>
        p?.id ? [{ id: p.id, label: p.name || `Bien #${p.id}` }] : []
      );
      break;
    }
    case 'tenant': {
      const tenants = await db.tenants.bulkGet(uniqueIds);
      options = tenants.flatMap(t =>
        t?.id
          ? [{ id: t.id, label: `${t.firstName} ${t.lastName}`.trim() || `Locataire #${t.id}` }]
          : []
      );
      break;
    }
    case 'lease': {
      const leases = await db.leases.bulkGet(uniqueIds);
      const propertyIds = [...new Set(leases.flatMap(l => (l ? [l.propertyId] : [])))];
      const properties = await db.properties.bulkGet(propertyIds);
      const propertyNames = new Map<number, string>(
        properties.flatMap(p => (p?.id ? [[p.id, p.name] as [number, string]] : []))
      );
      options = leases.flatMap(l => {
        if (!l?.id) return [];
        const propertyName = propertyNames.get(l.propertyId);
        return [
          { id: l.id, label: propertyName ? `Bail #${l.id} — ${propertyName}` : `Bail #${l.id}` },
        ];
      });
      break;
    }
    case 'rent': {
      const rents = await db.rents.bulkGet(uniqueIds);
      options = rents.flatMap(r => {
        if (!r?.id) return [];
        const period = formatMonthYear(r.dueDate);
        return [{ id: r.id, label: period ? `Loyer #${r.id} — ${period}` : `Loyer #${r.id}` }];
      });
      break;
    }
    case 'inventory': {
      const inventories = await db.inventories.bulkGet(uniqueIds);
      options = inventories.flatMap(i => {
        if (!i?.id) return [];
        const kind = i.type === 'checkin' ? "État des lieux d'entrée" : 'État des lieux de sortie';
        const period = formatMonthYear(i.date);
        return [{ id: i.id, label: period ? `${kind} — ${period}` : `${kind} #${i.id}` }];
      });
      break;
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}
