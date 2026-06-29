<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import Button from '@/shared/components/Button.vue';
import { useConfirm } from '@/shared/composables/useConfirm';
import { useIndexationStore } from '../stores/indexationStore';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import { useDocumentsStore } from '@/features/documents/stores/documentsStore';
import {
  buildRevisionProposal,
  currentRevisionYear,
  quarterLabel,
  type RentRevisionProposal,
} from '../services/indexationService';
import {
  prepareRentRevisionLetterData,
  generateRentRevisionLetter,
  saveRentRevisionLetterToDb,
  downloadBlob,
} from '@/shared/services/documentGenerator';

const props = defineProps<{ leaseId: number }>();
const emit = defineEmits<{ applied: [] }>();

const indexationStore = useIndexationStore();
const leasesStore = useLeasesStore();
const documentsStore = useDocumentsStore();
const { confirm } = useConfirm();

const selectedYear = ref<number>(new Date().getFullYear());
const isWorking = ref(false);

const lease = computed(() =>
  leasesStore.currentLease?.id === props.leaseId
    ? leasesStore.currentLease
    : (leasesStore.leases.find(l => l.id === props.leaseId) ?? null)
);

const revisions = computed(() => indexationStore.revisionsForLease(props.leaseId));

const candidateYears = computed(() => {
  if (!lease.value) return [];
  const startYear = new Date(lease.value.startDate).getFullYear();
  const lastYear = currentRevisionYear(lease.value);
  const years: number[] = [];
  for (let y = startYear + 1; y <= lastYear; y++) years.push(y);
  return years.reverse();
});

const result = computed(() => {
  if (!lease.value) return null;
  return buildRevisionProposal({
    lease: lease.value,
    indices: indexationStore.irlIndices,
    year: selectedYear.value,
  });
});

const proposal = computed<RentRevisionProposal | null>(() => result.value?.proposal ?? null);

const appliedRevisionForYear = computed(() =>
  revisions.value.find(r => r.year === selectedYear.value && r.status === 'applied')
);

const totalMonthly = computed(() =>
  proposal.value ? proposal.value.newRent + proposal.value.charges : 0
);

const existingLetter = computed(() =>
  documentsStore.documents.find(
    doc =>
      doc.relatedEntityType === 'lease' &&
      doc.relatedEntityId === props.leaseId &&
      doc.description === `Courrier révision loyer ${selectedYear.value}`
  )
);

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('fr-FR');
}

onMounted(async () => {
  await Promise.all([
    indexationStore.fetchIrlIndices(),
    indexationStore.fetchRevisions(props.leaseId),
    documentsStore.fetchDocuments(),
  ]);
  if (candidateYears.value.length > 0) {
    selectedYear.value = candidateYears.value[0]!;
  }
});

watch(candidateYears, years => {
  if (years.length > 0 && !years.includes(selectedYear.value)) {
    selectedYear.value = years[0]!;
  }
});

async function applyRevision() {
  if (!proposal.value) return;
  const confirmed = await confirm({
    title: 'Valider la révision du loyer',
    message: `Le loyer passera de ${fmt(proposal.value.oldRent)} € à ${fmt(
      proposal.value.newRent
    )} €. Le loyer du bail sera mis à jour. Continuer ?`,
    confirmText: 'Valider',
    type: 'warning',
  });
  if (!confirmed) return;

  isWorking.value = true;
  try {
    await indexationStore.applyRevision(proposal.value);
    await leasesStore.fetchLeaseById(props.leaseId);
    emit('applied');
  } catch (error) {
    console.error('Failed to apply revision:', error);
  } finally {
    isWorking.value = false;
  }
}

async function rejectRevision() {
  if (!proposal.value) return;
  const confirmed = await confirm({
    title: 'Refuser la révision',
    message: 'Marquer cette révision comme refusée (le loyer ne sera pas modifié) ?',
    confirmText: 'Refuser',
    type: 'warning',
  });
  if (!confirmed) return;
  try {
    await indexationStore.rejectRevision(proposal.value);
  } catch (error) {
    console.error('Failed to reject revision:', error);
  }
}

