<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { Communication } from '@/db/types';
import { useCommunicationsStore } from '../stores/communicationsStore';
import {
  DIRECTION_LABELS,
  TYPE_LABELS,
  downloadAttachment,
  type CommunicationEntityType,
} from '../services/communicationsService';

const props = defineProps<{
  relatedEntityType: CommunicationEntityType;
  relatedEntityId: number;
}>();

const store = useCommunicationsStore();
const items = ref<Communication[]>([]);
const isLoading = ref(false);

const TYPE_ICONS: Record<Communication['type'], string> = {
  email: 'mdi-email',
  phone: 'mdi-phone',
  sms: 'mdi-message-text',
  meeting: 'mdi-account-group',
  letter: 'mdi-file-document',
};

async function load() {
  if (!props.relatedEntityId) return;
  isLoading.value = true;
  try {
    items.value = await store.fetchCommunicationsForEntity(
      props.relatedEntityType,
      props.relatedEntityId
    );
  } finally {
    isLoading.value = false;
  }
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

onMounted(load);
watch(() => [props.relatedEntityType, props.relatedEntityId], load);
</script>

<template>
  <div class="communications-timeline" data-testid="communications-timeline">
    <p v-if="isLoading" class="timeline-empty">Chargement…</p>
    <p v-else-if="items.length === 0" class="timeline-empty">Aucune communication enregistrée.</p>
    <ul v-else class="timeline-list">
      <li v-for="comm in items" :key="comm.id" class="timeline-item" data-testid="timeline-item">
        <i class="mdi timeline-icon" :class="TYPE_ICONS[comm.type]"></i>
        <div class="timeline-body">
          <div class="timeline-head">
            <span class="timeline-date">{{ formatDate(comm.date) }}</span>
            <span class="timeline-tag">{{ TYPE_LABELS[comm.type] }}</span>
            <span class="timeline-tag" :class="`dir-${comm.direction}`">
              {{ DIRECTION_LABELS[comm.direction] }}
            </span>
            <span v-if="store.isReadOnly(comm)" class="timeline-tag readonly"> Automatique </span>
          </div>
          <strong v-if="comm.subject" class="timeline-subject">{{ comm.subject }}</strong>
          <p class="timeline-content">{{ comm.content }}</p>
          <div v-if="comm.attachments && comm.attachments.length" class="timeline-attachments">
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
      </li>
    </ul>
  </div>
</template>

<style scoped>
.communications-timeline {
  width: 100%;
}
.timeline-empty {
  color: var(--text-tertiary, #94a3b8);
  font-size: var(--text-sm, 0.875rem);
  margin: 0;
}
.timeline-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
}
.timeline-item {
  display: flex;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-3, 0.75rem);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  background: var(--bg-secondary, #f8fafc);
}
.timeline-icon {
  font-size: 1.25rem;
  color: var(--primary-600, #4f46e5);
  flex-shrink: 0;
}
.timeline-body {
  min-width: 0;
  flex: 1;
}
.timeline-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  margin-bottom: var(--space-1, 0.25rem);
}
.timeline-date {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}
.timeline-tag {
  font-size: var(--text-xs, 0.75rem);
  padding: 2px 8px;
  border-radius: var(--radius-full, 999px);
  background: var(--bg-tertiary, #e2e8f0);
  color: var(--text-secondary, #64748b);
}
.timeline-tag.dir-outbound {
  background: var(--primary-100, #e0e7ff);
  color: var(--primary-700, #4338ca);
}
.timeline-tag.readonly {
  background: var(--warning-100, #fef3c7);
  color: var(--warning-700, #b45309);
}
.timeline-subject {
  display: block;
  color: var(--text-primary, #0f172a);
}
.timeline-content {
  margin: var(--space-1, 0.25rem) 0 0;
  color: var(--text-primary, #0f172a);
  white-space: pre-wrap;
}
.timeline-attachments {
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
.attachment-link:hover {
  background: var(--bg-secondary, #f1f5f9);
}
</style>
