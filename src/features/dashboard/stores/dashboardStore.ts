import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchDashboardRawData } from '../repositories/dashboardRepository';
import { useSettingsStore } from '@/features/settings/stores/settingsStore';
import {
  buildRecentActivities,
  buildUpcomingEvents,
  computeDashboardStats,
  type DashboardActivityItem,
  type DashboardEventItem,
  type DashboardStats,
} from '../services/dashboardService';
import { computeDashboardAlerts, type DashboardAlert } from '../services/dashboardAlertsService';
import { computeActionSchedule, type ScheduleItem } from '../services/dashboardScheduleService';

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<DashboardStats>({
    totalProperties: 0,
    occupancyRate: 0,
    monthlyRevenue: 0,
    pendingRents: 0,
    rentsNeedingReminder: 0,
  });

  const recentActivities = ref<DashboardActivityItem[]>([]);
  const upcomingEvents = ref<DashboardEventItem[]>([]);
  const alerts = ref<DashboardAlert[]>([]);
  const scheduleItems = ref<ScheduleItem[]>([]);

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function loadDashboardData(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const now = new Date();
      const raw = await fetchDashboardRawData(now);
      const settingsStore = useSettingsStore();
      await settingsStore.loadSettings();

      stats.value = computeDashboardStats(raw.properties, raw.rentsThisMonth, {
        allRents: raw.allRents,
        reminders: raw.allReminders,
        thresholds: settingsStore.reminderThresholds,
        now,
      });
      recentActivities.value = buildRecentActivities({
        rents: raw.allRents,
        leases: raw.allLeases,
        inventories: raw.allInventories,
        communications: raw.allCommunications,
        now,
      });
      upcomingEvents.value = buildUpcomingEvents({
        rents: raw.allRents,
        inventories: raw.allInventories,
        communications: raw.allCommunications,
        now,
      });
      alerts.value = computeDashboardAlerts({
        leases: raw.allLeases,
        properties: raw.properties,
        rents: raw.allRents,
        documents: raw.diagnosticDocuments,
        now,
      });
      scheduleItems.value = computeActionSchedule({
        leases: raw.allLeases,
        properties: raw.properties,
        revisions: raw.allRentRevisions,
        adjustments: raw.allChargesAdjustments,
        inventories: raw.allInventories,
        now,
      });
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
      error.value = 'Failed to load dashboard data';
    } finally {
      isLoading.value = false;
    }
  }

  return {
    stats,
    recentActivities,
    upcomingEvents,
    alerts,
    scheduleItems,
    isLoading,
    error,
    loadDashboardData,
  };
});
