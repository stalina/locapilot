<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
// stores not required here; removed unused imports to satisfy tsc
// import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
// import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
// import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import StatCard from '@/shared/components/StatCard.vue';
import Button from '@/shared/components/Button.vue';
import Badge from '@/shared/components/Badge.vue';
import { db } from '@/db/database';

function parseDate(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return input;
  // Dexie/IndexedDB sometimes stores ISO strings
  const parsed = new Date(input);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// Stats
const stats = ref({
  totalProperties: 0,
  occupancyRate: 0,
  monthlyRevenue: 0,
  pendingRents: 0,
});

// Activities
const recentActivities = ref<
  Array<{
    id: string;
    type: 'payment' | 'lease' | 'inventory' | 'message';
    title: string;
    description: string;
    time: string;
    badge?: { label: string; variant: 'success' | 'primary' | 'warning' };
    icon: string;
    iconColor: string;
  }>
>([]);

// Events
const upcomingEvents = ref<
  Array<{
    id: string;
    date: string;
    title: string;
    description: string;
  }>
>([]);

const router = useRouter();
// stores are not used directly in this view; navigation delegates to feature views
// const propertiesStore = usePropertiesStore();
// const tenantsStore = useTenantsStore();
// const leasesStore = useLeasesStore();

// quick action handlers
function openNewProperty() {
  // navigate to properties view and open modal via query param
  router.push({ path: '/properties', query: { open: 'propertyForm' } });
}

function openNewTenant() {
  router.push({ path: '/tenants', query: { open: 'tenantForm' } });
}

function openNewLease() {
  router.push({ path: '/leases', query: { open: 'leaseForm' } });
}

function openRents() {
  // navigate to rents view where quittance can be generated
  router.push('/rents');
}

onMounted(async () => {
  await loadDashboardData();
});

async function loadDashboardData() {
  try {
    // Load properties stats
    const properties = await db.properties.toArray();
    stats.value.totalProperties = properties.length;

    const occupiedProperties = properties.filter(p => p.status === 'occupied');
    stats.value.occupancyRate =
      properties.length > 0
        ? Math.round((occupiedProperties.length / properties.length) * 100 * 10) / 10
        : 0;

    // Load rents stats
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const rents = await db.rents
      .where('dueDate')
      .between(new Date(currentYear, currentMonth, 1), new Date(currentYear, currentMonth + 1, 0))
      .toArray();

    const paidRents = rents.filter(r => r.status === 'paid');
    const pendingRents = rents.filter(r => r.status === 'pending' || r.status === 'late');

    stats.value.monthlyRevenue = paidRents.reduce((sum, r) => sum + r.amount, 0);
    stats.value.pendingRents = pendingRents.length;

    // Build recent activities from DB tables: rents (payments), leases (new), inventories, communications
    const [allRents, allLeases, allInventories, allCommunications] = await Promise.all([
      db.rents.toArray(),
      db.leases.toArray(),
      db.inventories.toArray(),
      db.communications.toArray(),
    ]);

    console.debug('dashboard debug - counts', {
      rents: allRents.length,
      leases: allLeases.length,
      inventories: allInventories.length,
      communications: allCommunications.length,
    });

    // Normalize into common activity items with a `date` for sorting
    type RawActivity = {
      id: string;
      type: string;
      date: Date | null;
      title: string;
      description: string;
      meta?: any;
    };

    const rentActivities: RawActivity[] = allRents
      .map(r => ({
        id: `rent-${r.id}`,
        type: r.status === 'paid' || r.paidDate ? 'payment' : 'rent',
        date:
          parseDate((r.paidDate as any) ?? null) ??
          parseDate((r.dueDate as any) ?? null) ??
          parseDate((r.updatedAt as any) ?? null) ??
          parseDate((r.createdAt as any) ?? null) ??
          null,
        title: r.status === 'paid' || r.paidDate ? 'Paiement reçu' : 'Échéance loyer',
        description: `Loyer - ${r.amount.toLocaleString('fr-FR')} €`,
        meta: { amount: r.paidAmount ?? r.amount, status: r.status },
      }))
      .filter(a => a.date !== null);

    const leaseActivities: RawActivity[] = allLeases.map(l => ({
      id: `lease-${l.id}`,
      type: 'lease',
      date:
        parseDate((l.createdAt as any) ?? null) ?? parseDate((l.startDate as any) ?? null) ?? null,
      title: 'Nouveau bail signé',
      description: `Propriété #${l.propertyId} - ${l.tenantIds?.length ?? 1} locataire(s)`,
      meta: { leaseId: l.id },
    }));

    const inventoryActivities: RawActivity[] = allInventories.map(inv => ({
      id: `inventory-${inv.id}`,
      type: 'inventory',
      date:
        parseDate((inv.date as any) ?? null) ?? parseDate((inv.createdAt as any) ?? null) ?? null,
      title: inv.type === 'checkin' ? "État des lieux d'entrée" : 'État des lieux de sortie',
      description: `Lease #${inv.leaseId}`,
      meta: { inventoryId: inv.id },
    }));

    const communicationActivities: RawActivity[] = allCommunications.map(c => ({
      id: `comm-${c.id}`,
      type: 'message',
      date: parseDate((c.date as any) ?? null) ?? parseDate((c.createdAt as any) ?? null) ?? null,
      title: c.subject ?? (c.type === 'meeting' ? 'Rendez-vous' : 'Communication'),
      description: c.content ?? '',
      meta: { communicationId: c.id },
    }));

    const allActivities: RawActivity[] = [
      ...rentActivities,
      ...leaseActivities,
      ...inventoryActivities,
      ...communicationActivities,
    ];

    allActivities.sort((a, b) => {
      const da = a.date ? a.date.getTime() : 0;
      const dbt = b.date ? b.date.getTime() : 0;
      return dbt - da;
    });

    // Map to view model, limit to 6
    recentActivities.value = allActivities.slice(0, 6).map(a => {
      const date = a.date ?? new Date();
      const base: any = {
        id: a.id,
        type: a.type as any,
        title: a.title,
        description: a.description,
        time: formatRelativeTime(date),
        icon: 'clock-outline',
        iconColor: '#6b7280',
      };

      if (a.type === 'payment') {
        base.badge = {
          label: `${(a.meta?.amount ?? 0).toLocaleString('fr-FR')} €`,
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

    // Build upcoming events: next 30 days rents due, upcoming inventories and meetings
    const now = new Date();
    const in30 = new Date(now.getTime());
    in30.setDate(now.getDate() + 30);

    const upcomingRents = allRents
      .map(r => ({ due: parseDate((r.dueDate as any) ?? null), r }))
      .filter(x => x.due && x.due >= now && x.due <= in30)
      .map(x => ({
        id: `up-rent-${x.r.id}`,
        date: x.due as Date,
        title: 'Échéance loyer',
        description: `${x.r.amount.toLocaleString('fr-FR')} € - Bail #${x.r.leaseId}`,
      }));

    const upcomingInventories = allInventories
      .map(i => ({ date: parseDate((i.date as any) ?? null), i }))
      .filter(x => x.date && x.date >= now)
      .map(x => ({
        id: `up-inv-${x.i.id}`,
        date: x.date as Date,
        title: x.i.type === 'checkin' ? 'État des lieux entrée' : 'État des lieux sortie',
        description: `Lease #${x.i.leaseId}`,
      }));

    const upcomingMeetings = allCommunications
      .map(c => ({ date: parseDate((c.date as any) ?? null), c }))
      .filter(x => x.c.type === 'meeting' && x.date && x.date >= now)
      .map(x => ({
        id: `up-comm-${x.c.id}`,
        date: x.date as Date,
        title: x.c.subject ?? 'Visite appartement',
        description: x.c.content ?? '',
      }));

    const combinedUpcoming = [...upcomingRents, ...upcomingInventories, ...upcomingMeetings];
    combinedUpcoming.sort((a, b) => a.date.getTime() - b.date.getTime());

    upcomingEvents.value = combinedUpcoming.slice(0, 6).map(e => ({
      id: e.id,
      date: formatEventDate(e.date),
      title: e.title,
      description: e.description,
    }));

    // Note: removed hardcoded mock events so events come from the database
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
}

function formatRelativeTime(d: Date) {
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `Il y a ${diff} s`;
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  return `Il y a ${days} jour${days > 1 ? 's' : ''}`;
}

function formatEventDate(d: Date) {
  const day = d.getDate();
  const month = d.toLocaleString('fr-FR', { month: 'short' }).toUpperCase();
  const hh = d.getHours();
  const mm = d.getMinutes();
  const time = hh || mm ? ` - ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : '';
  return `${day} ${month}${time}`;
}

function handleActivityClick(activity: any) {
  // Map activity types to relevant routes
  if (activity.type === 'payment') {
    router.push('/rents');
  } else if (activity.type === 'lease') {
    router.push('/leases');
  } else if (activity.type === 'inventory') {
    router.push('/inventories');
  } else {
    router.push('/activity');
  }
}

function handleEventClick(event: any) {
  // For simplicity, navigate to leases view for visits or to rents for due dates
  if (event.title && event.title.toLowerCase().includes('visite')) {
    router.push('/leases');
  } else if (event.title && event.title.toLowerCase().includes('échéance')) {
    router.push('/rents');
  } else {
    router.push('/');
  }
}
</script>

<template>
  <div class="dashboard">
    <!-- Header -->
    <header class="dashboard-header">
      <div>
        <h1>Tableau de bord</h1>
        <div class="header-meta">
          <i class="mdi mdi-calendar"></i>
          {{
            new Date().toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          }}
        </div>
      </div>
      <div class="header-actions">
        <Button variant="outline" icon="bell"> 3 notifications </Button>
      </div>
    </header>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <StatCard
        label="Total des propriétés"
        :value="stats.totalProperties"
        icon="home-city"
        icon-color="primary"
        :trend="{ value: 2, direction: 'up' }"
      >
        <template #trend-label>ce mois</template>
      </StatCard>

      <StatCard
        label="Taux d'occupation"
        :value="`${stats.occupancyRate}%`"
        icon="check-circle"
        icon-color="success"
        :trend="{ value: 5.2, direction: 'up' }"
      />

      <StatCard
        label="Revenus mensuels"
        :value="`${stats.monthlyRevenue.toLocaleString('fr-FR')} €`"
        icon="currency-eur"
        icon-color="accent"
        :trend="{ value: 1250, direction: 'up' }"
      >
        <template #trend-label>ce mois</template>
      </StatCard>

      <StatCard
        label="Loyers en attente"
        :value="stats.pendingRents"
        icon="clock-alert"
        icon-color="warning"
        :trend="{ value: 3, direction: 'down' }"
      />
    </div>

    <!-- Content Grid -->
    <div class="content-grid">
      <!-- Recent Activity -->
      <section class="section-card">
        <div class="section-header">
          <h2 class="section-title">
            <i class="mdi mdi-history"></i>
            Activité récente
          </h2>
          <router-link to="/activity" class="section-link">
            Voir tout
            <i class="mdi mdi-arrow-right"></i>
          </router-link>
        </div>

        <div class="activity-list">
          <div v-if="recentActivities.length === 0" class="empty-list">Aucune activité récente</div>
          <div
            v-else
            v-for="activity in recentActivities"
            :key="activity.id"
            class="activity-item"
            @click="handleActivityClick(activity)"
          >
            <div
              class="activity-icon"
              :style="{ background: `${activity.iconColor}22`, color: activity.iconColor }"
            >
              <i :class="`mdi mdi-${activity.icon}`"></i>
            </div>
            <div class="activity-content">
              <div class="activity-title">{{ activity.title }}</div>
              <div class="activity-meta">{{ activity.description }}</div>
              <div class="activity-time">{{ activity.time }}</div>
            </div>
            <Badge v-if="activity.badge" :variant="activity.badge.variant">
              {{ activity.badge.label }}
            </Badge>
          </div>
        </div>
      </section>

      <!-- Upcoming Events -->
      <section class="section-card">
        <div class="section-header">
          <h2 class="section-title">
            <i class="mdi mdi-calendar-clock"></i>
            À venir
          </h2>
        </div>

        <div class="event-list">
          <div v-if="upcomingEvents.length === 0" class="empty-list">Aucun événement à venir</div>
          <div
            v-else
            v-for="event in upcomingEvents"
            :key="event.id"
            class="event-item"
            @click="handleEventClick(event)"
          >
            <div class="event-date">{{ event.date }}</div>
            <div class="event-title">{{ event.title }}</div>
            <div class="event-description">{{ event.description }}</div>
          </div>
        </div>

        <div class="quick-actions">
          <Button variant="outline" icon="plus" size="sm" @click="openNewProperty">
            Nouvelle propriété
          </Button>
          <Button variant="outline" icon="account-plus" size="sm" @click="openNewTenant">
            Nouveau locataire
          </Button>
          <Button variant="outline" icon="file-plus" size="sm" @click="openNewLease">
            Nouveau bail
          </Button>
          <Button variant="outline" icon="receipt" size="sm" @click="openRents">
            Générer quittance
          </Button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Styles spécifiques au dashboard */
/* Les styles communs sont dans views.css */
</style>
