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

    // Load recent activities (mock data for now)
    recentActivities.value = [
      {
        id: '1',
        type: 'payment',
        title: 'Paiement reçu',
        description: 'Loyer novembre - 123 Rue de la Paix - Jean Dupont',
        time: 'Il y a 2 heures',
        badge: { label: '1 250 €', variant: 'success' },
        icon: 'currency-eur',
        iconColor: '#22c55e',
      },
      {
        id: '2',
        type: 'lease',
        title: 'Nouveau bail signé',
        description: '45 Avenue Mozart - Marie Martin',
        time: 'Hier à 14:30',
        badge: { label: 'Nouveau', variant: 'primary' },
        icon: 'file-document',
        iconColor: '#4f46e5',
      },
      {
        id: '3',
        type: 'inventory',
        title: 'État des lieux complété',
        description: "78 Boulevard Haussmann - État d'entrée",
        time: 'Il y a 2 jours',
        icon: 'clipboard-check',
        iconColor: '#14b8a6',
      },
    ];

    // Load upcoming events (mock data)
    upcomingEvents.value = [
      {
        id: '1',
        date: '25 NOV - 10:00',
        title: 'Visite appartement',
        description: '12 Rue Victor Hugo - 3 candidats',
      },
      {
        id: '2',
        date: '28 NOV - 14:30',
        title: 'État des lieux sortie',
        description: '89 Avenue de la République',
      },
      {
        id: '3',
        date: '30 NOV',
        title: 'Échéance loyer',
        description: '8 propriétés - Envoi des quittances',
      },
    ];
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
  }
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
          <div
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
          <div
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
