<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useInventoriesStore } from '@/features/inventories/stores/inventoriesStore';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import Button from '@/shared/components/Button.vue';
import Card from '@/shared/components/Card.vue';
import Badge from '@/shared/components/Badge.vue';
import {
  compareInventories,
  computeWearReport,
  CONDITION_LABEL,
} from '@/features/inventories/services/inventoryComparison';
import type { ComparisonStatus } from '@/features/inventories/services/inventoryComparison';
import type { Tenant } from '@/db/types';

const route = useRoute();
const router = useRouter();
const inventoriesStore = useInventoriesStore();
const leasesStore = useLeasesStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();

const leaseId = Number(route.params.leaseId);
const isLoading = ref(true);

onMounted(async () => {
  await Promise.all([
    inventoriesStore.fetchInventories(),
    leasesStore.fetchLeases(),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
  ]);
  isLoading.value = false;
});

const leaseInventories = computed(() =>
  inventoriesStore.inventories.filter(i => i.leaseId === leaseId)
);
const checkin = computed(() => leaseInventories.value.find(i => i.type === 'checkin') ?? null);
const checkout = computed(() => leaseInventories.value.find(i => i.type === 'checkout') ?? null);

const lease = computed(() => leasesStore.leases.find(l => l.id === leaseId) ?? null);
const property = computed(() =>
  lease.value
    ? (propertiesStore.properties.find(p => p.id === lease.value!.propertyId) ?? null)
    : null
);
const tenantsNames = computed(() => {
  if (!lease.value) return '';
  return lease.value.tenantIds
    .map(id => tenantsStore.tenants.find(t => t.id === id))
    .filter((t): t is Tenant => !!t)
    .map(t => `${t.firstName} ${t.lastName}`)
    .join(', ');
});

const comparison = computed(() =>
  checkin.value && checkout.value ? compareInventories(checkin.value, checkout.value) : null
);
const wearReport = computed(() =>
  checkin.value && checkout.value ? computeWearReport(checkin.value, checkout.value) : null
);

const statusConfig: Record<ComparisonStatus, { label: string; class: string }> = {
  improved: { label: 'Amélioré', class: 'status-improved' },
  unchanged: { label: 'Identique', class: 'status-unchanged' },
  'normal-wear': { label: 'Usure normale', class: 'status-normal' },
  deterioration: { label: 'Dégradation', class: 'status-deterioration' },
  added: { label: 'Ajouté', class: 'status-added' },
  removed: { label: 'Manquant', class: 'status-removed' },
};

const formatDate = (date?: Date | string) =>
  date ? new Date(date).toLocaleDateString('fr-FR') : '—';

function handlePrint() {
  window.print();
}
function goBack() {
  router.push('/inventories');
}
</script>

