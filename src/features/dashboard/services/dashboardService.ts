import type { Communication, Inventory, Lease, Property, Rent } from '@/db/types';

export type DashboardStats = {
  totalProperties: number;
  occupancyRate: number;
  monthlyRevenue: number;
  pendingRents: number;
};

export type DashboardActivityItem = {
  id: string;
  type: 'payment' | 'lease' | 'inventory' | 'message';
  title: string;
  description: string;
  time: string;
  badge?: { label: string; variant: 'success' | 'primary' | 'warning' };
  icon: string;
  iconColor: string;
};

export type DashboardEventItem = {
  id: string;
  date: string;
  title: string;
  description: string;
};

type RawActivity = {
  id: string;
  type: string;
  date: Date | null;
  title: string;
  description: string;
  meta?: unknown;
};

function parseDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  const parsed = new Date(input as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRelativeTime(d: Date, now = new Date()): string {
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `Il y a ${diff} s`;
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
}

function formatEventDate(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleString('fr-FR', { month: 'short' }).toUpperCase();
  const hh = d.getHours();
  const mm = d.getMinutes();
  const time = hh || mm ? ` - ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : '';
  return `${day} ${month}${time}`;
}

export function computeDashboardStats(
  properties: Property[],
  rentsThisMonth: Rent[]
): DashboardStats {
  const occupiedProperties = properties.filter(p => p.status === 'occupied');
  const occupancyRate =
    properties.length > 0
      ? Math.round((occupiedProperties.length / properties.length) * 100 * 10) / 10
      : 0;

  const paidRents = rentsThisMonth.filter(r => r.status === 'paid');
  const pendingRents = rentsThisMonth.filter(r => r.status === 'pending' || r.status === 'late');

  return {
    totalProperties: properties.length,
    occupancyRate,
    monthlyRevenue: paidRents.reduce((sum, r) => sum + r.amount, 0),
    pendingRents: pendingRents.length,
  };
}

export function buildRecentActivities(params: {
  rents: Rent[];
  leases: Lease[];
  inventories: Inventory[];
  communications: Communication[];
  now?: Date;
}): DashboardActivityItem[] {
  const now = params.now ?? new Date();

  const rentActivities: RawActivity[] = params.rents
    .map(r => {
      const meta = { amount: (r as any).paidAmount ?? r.amount, status: r.status };
      return {
        id: `rent-${r.id}`,
        type: r.status === 'paid' || (r as any).paidDate ? 'payment' : 'rent',
        date:
          parseDate((r as any).paidDate ?? null) ??
          parseDate((r as any).dueDate ?? null) ??
          parseDate((r as any).updatedAt ?? null) ??
          parseDate((r as any).createdAt ?? null) ??
          null,
        title: r.status === 'paid' || (r as any).paidDate ? 'Paiement reçu' : 'Échéance loyer',
        description: `Loyer - ${r.amount.toLocaleString('fr-FR')} €`,
        meta,
      };
    })
    .filter(a => a.date !== null);

  const leaseActivities: RawActivity[] = params.leases.map(l => ({
    id: `lease-${l.id}`,
    type: 'lease',
    date:
      parseDate((l as any).createdAt ?? null) ?? parseDate((l as any).startDate ?? null) ?? null,
    title: 'Nouveau bail signé',
    description: `Propriété #${l.propertyId} - ${l.tenantIds?.length ?? 1} locataire(s)`,
    meta: { leaseId: l.id },
  }));

  const inventoryActivities: RawActivity[] = params.inventories.map(inv => ({
    id: `inventory-${inv.id}`,
    type: 'inventory',
    date: parseDate((inv as any).date ?? null) ?? parseDate((inv as any).createdAt ?? null) ?? null,
    title: inv.type === 'checkin' ? "État des lieux d'entrée" : 'État des lieux de sortie',
    description: `Lease #${inv.leaseId}`,
    meta: { inventoryId: inv.id },
  }));

  const communicationActivities: RawActivity[] = params.communications.map(c => ({
    id: `comm-${c.id}`,
    type: 'message',
    date: parseDate((c as any).date ?? null) ?? parseDate((c as any).createdAt ?? null) ?? null,
    title: (c as any).subject ?? ((c as any).type === 'meeting' ? 'Rendez-vous' : 'Communication'),
    description: (c as any).content ?? '',
    meta: { communicationId: (c as any).id },
  }));

  const allActivities: RawActivity[] = [
    ...rentActivities,
    ...leaseActivities,
    ...inventoryActivities,
    ...communicationActivities,
  ];

  allActivities.sort((a, b) => {
    const da = a.date ? a.date.getTime() : 0;
    const db = b.date ? b.date.getTime() : 0;
    return db - da;
  });

  return allActivities.slice(0, 6).map(a => {
    const date = a.date ?? now;
    const base: DashboardActivityItem = {
      id: a.id,
      type: a.type as DashboardActivityItem['type'],
      title: a.title,
      description: a.description,
      time: formatRelativeTime(date, now),
      icon: 'clock-outline',
      iconColor: '#6b7280',
    };

    if (a.type === 'payment') {
      const meta = a.meta as any;
      base.badge = {
        label: `${(meta?.amount ?? 0).toLocaleString('fr-FR')} €`,
        variant: 'success',
      };
      base.icon = 'currency-eur';
      base.iconColor = '#22c55e';
    } else if (a.type === 'lease') {
      base.badge = { label: 'Nouveau', variant: 'primary' };
      base.icon = 'file-document';
      base.iconColor = '#4f46e5';
    } else if (a.type === 'inventory') {
      base.icon = 'clipboard-check';
      base.iconColor = '#14b8a6';
    } else if (a.type === 'message') {
      base.icon = 'email-outline';
      base.iconColor = '#0ea5e9';
    }

    return base;
  });
}

