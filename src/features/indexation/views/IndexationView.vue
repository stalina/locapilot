<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import Button from '@/shared/components/Button.vue';
import Card from '@/shared/components/Card.vue';
import Modal from '@/shared/components/Modal.vue';
import { useConfirm } from '@/shared/composables/useConfirm';
import { useIndexationStore } from '../stores/indexationStore';
import type { IrlIndex } from '@/db/types';

const SERVICE_PUBLIC_URL = 'https://www.service-public.gouv.fr/particuliers/vosdroits/F13723';

const indexationStore = useIndexationStore();
const { confirm } = useConfirm();

const showModal = ref(false);
const formYear = ref<number>(new Date().getFullYear());
const formQuarter = ref<1 | 2 | 3 | 4>(1);
const formValue = ref<number | null>(null);
const formError = ref('');

const indices = computed(() => indexationStore.irlIndices);

onMounted(async () => {
  await indexationStore.fetchIrlIndices();
});

function quarterLabel(q: number): string {
  return `T${q}`;
}

function openAddModal() {
  formYear.value = new Date().getFullYear();
  formQuarter.value = 1;
  formValue.value = null;
  formError.value = '';
  showModal.value = true;
}

function openEditModal(index: IrlIndex) {
  formYear.value = index.year;
  formQuarter.value = index.quarter;
  formValue.value = index.value;
  formError.value = '';
  showModal.value = true;
}

async function submit() {
  formError.value = '';
  const year = Number(formYear.value);
  const quarter = Number(formQuarter.value) as 1 | 2 | 3 | 4;
  const value = Number(formValue.value);

  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    formError.value = 'Année invalide';
    return;
  }
  if (![1, 2, 3, 4].includes(quarter)) {
    formError.value = 'Trimestre invalide';
    return;
  }
  if (!Number.isFinite(value) || value <= 0) {
    formError.value = "La valeur de l'IRL doit être strictement positive";
    return;
  }

  try {
    await indexationStore.upsertIrlIndex({ year, quarter, value });
    showModal.value = false;
  } catch {
    formError.value = "Échec de l'enregistrement";
  }
}

async function remove(index: IrlIndex) {
  if (!index.id) return;
  const confirmed = await confirm({
    title: 'Supprimer cet indice',
    message: `Supprimer l'IRL ${quarterLabel(index.quarter)} ${index.year} (${index.value}) ?`,
    type: 'danger',
    confirmText: 'Supprimer',
  });
  if (confirmed) {
    await indexationStore.removeIrlIndex(index.id);
  }
}
</script>

<template>
  <div class="view-container indexation-view">
    <header class="view-header">
      <div>
        <h1>Indexation IRL</h1>
        <p class="subtitle">
          Saisissez les indices de référence des loyers (IRL) publiés par l'INSEE chaque trimestre.
          Ils servent à calculer la révision annuelle du loyer à la date anniversaire de chaque
          bail.
        </p>
      </div>
      <div class="header-actions">
        <a class="source-link" :href="SERVICE_PUBLIC_URL" target="_blank" rel="noopener noreferrer">
          <i class="mdi mdi-open-in-new"></i>
          Consulter les IRL (service-public.fr)
        </a>
        <Button icon="plus" data-testid="add-irl" @click="openAddModal">Ajouter un IRL</Button>
      </div>
    </header>

    <Card>
      <div v-if="indexationStore.isLoading" class="loading-state">
        <i class="mdi mdi-loading mdi-spin"></i> Chargement…
      </div>

      <div v-else-if="indices.length === 0" class="empty-placeholder" data-testid="irl-empty">
        <i class="mdi mdi-chart-line"></i>
        <p>Aucun indice IRL enregistré pour le moment.</p>
      </div>

      <table v-else class="irl-table" data-testid="irl-table">
        <thead>
          <tr>
            <th>Année</th>
            <th>Trimestre</th>
            <th>Valeur IRL</th>
            <th class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="index in indices" :key="index.id">
            <td>{{ index.year }}</td>
            <td>{{ quarterLabel(index.quarter) }}</td>
            <td>{{ index.value.toLocaleString('fr-FR') }}</td>
            <td class="actions-col">
              <button class="icon-button" title="Modifier" @click="openEditModal(index)">
                <i class="mdi mdi-pencil"></i>
              </button>
              <button class="icon-button danger" title="Supprimer" @click="remove(index)">
                <i class="mdi mdi-delete"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </Card>

    <Modal v-model="showModal" title="Indice IRL" size="sm">
      <div class="form-grid">
        <div class="form-row">
          <label for="irl-year">Année</label>
          <input
            id="irl-year"
            v-model.number="formYear"
            type="number"
            min="1990"
            max="2100"
            class="input"
          />
        </div>
        <div class="form-row">
          <label for="irl-quarter">Trimestre</label>
          <select id="irl-quarter" v-model.number="formQuarter" class="input">
            <option :value="1">T1 (janv.–mars)</option>
            <option :value="2">T2 (avril–juin)</option>
            <option :value="3">T3 (juil.–sept.)</option>
            <option :value="4">T4 (oct.–déc.)</option>
          </select>
        </div>
        <div class="form-row">
          <label for="irl-value">Valeur de l'IRL</label>
          <input
            id="irl-value"
            v-model.number="formValue"
            type="number"
            step="0.01"
            min="0"
            class="input"
            placeholder="Ex : 145.17"
            data-testid="irl-value"
          />
        </div>
        <p v-if="formError" class="form-error" data-testid="irl-error">{{ formError }}</p>
      </div>
      <template #footer>
        <Button variant="outline" @click="showModal = false">Annuler</Button>
        <Button data-testid="save-irl" @click="submit">Enregistrer</Button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.view-container {
  padding: var(--space-6, 1.5rem);
}
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4, 1rem);
  flex-wrap: wrap;
  margin-bottom: var(--space-6, 1.5rem);
}
.subtitle {
  color: var(--text-secondary, #64748b);
  max-width: 60ch;
  margin-top: var(--space-2, 0.5rem);
}
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  flex-wrap: wrap;
}
.source-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  color: var(--primary-600, #4f46e5);
  text-decoration: none;
  font-weight: 500;
}
.source-link:hover {
  text-decoration: underline;
}
.irl-table {
  width: 100%;
  border-collapse: collapse;
}
.irl-table th,
.irl-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color, #e2e8f0);
  text-align: left;
}
.irl-table th {
  font-weight: 600;
  color: var(--text-secondary, #64748b);
}
.actions-col {
  text-align: right;
  white-space: nowrap;
}
.icon-button {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  color: var(--primary-600, #4f46e5);
}
.icon-button:hover {
  background: rgba(79, 70, 229, 0.08);
}
.icon-button.danger {
  color: var(--error-600, #dc2626);
}
.empty-placeholder {
  text-align: center;
  color: var(--text-secondary, #64748b);
  padding: var(--space-8, 2rem);
}
.empty-placeholder i {
  font-size: 2.5rem;
  display: block;
  margin-bottom: var(--space-2, 0.5rem);
}
.form-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-row label {
  font-weight: 500;
}
.input {
  padding: 8px 10px;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 6px;
  font-size: 1em;
  background: var(--input-bg, #fff);
  color: var(--text-color, #222);
}
.form-error {
  color: var(--error-600, #dc2626);
  font-size: 0.9em;
}
.loading-state {
  text-align: center;
  padding: var(--space-6, 1.5rem);
  color: var(--text-secondary, #64748b);
}
</style>