async function generateLetter() {
  if (!proposal.value) return;
  isWorking.value = true;
  try {
    const data = await prepareRentRevisionLetterData({
      leaseId: proposal.value.leaseId,
      year: proposal.value.year,
      referenceQuarter: proposal.value.referenceQuarter,
      oldRent: proposal.value.oldRent,
      newRent: proposal.value.newRent,
      currentIrl: proposal.value.currentIrl,
      previousIrl: proposal.value.previousIrl,
      charges: proposal.value.charges,
      effectiveDate: proposal.value.effectiveDate,
    });
    const { blob, filename } = await generateRentRevisionLetter(data);

    const shouldSave = await confirm({
      title: 'Sauvegarder le courrier de révision',
      message:
        'Voulez-vous sauvegarder ce courrier dans la base documentaire ? Vous pourrez le retrouver dans la section Documents.',
      confirmText: 'Sauvegarder et télécharger',
      cancelText: 'Télécharger uniquement',
      type: 'info',
    });

    if (shouldSave) {
      const documentId = await saveRentRevisionLetterToDb(
        props.leaseId,
        proposal.value.year,
        blob,
        filename
      );
      await documentsStore.fetchDocuments();
      if (appliedRevisionForYear.value?.id) {
        await indexationStore.attachDocumentToRevision(
          appliedRevisionForYear.value.id,
          documentId,
          props.leaseId
        );
      }
    }

    downloadBlob(blob, filename);
  } catch (error) {
    console.error('Failed to generate revision letter:', error);
  } finally {
    isWorking.value = false;
  }
}

async function downloadExistingLetter() {
  if (!existingLetter.value?.id) return;
  try {
    await documentsStore.downloadDocument(existingLetter.value.id);
  } catch (error) {
    console.error('Failed to download revision letter:', error);
  }
}
</script>