export function buildUpcomingEvents(params: {
  rents: Rent[];
  inventories: Inventory[];
  communications: Communication[];
  now?: Date;
}): DashboardEventItem[] {
  const now = params.now ?? new Date();
  const in30 = new Date(now.getTime());
  in30.setDate(now.getDate() + 30);

  const upcomingRents = params.rents
    .map(r => ({ due: parseDate((r as any).dueDate ?? null), r }))
    .filter(x => x.due && x.due >= now && x.due <= in30)
    .map(x => ({
      id: `up-rent-${x.r.id}`,
      date: x.due as Date,
      title: 'Échéance loyer',
      description: `${x.r.amount.toLocaleString('fr-FR')} € - Bail #${x.r.leaseId}`,
    }));

  const upcomingInventories = params.inventories
    .map(i => ({ date: parseDate((i as any).date ?? null), i }))
    .filter(x => x.date && x.date >= now)
    .map(x => ({
      id: `up-inv-${x.i.id}`,
      date: x.date as Date,
      title: x.i.type === 'checkin' ? 'État des lieux entrée' : 'État des lieux sortie',
      description: `Lease #${x.i.leaseId}`,
    }));

  const upcomingMeetings = params.communications
    .map(c => ({ date: parseDate((c as any).date ?? null), c }))
    .filter(x => (x.c as any).type === 'meeting' && x.date && x.date >= now)
    .map(x => ({
      id: `up-comm-${(x.c as any).id}`,
      date: x.date as Date,
      title: (x.c as any).subject ?? 'Visite appartement',
      description: (x.c as any).content ?? '',
    }));

  const combinedUpcoming = [...upcomingRents, ...upcomingInventories, ...upcomingMeetings];
  combinedUpcoming.sort((a, b) => a.date.getTime() - b.date.getTime());

  return combinedUpcoming.slice(0, 6).map(e => ({
    id: e.id,
    date: formatEventDate(e.date),
    title: e.title,
    description: e.description,
  }));
}
