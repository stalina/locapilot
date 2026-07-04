<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useCommunicationsStore } from '../stores/communicationsStore';
import { usePropertiesStore } from '@/features/properties/stores/propertiesStore';
import { useTenantsStore } from '@/features/tenants/stores/tenantsStore';
import { useLeasesStore } from '@/features/leases/stores/leasesStore';
import { useConfirm } from '@/shared/composables/useConfirm';
import Button from '@/shared/components/Button.vue';
import type { Communication } from '@/db/types';
import {
  DIRECTION_LABELS,
  ENTITY_TYPE_LABELS,
  TYPE_LABELS,
  downloadAttachment,
  resolveEntityLabel,
  type CommunicationDraft,
  type CommunicationDirection,
  type CommunicationEntityType,
  type CommunicationType,
} from '../services/communicationsService';

const store = useCommunicationsStore();
const propertiesStore = usePropertiesStore();
const tenantsStore = useTenantsStore();
const leasesStore = useLeasesStore();
const { confirm } = useConfirm();

const TYPE_ICONS: Record<CommunicationType, string> = {
  email: 'mdi-email',
  phone: 'mdi-phone',
  sms: 'mdi-message-text',
  meeting: 'mdi-account-group',
  letter: 'mdi-file-document',
};

const showForm = ref(false);
const editingId = ref<number | null>(null);
const formError = ref<string | null>(null);

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

const form = reactive<{
  relatedEntityType: CommunicationEntityType;
  relatedEntityId: number | null;
  type: CommunicationType;
  direction: CommunicationDirection;
  subject: string;
  content: string;
  date: string;
}>({
  relatedEntityType: 'tenant',
  relatedEntityId: null,
  type: 'phone',
  direction: 'inbound',
  subject: '',
  content: '',
  date: todayInputValue(),
});

const entityContext = computed(() => ({
  properties: propertiesStore.properties,
  tenants: tenantsStore.tenants,
  leases: leasesStore.leases,
}));

const communications = computed(() => store.filteredCommunications);

const entityOptions = computed(() => {
  switch (form.relatedEntityType) {
    case 'property':
      return propertiesStore.properties.map(p => ({ id: p.id!, label: p.name }));
    case 'lease':
      return leasesStore.leases.map(l => ({
        id: l.id!,
        label: resolveEntityLabel(
          { relatedEntityType: 'lease', relatedEntityId: l.id! },
          entityContext.value
        ),
      }));
    case 'rent':
      return [];
    case 'tenant':
    case 'applicant':
    default:
      return tenantsStore.tenants.map(t => ({
        id: t.id!,
        label: `${t.firstName} ${t.lastName}`,
      }));
  }
});

