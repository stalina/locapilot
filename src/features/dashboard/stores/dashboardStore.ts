import { defineStore } from 'pinia';
import { ref } from 'vue';
import { fetchDashboardRawData } from '../repositories/dashboardRepository';
import {
  buildRecentActivities,
  buildUpcomingEvents,
  computeDashboardStats,
  type DashboardActivityItem,
  type DashboardEventItem,
  type DashboardStats,
} from '../services/dashboardService';

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<DashboardStats>({
    totalProperties: 0,
    occupancyRate: 0,
    monthlyRevenue: 0,
    pendingRents: 0,
  });

  const recentActivities = ref<DashboardActivityItem[]>([]);
  const upcomingEvents = ref<DashboardEventItem[]>([]);

  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function loadDashboardData(): Promise<void> {
    isLoading.value = true;
    error.value = null;

    try {
      const now = new Date();
      const raw = await fetchDashboardRawData(now);

      stats.value = computeDashboardStats(raw.properties, raw.rentsThisMonth);
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
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
      error.value = 'Failed to load dashboard data';
    } finally {
      isLoading.value = false;
    }
  }

  return { stats, recentActivities, upcomingEvents, isLoading, error, loadDashboardData };
});