<template>
  <div class="view-container comparison-view">
    <div v-if="isLoading" class="loading-state">
      <i class="mdi mdi-loading mdi-spin"></i> Chargement...
    </div>

    <template v-else>
      <header class="view-header no-print">
        <div>
          <div class="breadcrumb">
            <button @click="goBack" class="breadcrumb-link">
              <i class="mdi mdi-chevron-left"></i> États des lieux
            </button>
          </div>
          <h1>Comparaison entrée / sortie</h1>
          <div class="header-meta">{{ property?.name || 'Propriété inconnue' }}</div>
        </div>
        <div class="header-actions">
          <Button
            v-if="comparison"
            variant="primary"
            icon="printer"
            @click="handlePrint"
            data-testid="print-wear-report"
          >
            Imprimer le rapport
          </Button>
        </div>
      </header>

      <!-- Missing one of the two states -->
      <Card v-if="!comparison" class="missing-card">
        <div class="missing">
          <i class="mdi mdi-information-outline"></i>
          <div>
            <h3>Comparaison impossible</h3>
            <p>
              La comparaison nécessite un état d'entrée <strong>et</strong> un état de sortie pour
              ce bail.
            </p>
            <ul>
              <li>
                État d'entrée :
                <Badge :variant="checkin ? 'success' : 'danger'">
                  {{ checkin ? 'présent' : 'manquant' }}
                </Badge>
              </li>
              <li>
                État de sortie :
                <Badge :variant="checkout ? 'success' : 'danger'">
                  {{ checkout ? 'présent' : 'manquant' }}
                </Badge>
              </li>
            </ul>
          </div>
        </div>
      </Card>

      <template v-else>
        <!-- Report header (printable) -->
        <Card class="report-header">
          <h2 class="report-title">Rapport de comparaison d'état des lieux</h2>
          <div class="report-meta">
            <div><strong>Logement :</strong> {{ property?.name || '—' }}</div>
            <div v-if="property?.address"><strong>Adresse :</strong> {{ property.address }}</div>
            <div><strong>Locataire(s) :</strong> {{ tenantsNames || '—' }}</div>
            <div><strong>Entrée :</strong> {{ formatDate(checkin?.date) }}</div>
            <div><strong>Sortie :</strong> {{ formatDate(checkout?.date) }}</div>
          </div>
        </Card>

        <!-- Wear summary -->
        <Card class="summary-card">
          <h2 class="card-title"><i class="mdi mdi-clipboard-alert-outline"></i> Synthèse</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <span class="summary-value">{{ wearReport!.totalItems }}</span>
              <span class="summary-label">Éléments comparés</span>
            </div>
            <div class="summary-item">
              <span class="summary-value status-normal-text">{{
                comparison.counts['normal-wear']
              }}</span>
              <span class="summary-label">Usure normale</span>
            </div>
            <div class="summary-item">
              <span class="summary-value status-deterioration-text">{{
                wearReport!.deterioratedCount
              }}</span>
              <span class="summary-label">Dégradations anormales</span>
            </div>
          </div>
        </Card>

        <!-- Abnormal wear report -->
        <Card class="wear-card">
          <h2 class="card-title">
            <i class="mdi mdi-alert-octagon-outline"></i> Rapport d'usure anormale
          </h2>
          <p v-if="wearReport!.deterioratedCount === 0" class="no-wear">
            <i class="mdi mdi-check-circle-outline"></i>
            Aucune dégradation anormale détectée. Les écarts constatés relèvent de l'usure locative
            normale.
          </p>
          <table v-else class="comparison-table" data-testid="wear-report-table">
            <thead>
              <tr>
                <th>Pièce</th>
                <th>Élément</th>
                <th>Entrée</th>
                <th>Sortie</th>
                <th>Niveaux perdus</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(w, i) in wearReport!.items" :key="i" class="row-deterioration">
                <td>{{ w.room }}</td>
                <td>{{ w.item }}</td>
                <td>{{ CONDITION_LABEL[w.before] }}</td>
                <td>{{ CONDITION_LABEL[w.after] }}</td>
                <td class="drop-cell">−{{ w.drop }}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <!-- Full comparison -->
        <Card class="full-card">
          <h2 class="card-title"><i class="mdi mdi-table-eye"></i> Détail complet</h2>
          <table class="comparison-table" data-testid="comparison-table">
            <thead>
              <tr>
                <th>Pièce</th>
                <th>Élément</th>
                <th>Entrée</th>
                <th>Sortie</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in comparison.rows"
                :key="i"
                :class="{ 'row-deterioration': row.status === 'deterioration' }"
              >
                <td>{{ row.room }}</td>
                <td>{{ row.item }}</td>
                <td>{{ row.before ? CONDITION_LABEL[row.before] : '—' }}</td>
                <td>{{ row.after ? CONDITION_LABEL[row.after] : '—' }}</td>
                <td>
                  <span class="status-pill" :class="statusConfig[row.status].class">
                    {{ statusConfig[row.status].label }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </template>
    </template>
  </div>
</template>

<style scoped>
.comparison-view {
  max-width: 1000px;
  margin: 0 auto;
  padding: var(--space-6, 1.5rem);
}

.breadcrumb {
  margin-bottom: var(--space-2, 0.5rem);
}
.breadcrumb-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1, 0.25rem);
  color: var(--text-secondary, #64748b);
  font-size: var(--text-sm, 0.875rem);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.breadcrumb-link:hover {
  color: var(--primary-600, #4f46e5);
}

.report-header,
.summary-card,
.wear-card,
.full-card {
  margin-bottom: var(--space-6, 1.5rem);
}

.report-title {
  margin: 0 0 var(--space-3, 0.75rem);
  font-size: var(--text-xl, 1.25rem);
  color: var(--text-primary, #0f172a);
}
.report-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.card-title {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  margin: 0 0 var(--space-4, 1rem);
}
.card-title i {
  color: var(--primary-600, #4f46e5);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4, 1rem);
}
.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: var(--space-4, 1rem);
  background: var(--neutral-50, #f9fafb);
  border-radius: var(--radius-lg, 0.75rem);
}
.summary-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
}
.summary-label {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}
.status-normal-text {
  color: var(--warning-600, #d97706);
}
.status-deterioration-text {
  color: var(--error-600, #dc2626);
}

.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm, 0.875rem);
}
.comparison-table th {
  text-align: left;
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  border-bottom: 2px solid var(--border-color, #e2e8f0);
  color: var(--text-secondary, #64748b);
  font-weight: var(--font-weight-medium, 500);
}
.comparison-table td {
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  color: var(--text-primary, #0f172a);
}
.row-deterioration {
  background: var(--error-50, #fef2f2);
}
.drop-cell {
  font-weight: 700;
  color: var(--error-600, #dc2626);
}

.status-pill {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full, 9999px);
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-weight-medium, 500);
}
.status-improved {
  background: var(--success-50, #f0fdf4);
  color: var(--success-700, #15803d);
}
.status-unchanged {
  background: var(--neutral-100, #f1f5f9);
  color: var(--text-secondary, #64748b);
}
.status-normal {
  background: var(--warning-50, #fffbeb);
  color: var(--warning-700, #b45309);
}
.status-deterioration {
  background: var(--error-100, #fee2e2);
  color: var(--error-700, #b91c1c);
}
.status-added {
  background: var(--primary-50, #eef2ff);
  color: var(--primary-700, #4338ca);
}
.status-removed {
  background: var(--neutral-100, #f1f5f9);
  color: var(--text-tertiary, #94a3b8);
}

.no-wear {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  margin: 0;
  color: var(--success-600, #16a34a);
}

.missing {
  display: flex;
  gap: var(--space-4, 1rem);
  align-items: flex-start;
}
.missing i {
  font-size: 2rem;
  color: var(--primary-600, #4f46e5);
}
.missing h3 {
  margin: 0 0 var(--space-2, 0.5rem);
}
.missing p,
.missing ul {
  margin: 0 0 var(--space-2, 0.5rem);
  color: var(--text-secondary, #64748b);
}

@media print {
  .no-print {
    display: none !important;
  }
  .comparison-view {
    padding: 0;
  }
}

@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
