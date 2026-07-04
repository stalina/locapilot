/* eslint-env vitest */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia } from 'pinia';
import DashboardView from '@/features/dashboard/views/DashboardView.vue';
import { useDashboardStore } from '@/features/dashboard/stores/dashboardStore';
import type { DashboardAlert } from '@/features/dashboard/services/dashboardAlertsService';
import type { ScheduleItem } from '@/features/dashboard/services/dashboardScheduleService';

const pushMock = vi.fn();
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}));

function mountDashboard() {
  const pinia = createPinia();
  const wrapper = mount(DashboardView, {
    global: { plugins: [pinia], stubs: ['StatCard', 'Button', 'Badge', 'router-link'] },
  });
  const store = useDashboardStore(pinia);
  return { wrapper, store };
}

const sampleAlerts: DashboardAlert[] = [
  {
    id: 'arrears-1',
    severity: 'critical',
    title: 'Impayé critique',
    description: 'Loyer du 15 mars 2026 : 78 jours de retard',
    link: { path: '/rents' },
  },
  {
    id: 'lease-expiry-10',
    severity: 'warning',
    title: 'Fin de bail proche',
    description: 'Le bail de Studio Belleville se termine dans 19 jours',
    link: { path: '/leases/10' },
  },
];

const sampleSchedule: ScheduleItem[] = [
  {
    id: 'inventory-400',
    date: new Date('2026-06-10'),
    title: 'État des lieux de sortie',
    description: 'Studio Belleville',
    link: { path: '/inventories' },
  },
  {
    id: 'revision-10-2026',
    date: new Date('2026-06-15'),
    title: 'Réviser le loyer',
    description: 'Studio Belleville — révision IRL 2026',
    link: { path: '/indexation' },
  },
];

describe('DashboardView', () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it('renders heading and stats grid', async () => {
    const { wrapper } = mountDashboard();
    expect(wrapper.text()).toContain('Tableau de bord');
    // stats grid should exist
    expect(wrapper.find('.stats-grid').exists()).toBe(true);
  });

  it('hides the alerts banner when there is no alert', async () => {
    const { wrapper } = mountDashboard();
    await nextTick();
    expect(wrapper.find('[data-testid="dashboard-alerts"]').exists()).toBe(false);
  });

  it('renders alerts ordered with severity styling and navigates on click', async () => {
    const { wrapper, store } = mountDashboard();
    store.alerts = sampleAlerts;
    await nextTick();

    const banner = wrapper.find('[data-testid="dashboard-alerts"]');
    expect(banner.exists()).toBe(true);

    const items = banner.findAll('.alert-item');
    expect(items).toHaveLength(2);
    expect(items[0]!.classes()).toContain('alert-critical');
    expect(items[0]!.text()).toContain('Impayé critique');
    expect(items[1]!.classes()).toContain('alert-warning');
    expect(items[1]!.text()).toContain('Fin de bail proche');

    await items[1]!.trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ path: '/leases/10' });
  });

  it('renders the schedule empty state', async () => {
    const { wrapper } = mountDashboard();
    await nextTick();

    const schedule = wrapper.find('[data-testid="dashboard-schedule"]');
    expect(schedule.exists()).toBe(true);
    expect(schedule.text()).toContain('Échéancier');
    expect(schedule.text()).toContain('Aucune action à venir');
  });

  it('renders schedule items sorted by date and navigates on click', async () => {
    const { wrapper, store } = mountDashboard();
    store.scheduleItems = sampleSchedule;
    await nextTick();

    const items = wrapper.findAll('[data-testid="dashboard-schedule-item"]');
    expect(items).toHaveLength(2);
    expect(items[0]!.text()).toContain('État des lieux de sortie');
    expect(items[1]!.text()).toContain('Réviser le loyer');

    await items[0]!.trigger('click');
    expect(pushMock).toHaveBeenCalledWith({ path: '/inventories' });
  });
});