function labelFor(comm: Communication): string {
  return resolveEntityLabel(comm, entityContext.value);
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function resetForm() {
  editingId.value = null;
  formError.value = null;
  form.relatedEntityType = 'tenant';
  form.relatedEntityId = null;
  form.type = 'phone';
  form.direction = 'inbound';
  form.subject = '';
  form.content = '';
  form.date = todayInputValue();
}

function openCreateForm() {
  resetForm();
  showForm.value = true;
}

function openEditForm(comm: Communication) {
  editingId.value = comm.id ?? null;
  formError.value = null;
  form.relatedEntityType = comm.relatedEntityType;
  form.relatedEntityId = comm.relatedEntityId;
  form.type = comm.type;
  form.direction = comm.direction;
  form.subject = comm.subject ?? '';
  form.content = comm.content;
  form.date = new Date(comm.date).toISOString().slice(0, 10);
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  resetForm();
}

async function submitForm() {
  formError.value = null;
  if (form.relatedEntityId == null) {
    formError.value = 'Sélectionnez une entité liée.';
    return;
  }
  const draft: CommunicationDraft = {
    relatedEntityType: form.relatedEntityType,
    relatedEntityId: form.relatedEntityId,
    type: form.type,
    direction: form.direction,
    subject: form.subject.trim() || undefined,
    content: form.content,
    date: new Date(`${form.date}T12:00:00`),
  };
  try {
    if (editingId.value != null) {
      await store.updateCommunication(editingId.value, draft);
    } else {
      await store.createCommunication(draft);
    }
    closeForm();
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'Erreur inconnue';
  }
}

async function handleDelete(comm: Communication) {
  if (comm.id == null) return;
  const ok = await confirm({
    title: 'Supprimer la communication',
    message:
      'Cette communication sera supprimée du journal. Les documents joints ne seront pas supprimés.',
    type: 'danger',
    confirmText: 'Supprimer',
  });
  if (!ok) return;
  await store.deleteCommunication(comm.id);
}

onMounted(async () => {
  await Promise.all([
    store.fetchCommunications(),
    propertiesStore.fetchProperties(),
    tenantsStore.fetchTenants(),
    leasesStore.fetchLeases(),
  ]);
});
</script>

<template>
  <div class="communications-view">
    <header class="page-header">
      <div>
        <h1 class="page-title">Communications</h1>
        <p class="page-subtitle">Journal chronologique des échanges et courriers</p>
      </div>
      <Button variant="primary" data-testid="log-communication-btn" @click="openCreateForm">
        <i class="mdi mdi-plus"></i> Enregistrer une communication
      </Button>
    </header>

    <!-- Filters -->
    <div class="filters card">
      <div class="filter-group">
        <label>Entité</label>
        <select v-model="store.filters.relatedEntityType" data-testid="filter-entity-type">
          <option value="all">Toutes</option>
          <option v-for="(label, value) in ENTITY_TYPE_LABELS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </div>
      <div class="filter-group">
        <label>Canal</label>
        <select v-model="store.filters.type" data-testid="filter-type">
          <option value="all">Tous</option>
          <option v-for="(label, value) in TYPE_LABELS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </div>
      <div class="filter-group">
        <label>Direction</label>
        <select v-model="store.filters.direction" data-testid="filter-direction">
          <option value="all">Toutes</option>
          <option v-for="(label, value) in DIRECTION_LABELS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </div>
      <div class="filter-group grow">
        <label>Recherche</label>
        <input
          v-model="store.filters.search"
          type="search"
          placeholder="Rechercher dans l'objet et le contenu…"
          data-testid="filter-search"
        />
      </div>
      <Button variant="secondary" @click="store.resetFilters()">Réinitialiser</Button>
    </div>

    <!-- Inline form -->
    <form
      v-if="showForm"
      class="card comm-form"
      data-testid="communication-form"
      @submit.prevent="submitForm"
    >
      <h2 class="card-title">
        {{ editingId != null ? 'Modifier la communication' : 'Enregistrer une communication' }}
      </h2>
      <div class="form-grid">
        <div class="form-field">
          <label>Type d'entité</label>
          <select v-model="form.relatedEntityType" data-testid="form-entity-type">
            <option v-for="(label, value) in ENTITY_TYPE_LABELS" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </div>
        <div class="form-field">
          <label>Entité liée</label>
          <select v-model.number="form.relatedEntityId" data-testid="form-entity-id">
            <option :value="null" disabled>Sélectionner…</option>
            <option v-for="opt in entityOptions" :key="opt.id" :value="opt.id">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="form-field">
          <label>Canal</label>
          <select v-model="form.type" data-testid="form-type">
            <option v-for="(label, value) in TYPE_LABELS" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </div>
        <div class="form-field">
          <label>Direction</label>
          <select v-model="form.direction" data-testid="form-direction">
            <option v-for="(label, value) in DIRECTION_LABELS" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </div>
        <div class="form-field">
          <label>Date</label>
          <input v-model="form.date" type="date" data-testid="form-date" />
        </div>
        <div class="form-field">
          <label>Objet</label>
          <input v-model="form.subject" type="text" data-testid="form-subject" />
        </div>
        <div class="form-field full">
          <label>Contenu</label>
          <textarea v-model="form.content" rows="3" data-testid="form-content"></textarea>
        </div>
      </div>
      <p v-if="formError" class="form-error" data-testid="form-error">{{ formError }}</p>
      <div class="form-actions">
        <Button variant="secondary" type="button" @click="closeForm">Annuler</Button>
        <Button variant="primary" type="submit" data-testid="form-submit">Enregistrer</Button>
      </div>
    </form>

    <!-- Journal -->
    <div v-if="store.isLoading" class="card empty-state">Chargement…</div>
    <div v-else-if="communications.length === 0" class="card empty-state" data-testid="empty-state">
      <i class="mdi mdi-message-outline"></i>
      <p>Aucune communication à afficher.</p>
      <Button variant="primary" @click="openCreateForm">Enregistrer la première</Button>
    </div>
    <ul v-else class="journal" data-testid="journal">
      <li
        v-for="comm in communications"
        :key="comm.id"
        class="card journal-row"
        data-testid="journal-row"
      >
        <i class="mdi journal-icon" :class="TYPE_ICONS[comm.type]"></i>
        <div class="journal-body">
          <div class="journal-head">
            <span class="journal-date">{{ formatDate(comm.date) }}</span>
            <span class="tag">{{ TYPE_LABELS[comm.type] }}</span>
            <span class="tag" :class="`dir-${comm.direction}`">
              {{ DIRECTION_LABELS[comm.direction] }}
            </span>
            <span class="tag entity">{{ labelFor(comm) }}</span>
            <span v-if="store.isReadOnly(comm)" class="tag readonly" data-testid="readonly-tag">
              Automatique
            </span>
          </div>
          <strong v-if="comm.subject" class="journal-subject">{{ comm.subject }}</strong>
          <p class="journal-content">{{ comm.content }}</p>
          <div v-if="comm.attachments && comm.attachments.length" class="journal-attachments">
            <button
              v-for="docId in comm.attachments"
              :key="docId"
              type="button"
              class="attachment-link"
              @click="downloadAttachment(docId)"
            >
              <i class="mdi mdi-paperclip"></i> Pièce jointe
            </button>
          </div>
        </div>
        <div v-if="!store.isReadOnly(comm)" class="journal-actions">
          <button
            type="button"
            class="icon-btn"
            title="Modifier"
            data-testid="edit-btn"
            @click="openEditForm(comm)"
          >
            <i class="mdi mdi-pencil"></i>
          </button>
          <button
            type="button"
            class="icon-btn danger"
            title="Supprimer"
            data-testid="delete-btn"
            @click="handleDelete(comm)"
          >
            <i class="mdi mdi-delete"></i>
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.communications-view {
  padding: var(--space-6, 1.5rem);
  max-width: 1000px;
  margin: 0 auto;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4, 1rem);
  flex-wrap: wrap;
  margin-bottom: var(--space-6, 1.5rem);
}
.page-title {
  font-size: var(--text-2xl, 1.5rem);
  font-weight: var(--font-weight-bold, 700);
  margin: 0;
  color: var(--text-primary, #0f172a);
}
.page-subtitle {
  margin: var(--space-1, 0.25rem) 0 0;
  color: var(--text-secondary, #64748b);
}
.card {
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  padding: var(--space-4, 1rem);
}
.card-title {
  font-size: var(--text-lg, 1.125rem);
  font-weight: var(--font-weight-semibold, 600);
  margin: 0 0 var(--space-4, 1rem);
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3, 0.75rem);
  margin-bottom: var(--space-4, 1rem);
}
.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}
.filter-group.grow {
  flex: 1;
  min-width: 200px;
}
.filter-group label,
.form-field label {
  font-size: var(--text-xs, 0.75rem);
  color: var(--text-secondary, #64748b);
}
select,
input,
textarea {
  padding: var(--space-2, 0.5rem);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  font: inherit;
  background: white;
}
.comm-form {
  margin-bottom: var(--space-4, 1rem);
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-3, 0.75rem);
}
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}
.form-field.full {
  grid-column: 1 / -1;
}
.form-error {
  color: var(--error-600, #dc2626);
  margin: var(--space-3, 0.75rem) 0 0;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2, 0.5rem);
  margin-top: var(--space-4, 1rem);
}
.empty-state {
  text-align: center;
  color: var(--text-secondary, #64748b);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-8, 2rem);
}
.empty-state i {
  font-size: 2.5rem;
  color: var(--text-tertiary, #94a3b8);
}
.journal {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}
.journal-row {
  display: flex;
  gap: var(--space-3, 0.75rem);
  align-items: flex-start;
}
.journal-icon {
  font-size: 1.5rem;
  color: var(--primary-600, #4f46e5);
  flex-shrink: 0;
}
.journal-body {
  flex: 1;
  min-width: 0;
}
.journal-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  margin-bottom: var(--space-1, 0.25rem);
}
.journal-date {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}
.tag {
  font-size: var(--text-xs, 0.75rem);
  padding: 2px 8px;
  border-radius: var(--radius-full, 999px);
  background: var(--bg-tertiary, #e2e8f0);
  color: var(--text-secondary, #64748b);
}
.tag.dir-outbound {
  background: var(--primary-100, #e0e7ff);
  color: var(--primary-700, #4338ca);
}
.tag.entity {
  background: var(--bg-secondary, #f1f5f9);
}
.tag.readonly {
  background: var(--warning-100, #fef3c7);
  color: var(--warning-700, #b45309);
}
.journal-subject {
  display: block;
  color: var(--text-primary, #0f172a);
}
.journal-content {
  margin: var(--space-1, 0.25rem) 0 0;
  color: var(--text-primary, #0f172a);
  white-space: pre-wrap;
}
.journal-attachments {
  margin-top: var(--space-2, 0.5rem);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2, 0.5rem);
}
.attachment-link {
  background: none;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  padding: 2px 8px;
  cursor: pointer;
  font-size: var(--text-xs, 0.75rem);
  color: var(--primary-600, #4f46e5);
}
.journal-actions {
  display: flex;
  gap: var(--space-1, 0.25rem);
  flex-shrink: 0;
}
.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  color: var(--text-secondary, #64748b);
  padding: var(--space-1, 0.25rem);
  border-radius: var(--radius-md, 0.5rem);
}
.icon-btn:hover {
  background: var(--bg-secondary, #f1f5f9);
  color: var(--text-primary, #0f172a);
}
.icon-btn.danger:hover {
  color: var(--error-600, #dc2626);
}
</style>