<template>
  <div class="rent-revision">
    <div class="card-header">
      <h2>
        <i class="mdi mdi-chart-line"></i>
        Révision du loyer (IRL)
      </h2>
    </div>

    <div v-if="candidateYears.length === 0" class="empty-placeholder" data-testid="revision-none">
      <i class="mdi mdi-calendar-clock"></i>
      <p>Aucune date anniversaire atteinte : pas de révision possible pour l'instant.</p>
    </div>

    <template v-else>
      <div class="year-selector">
        <label for="revision-year">Année de révision</label>
        <select
          id="revision-year"
          v-model.number="selectedYear"
          class="input"
          data-testid="revision-year"
        >
          <option v-for="y in candidateYears" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>

      <div v-if="!proposal" class="missing-indices" data-testid="revision-missing">
        <i class="mdi mdi-alert-outline"></i>
        <p>
          Indices IRL manquants pour calculer la révision :
          <strong>{{ result?.missingIndices.join(', ') }}</strong
          >.
        </p>
        <Button variant="outline" icon="chart-line" to="/indexation">Saisir les IRL</Button>
      </div>

      <template v-else>
        <div class="proposal" data-testid="revision-proposal">
          <p class="formula">
            Nouveau loyer = ancien loyer × (IRL
            {{ quarterLabel(proposal.referenceQuarter, proposal.year) }} ÷ IRL
            {{ quarterLabel(proposal.referenceQuarter, proposal.year - 1) }})
          </p>
          <table class="revision-table">
            <thead>
              <tr>
                <th>Loyer actuel</th>
                <th>IRL {{ quarterLabel(proposal.referenceQuarter, proposal.year - 1) }}</th>
                <th>IRL {{ quarterLabel(proposal.referenceQuarter, proposal.year) }}</th>
                <th>Nouveau loyer</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ fmt(proposal.oldRent) }} €</td>
                <td>{{ fmt(proposal.previousIrl) }}</td>
                <td>{{ fmt(proposal.currentIrl) }}</td>
                <td class="highlight" data-testid="revision-new-rent">
                  {{ fmt(proposal.newRent) }} €
                </td>
              </tr>
            </tbody>
          </table>
          <p class="recap">
            Loyer + charges : {{ fmt(proposal.newRent) }} + {{ fmt(proposal.charges) }} =
            <strong>{{ fmt(totalMonthly) }} € / mois</strong>
          </p>
          <p class="recap">Date d'effet : {{ fmtDate(proposal.effectiveDate) }}</p>
          <p v-if="appliedRevisionForYear" class="applied-badge" data-testid="revision-applied">
            <i class="mdi mdi-check-circle"></i> Révision {{ selectedYear }} déjà appliquée
          </p>
        </div>

        <div class="actions">
          <Button
            v-if="!appliedRevisionForYear"
            icon="check"
            :loading="isWorking"
            data-testid="apply-revision"
            @click="applyRevision"
          >
            Valider la révision
          </Button>
          <Button
            v-if="!appliedRevisionForYear"
            variant="outline"
            icon="close"
            @click="rejectRevision"
          >
            Refuser
          </Button>
          <Button
            v-if="!existingLetter"
            variant="outline"
            icon="email-outline"
            :loading="isWorking"
            data-testid="generate-revision-letter"
            @click="generateLetter"
          >
            Générer le courrier
          </Button>
          <Button v-else variant="outline" icon="download" @click="downloadExistingLetter">
            Télécharger le courrier
          </Button>
        </div>
      </template>
    </template>

    <div v-if="revisions.length" class="history">
      <h3>Historique des révisions</h3>
      <ul>
        <li v-for="r in revisions" :key="r.id">
          <span class="hist-year">{{ r.year }}</span>
          <span>{{ fmt(r.oldRent) }} € → {{ fmt(r.newRent) }} €</span>
          <span class="hist-status" :class="`status-${r.status}`">{{
            r.status === 'applied'
              ? 'Appliquée'
              : r.status === 'rejected'
                ? 'Refusée'
                : 'En attente'
          }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.card-header h2 {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}
.year-selector {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  margin: var(--space-4, 1rem) 0;
}
.input {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  background: var(--input-bg, #fff);
  color: var(--text-color, #222);
}
.formula {
  font-style: italic;
  color: var(--text-secondary, #64748b);
  margin-bottom: var(--space-3, 0.75rem);
}
.revision-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-3, 0.75rem);
}
.revision-table th,
.revision-table td {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e2e8f0);
  text-align: center;
}
.revision-table .highlight {
  font-weight: 700;
  color: var(--primary-600, #4f46e5);
}
.recap {
  margin: var(--space-1, 0.25rem) 0;
}
.applied-badge {
  color: var(--success-600, #16a34a);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--space-2, 0.5rem);
}
.missing-indices {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-4, 1rem);
  background: var(--warning-50, #fffbeb);
  border-radius: var(--radius-md, 0.5rem);
  color: var(--warning-700, #b45309);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2, 0.5rem);
  margin-top: var(--space-4, 1rem);
}
.empty-placeholder {
  text-align: center;
  color: var(--text-secondary, #64748b);
  padding: var(--space-6, 1.5rem);
}
.empty-placeholder i {
  font-size: 2rem;
  display: block;
  margin-bottom: var(--space-2, 0.5rem);
}
.history {
  margin-top: var(--space-5, 1.25rem);
  border-top: 1px solid var(--border-color, #e2e8f0);
  padding-top: var(--space-4, 1rem);
}
.history h3 {
  margin-bottom: var(--space-2, 0.5rem);
}
.history ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.history li {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding: 6px 0;
}
.hist-year {
  font-weight: 600;
  min-width: 3rem;
}
.hist-status {
  margin-left: auto;
  font-size: 0.85em;
  padding: 2px 10px;
  border-radius: 12px;
}
.status-applied {
  background: #dcfce7;
  color: #16a34a;
}
.status-rejected {
  background: #fee2e2;
  color: #dc2626;
}
.status-pending {
  background: #fef9c3;
  color: #b45309;
}
</style>
