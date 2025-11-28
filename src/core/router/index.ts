import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@features/dashboard/views/DashboardView.vue'),
    meta: { title: 'Tableau de bord' },
  },
  {
    path: '/properties',
    name: 'properties',
    component: () => import('@features/properties/views/PropertiesView.vue'),
    meta: { title: 'Propriétés' },
  },
  {
    path: '/properties/:id',
    name: 'property-detail',
    component: () => import('@features/properties/views/PropertyDetailView.vue'),
    meta: { title: 'Détail Propriété' },
  },
  {
    path: '/tenants',
    name: 'tenants',
    component: () => import('@features/tenants/views/TenantsView.vue'),
    meta: { title: 'Locataires' },
  },
  {
    path: '/tenants/:id',
    name: 'tenant-detail',
    component: () => import('@features/tenants/views/TenantDetailView.vue'),
    meta: { title: 'Détail Locataire' },
  },
  {
    path: '/leases',
    name: 'leases',
    component: () => import('@features/leases/views/LeasesView.vue'),
    meta: { title: 'Baux' },
  },
  {
    path: '/leases/:id',
    name: 'lease-detail',
    component: () => import('@features/leases/views/LeaseDetailView.vue'),
    meta: { title: 'Détail Bail' },
  },
  {
    path: '/rents',
    name: 'rents',
    component: () => import('@features/rents/views/RentsView.vue'),
    meta: { title: 'Loyers' },
  },
  {
    path: '/rents/calendar',
    name: 'rents-calendar',
    component: () => import('@features/rents/views/RentsCalendarView.vue'),
    meta: { title: 'Calendrier des Loyers' },
  },
  {
    path: '/documents',
    name: 'documents',
    component: () => import('@features/documents/views/DocumentsView.vue'),
    meta: { title: 'Documents' },
  },
  {
    path: '/inventories',
    name: 'inventories',
    component: () => import('@features/inventories/views/InventoriesView.vue'),
    meta: { title: 'États des lieux' },
  },
  {
    path: '/inventories/:id',
    name: 'inventory-detail',
    component: () => import('@features/inventories/views/InventoryDetailView.vue'),
    meta: { title: 'Détail État des lieux' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/features/settings/views/SettingsView.vue'),
    meta: { title: 'Paramètres' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@core/views/NotFoundView.vue'),
    meta: { title: 'Page non trouvée' },
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Update page title on route change
router.afterEach(to => {
  const title = (to.meta.title as string) || 'Locapilot';
  document.title = `${title} - Locapilot`;
});

export default router;
