import type { Lease, Property, Rent } from '@/db/types';

export type VirtualRent = {
  id: string;
  leaseId: number;
  dueDate: Date;
  amount: number;
  charges: number;
  status: 'pending';
  isVirtual: true;
};

export function buildPaidRentUpdates(paidDate?: Date): Partial<Rent> {
  return {
    status: 'paid',
    paidDate: paidDate ?? new Date(),
  };
}

export function computeOverdueRentIds(rents: Rent[], now = new Date()): number[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return rents
    .filter(r => {
      if (r.status === 'paid') return false;
      const dueDate = new Date(r.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    })
    .map(r => r.id)
    .filter((id): id is number => typeof id === 'number');
}

// Generate virtual pending rents from active leases when no rent exists for the month
export function generateVirtualRents(params: {
  leases: Lease[];
  existingRents: Rent[];
  referenceDate?: Date;
}): VirtualRent[] {
  const activeLeases = params.leases.filter(l => l.status === 'active');
  const today = new Date(params.referenceDate ?? new Date());
  today.setHours(0, 0, 0, 0);

  return activeLeases
    .map(lease => {
      const paymentDay = (lease as any).paymentDay || 1;
      const candidate = new Date(today.getFullYear(), today.getMonth(), paymentDay);
      if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);

      const exists = params.existingRents.some(r => {
        if (r.leaseId !== lease.id) return false;
        const d = new Date(r.dueDate);
        return d.getFullYear() === candidate.getFullYear() && d.getMonth() === candidate.getMonth();
      });

      if (exists) return null;

      return {
        id: `virtual-${String(lease.id)}-${candidate.getFullYear()}-${candidate.getMonth()}`,
        leaseId: lease.id as number,
        dueDate: candidate,
        amount: Number((lease as any).rent) || 0,
        charges: Number((lease as any).charges) || 0,
        status: 'pending',
        isVirtual: true,
      } satisfies VirtualRent;
    })
    .filter((v): v is VirtualRent => v !== null);
}

export function buildCalendarEvents(params: {
  rents: Rent[];
  leases: Lease[];
  properties: Property[];
}): any[] {
  const real = params.rents.map((rent: Rent) => {
    const lease = params.leases.find(l => l.id === rent.leaseId);
    const property = lease ? params.properties.find(p => p.id === lease.propertyId) : null;
    const calendarStatus =
      rent.status === 'late' ? 'overdue' : rent.status === 'partial' ? 'pending' : rent.status;

    const id = `${rent.id ?? 'r'}-${rent.leaseId}-${new Date(rent.dueDate).setHours(0, 0, 0, 0)}`;

    return {
      id,
      rentId: rent.id,
      leaseId: rent.leaseId,
      date: new Date(rent.dueDate),
      title: property?.name || 'Bien inconnu',
      status: calendarStatus as 'pending' | 'paid' | 'overdue',
      // Keep `amount` for backward compatibility (total = rent + charges)
      amount: (Number(rent.amount) || 0) + (Number((rent as any).charges) || 0),
      // Expose separate fields so the UI can display them in dedicated columns
      rentAmount: Number(rent.amount) || 0,
      charges: Number((rent as any).charges) || 0,
      isVirtual: false,
    } as any;
  });

  const virtual = generateVirtualRents({
    leases: params.leases,
    existingRents: params.rents,
  });

  const virtualEvents = virtual.map(v => {
    const lease = params.leases.find(l => l.id === v.leaseId);
    const property = lease ? params.properties.find(p => p.id === lease.propertyId) : null;
    const id = `${String(v.id)}-${v.leaseId}-${new Date(v.dueDate).setHours(0, 0, 0, 0)}`;
    return {
      id,
      rentId: undefined,
      leaseId: v.leaseId,
      date: new Date(v.dueDate),
      title: property?.name || 'Bien inconnu',
      status: 'pending' as const,
      // Keep `amount` (total) for backward compatibility
      amount: (Number(v.amount) || 0) + (Number(v.charges) || 0),
      // Separate fields for UI columns
      rentAmount: Number(v.amount) || 0,
      charges: Number(v.charges) || 0,
      isVirtual: true,
    } as any;
  });

  return [...real, ...virtualEvents];
}
