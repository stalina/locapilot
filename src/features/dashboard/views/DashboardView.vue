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
import type { DashboardAlert } from '../services/dashboardAlertsService';
import type { ScheduleItem } from '../services/dashboardScheduleService';
import MiniLineChart from '../components/MiniLineChart.vue';
import MiniBarChart from '../components/MiniBarChart.vue';

const router = useRouter();
const dashboardStore = useDashboardStore();

const stats = computed(() => dashboardStore.stats);
const recentActivities = computed(() => dashboardStore.recentActivities);
const upcomingEvents = computed(() => dashboardStore.upcomingEvents);
const alerts = computed(() => dashboardStore.alerts);
const scheduleItems = computed(() => dashboardStore.scheduleItems);
const revenueSeries = computed(() => dashboardStore.revenueSeries);
const occupancySeries = computed(() => dashboardStore.occupancySeries);
const revenuePerProperty = computed(() => dashboardStore.revenuePerProperty);
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

function handleAlertClick(alert: DashboardAlert) {
  router.push(alert.link);
}

function handleScheduleClick(item: ScheduleItem) {
  router.push(item.link);
}

function formatScheduleDate(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

    <!-- Alerts Banner -->
    <div v-if="alerts.length > 0" class="alerts-banner" data-testid="dashboard-alerts">
      <button
        v-for="alert in alerts"
        :key="alert.id"
        type="button"
        class="alert-item"
        :class="`alert-${alert.severity}`"
        :data-testid="`dashboard-alert-${alert.severity}`"
        @click="handleAlertClick(alert)"
      >
        <i
          class="mdi alert-icon"
          :class="alert.severity === 'critical' ? 'mdi-alert-circle' : 'mdi-alert'"
        ></i>
        <span class="alert-text">
          <span class="alert-title">{{ alert.title }}</span>
          <span class="alert-description">{{ alert.description }}</span>
        </span>
        <i class="mdi mdi-chevron-right alert-chevron"></i>
      </button>
    </div>

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

      <StatCard
        label="Relances à envoyer"
        :value="stats.rentsNeedingReminder"
        icon="bell-alert"
        icon-color="error"
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

    <!-- Échéancier -->
    <section class="section-card schedule-section" data-testid="dashboard-schedule">
      <div class="section-header">
        <h2 class="section-title">
          <i class="mdi mdi-calendar-check"></i>
          Échéancier
        </h2>
      </div>

      <div class="schedule-list">
        <div v-if="scheduleItems.length === 0" class="empty-list">Aucune action à venir</div>
        <div
          v-else
          v-for="item in scheduleItems"
          :key="item.id"
          class="schedule-item"
          data-testid="dashboard-schedule-item"
          @click="handleScheduleClick(item)"
        >
          <div class="schedule-date">{{ formatScheduleDate(item.date) }}</div>
          <div class="schedule-content">
            <div class="schedule-title">{{ item.title }}</div>
            <div class="schedule-description">{{ item.description }}</div>
          </div>
          <i class="mdi mdi-chevron-right schedule-chevron"></i>
        </div>
      </div>
    </section>

    <!-- Analyse -->
    <section class="section-card analyse-section" data-testid="dashboard-analyse">
      <div class="section-header">
        <h2 class="section-title">
          <i class="mdi mdi-chart-line"></i>
          Analyse
        </h2>
      </div>

      <div class="charts-grid">
        <!-- Revenue / cash-flow curve -->
        <div class="chart-card" data-testid="dashboard-chart-revenue">
          <h3 class="chart-title">Trésorerie (12 derniers mois)</h3>
          <div
            v-if="revenueSeries.length === 0"
            class="empty-list"
            data-testid="dashboard-chart-revenue-empty"
          >
            Pas encore de données à analyser
          </div>
          <MiniLineChart v-else :points="revenueSeries" suffix=" €" color="#22c55e" />
        </div>

        <!-- Occupancy-rate evolution -->
        <div class="chart-card" data-testid="dashboard-chart-occupancy">
          <h3 class="chart-title">Évolution du taux d'occupation</h3>
          <div
            v-if="occupancySeries.length === 0"
            class="empty-list"
            data-testid="dashboard-chart-occupancy-empty"
          >
            Pas encore de données à analyser
          </div>
          <MiniLineChart v-else :points="occupancySeries" suffix=" %" color="#4f46e5" />
        </div>

        <!-- Revenue per property -->
        <div class="chart-card" data-testid="dashboard-chart-per-property">
          <h3 class="chart-title">Répartition des revenus par bien</h3>
          <div
            v-if="revenuePerProperty.length === 0"
            class="empty-list"
            data-testid="dashboard-chart-per-property-empty"
          >
            Pas encore de données à analyser
          </div>
          <MiniBarChart v-else :items="revenuePerProperty" suffix=" €" color="#0ea5e9" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Styles spécifiques au dashboard */
/* Les styles communs sont dans views.css */

/* --- Alerts banner --- */
.alerts-banner {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-lg, 0.75rem);
  border: 1px solid transparent;
  background: none;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.alert-item:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
}

.alert-critical {
  background: var(--error-50, #fef2f2);
  border-color: var(--error-200, #fecaca);
  color: var(--error-700, #b91c1c);
}

.alert-warning {
  background: var(--warning-50, #fffbeb);
  border-color: var(--warning-200, #fde68a);
  color: var(--warning-700, #b45309);
}

.alert-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.alert-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.alert-title {
  font-weight: 700;
  font-size: 0.9375rem;
}

.alert-description {
  font-size: 0.875rem;
  opacity: 0.85;
}

.alert-chevron {
  font-size: 1.25rem;
  flex-shrink: 0;
}

/* --- Échéancier --- */
.schedule-section {
  margin-top: 1.5rem;
}

.schedule-list {
  display: flex;
  flex-direction: column;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  cursor: pointer;
  transition: background var(--transition-base, 0.2s ease);
}

.schedule-item:last-child {
  border-bottom: none;
}

.schedule-item:hover {
  background: var(--bg-secondary, #f1f5f9);
}

.schedule-date {
  flex-shrink: 0;
  min-width: 7rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--primary-600, #4f46e5);
}

.schedule-content {
  flex: 1;
  min-width: 0;
}

.schedule-title {
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--text-primary, #0f172a);
}

.schedule-description {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
}

.schedule-chevron {
  color: var(--text-tertiary, #94a3b8);
  font-size: 1.25rem;
}

/* --- Analyse --- */
.analyse-section {
  margin-top: 1.5rem;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.chart-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  background: var(--bg-secondary, #f8fafc);
}

.chart-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}
</style>
