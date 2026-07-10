<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import Modal from '@/shared/components/Modal.vue';
import Button from '@/shared/components/Button.vue';
import type { Document } from '@/db/types';
import {
  documentPreviewKind,
  createDocumentPreviewSource,
  type DocumentPreviewSource,
} from '@/shared/utils/documentPreview';

interface Props {
  modelValue: boolean;
  document: Document | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
  download: [];
}>();

const source = ref<DocumentPreviewSource | null>(null);

const previewKind = computed(() => documentPreviewKind(props.document?.mimeType));

const previewUrl = computed(() => source.value?.url ?? null);

const hasError = computed(
  () => props.modelValue && (previewKind.value === null || previewUrl.value === null)
);

function releaseSource() {
  if (source.value) {
    source.value.revoke();
    source.value = null;
  }
}

function loadSource() {
  releaseSource();
  if (!props.document || previewKind.value === null) return;
  source.value = createDocumentPreviewSource(props.document);
}

watch(
  () => [props.modelValue, props.document] as const,
  ([isOpen]) => {
    if (isOpen) {
      loadSource();
    } else {
      releaseSource();
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  releaseSource();
});

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}

function handleDownload() {
  emit('download');
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="document?.name ?? 'Aperçu'"
    size="xl"
    @update:model-value="handleClose"
  >
    <div class="document-preview" data-testid="document-preview">
      <!-- PDF preview -->
      <iframe
        v-if="previewKind === 'pdf' && previewUrl"
        :src="previewUrl"
        :title="document?.name ?? 'Aperçu PDF'"
        class="preview-frame"
        data-testid="document-preview-pdf"
      ></iframe>

      <!-- Image preview -->
      <img
        v-else-if="previewKind === 'image' && previewUrl"
        :src="previewUrl"
        :alt="document?.name ?? 'Aperçu image'"
        class="preview-image"
        data-testid="document-preview-image"
      />

      <!-- Error / unsupported fallback -->
      <div v-else-if="hasError" class="preview-error" data-testid="document-preview-error">
        <i class="mdi mdi-file-alert-outline"></i>
        <p>Impossible d'afficher l'aperçu de ce document</p>
        <Button variant="primary" icon="download" @click="handleDownload">Télécharger</Button>
      </div>
    </div>

    <template #footer>
      <Button variant="outline" data-testid="document-preview-close" @click="handleClose">
        Fermer
      </Button>
      <Button
        variant="primary"
        icon="download"
        data-testid="document-preview-download"
        @click="handleDownload"
      >
        Télécharger
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.document-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.preview-frame {
  width: 100%;
  height: 70vh;
  border: none;
  border-radius: var(--radius-lg, 0.75rem);
  background: var(--bg-secondary, #f1f5f9);
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
  border-radius: var(--radius-lg, 0.75rem);
}

.preview-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-8, 2rem);
  color: var(--text-secondary, #64748b);
  text-align: center;
}

.preview-error i {
  font-size: 3rem;
  color: var(--text-tertiary, #94a3b8);
}

.preview-error p {
  margin: 0;
  font-size: var(--text-base, 1rem);
}
</style>
