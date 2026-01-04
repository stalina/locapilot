<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
// stores not required here; removed unused imports to satisfy tsc
// import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
// import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
// import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import StatCard from '@/shared/components/StatCard.vue';
import Button from '@/shared/components/Button.vue';
import Badge from '@/shared/components/Badge.vue';
import { useDashboardStore } from '../stores/dashboardStore';

const router = useRouter();
const dashboardStore = useDashboardStore();

const stats = computed(() => dashboardStore.stats);
const recentActivities = computed(() => dashboardStore.recentActivities);
const upcomingEvents = computed(() => dashboardStore.upcomingEvents);
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
  await dashboardStore.loadDashboardData();
});

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
