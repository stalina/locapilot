<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import type { Document } from '@/db/types';

interface Props {
  document: Document;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  download: [];
  delete: [];
}>();

const photoPreviewUrl = ref<string | null>(null);

const isPhoto = computed(() => {
  return props.document.type === 'photo' || props.document.mimeType?.startsWith('image/');
});

const typeConfig = computed(() => {
  if (isPhoto.value) {
    return {
      label: 'Photo',
      icon: 'image',
      color: 'accent',
      gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)',
    };
  }

  switch (props.document.type) {
    case 'lease':
      return {
        label: 'Bail',
        icon: 'file-document',
        color: 'primary',
        gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)',
      };
    case 'inventory':
      return {
        label: 'État des lieux',
        icon: 'clipboard-check',
        color: 'accent',
        gradient: 'linear-gradient(135deg, #14b8a6, #0d9488)',
      };
    case 'invoice':
      return {
        label: 'Facture',
        icon: 'receipt',
        color: 'warning',
        gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      };
    case 'insurance':
      return {
        label: 'Assurance',
        icon: 'shield-check',
        color: 'success',
        gradient: 'linear-gradient(135deg, #10b981, #059669)',
      };
    case 'other':
    default:
      return {
        label: 'Autre',
        icon: 'file',
        color: 'default',
        gradient: 'linear-gradient(135deg, #64748b, #475569)',
      };
  }
});

const fileExtension = computed(() => {
  const parts = props.document.name.split('.');
  return parts.length > 1 ? parts[parts.length - 1]?.toUpperCase() || '' : '';
});

const formattedSize = computed(() => {
  const bytes = props.document.size;
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
});

const formattedDate = computed(() => {
  return new Date(props.document.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
});

function handleDownload() {
  emit('download');
}

function handleDelete() {
  emit('delete');
}

function loadPhotoPreview() {
  if (!isPhoto.value) return;

  const data = props.document.data;
  try {
    if (!data) {
      photoPreviewUrl.value = null;
      return;
    }

    // If already a data URL string
    if (typeof data === 'string' && data.startsWith('data:')) {
      photoPreviewUrl.value = data;
      return;
    }

    // If it's a Blob-like object, use createObjectURL safely
    if (data instanceof Blob) {
      photoPreviewUrl.value = URL.createObjectURL(data);
      return;
    }

    // If data is an object but not a Blob (some imports store {}), try to extract buffer
    if (typeof data === 'object' && data !== null) {
      // Some exported JSON might have an empty object for binary data.
      // Avoid calling createObjectURL on plain objects.
      // Try to handle ArrayBuffer-like shapes
      // @ts-ignore
      const buf = (data as any).buffer;
      if (buf instanceof ArrayBuffer) {
        const blob = new Blob([new Uint8Array(buf)], {
          type: props.document.mimeType || 'application/octet-stream',
        });
        photoPreviewUrl.value = URL.createObjectURL(blob);
        return;
      }
    }

    // If we reach here, data is not usable
    photoPreviewUrl.value = null;
  } catch (err) {
    console.error('Failed to create photo preview URL', err);
    photoPreviewUrl.value = null;
  }
}

onMounted(() => {
  loadPhotoPreview();
});

onUnmounted(() => {
  if (photoPreviewUrl.value) {
    URL.revokeObjectURL(photoPreviewUrl.value);
  }
});
</script>

<template>
  <div class="document-card">
    <!-- Icon/Photo Section -->
    <div class="document-icon" :style="isPhoto ? {} : { background: typeConfig.gradient }">
      <img
        v-if="isPhoto && photoPreviewUrl"
        :src="photoPreviewUrl"
        :alt="document.name"
        class="photo-preview"
      />
      <template v-else>
        <i class="mdi" :class="`mdi-${typeConfig.icon}`"></i>
        <span v-if="fileExtension" class="file-extension">{{ fileExtension }}</span>
      </template>
    </div>

    <!-- Content Section -->
    <div class="document-content">
      <div class="document-header">
        <h3 class="document-name" :title="document.name">{{ document.name }}</h3>
        <span class="document-badge" :class="`badge-${typeConfig.color}`">
          {{ typeConfig.label }}
        </span>
      </div>

      <p v-if="document.description" class="document-description">
        {{ document.description }}
      </p>

      <div class="document-meta">
        <span class="meta-item">
          <i class="mdi mdi-file-outline"></i>
          {{ formattedSize }}
        </span>
        <span class="meta-item">
          <i class="mdi mdi-calendar"></i>
          {{ formattedDate }}
        </span>
      </div>
    </div>

    <!-- Actions Section -->
    <div class="document-actions">
      <button class="action-button download" @click="handleDownload" title="Télécharger">
        <i class="mdi mdi-download"></i>
      </button>
      <button class="action-button delete" @click="handleDelete" title="Supprimer">
        <i class="mdi mdi-delete"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>
.document-card {
  display: flex;
  gap: var(--space-4, 1rem);
  padding: var(--space-4, 1rem);
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
  transition: all var(--transition-base, 0.2s ease);
}

.document-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
  border-color: var(--primary-300, #a5b4fc);
}

.document-icon {
  position: relative;
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg, 0.75rem);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  overflow: hidden;
  background: var(--bg-secondary, #f1f5f9);
}

.photo-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.document-icon i {
  font-size: 2.5rem;
  color: white;
}

.file-extension {
  position: absolute;
  bottom: var(--space-1, 0.25rem);
  right: var(--space-1, 0.25rem);
  padding: 0 var(--space-1, 0.25rem);
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-weight-bold, 700);
  color: white;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm, 0.25rem);
}

.document-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
  min-width: 0;
}

.document-header {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.document-name {
  margin: 0;
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.document-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-weight-semibold, 600);
  border-radius: var(--radius-full, 9999px);
  line-height: 1;
  flex-shrink: 0;
}

.badge-primary {
  background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
  color: #4338ca;
}

.badge-accent {
  background: linear-gradient(135deg, #ccfbf1, #99f6e4);
  color: #115e59;
}

.badge-warning {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #92400e;
}

.badge-success {
  background: linear-gradient(135deg, #d1fae5, #a7f3d0);
  color: #065f46;
}

.badge-default {
  background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
  color: #334155;
}

.document-description {
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

.document-meta {
  display: flex;
  gap: var(--space-4, 1rem);
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-tertiary, #94a3b8);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: var(--space-1, 0.25rem);
}

.meta-item i {
  font-size: 1rem;
}

.document-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2, 0.5rem);
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--bg-secondary, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
  font-size: 1.25rem;
}

.action-button:hover {
  transform: scale(1.1);
}

.action-button.download {
  color: var(--primary-600, #4f46e5);
}

.action-button.download:hover {
  background: var(--primary-50, #eef2ff);
  border-color: var(--primary-300, #a5b4fc);
}

.action-button.delete {
  color: var(--error-600, #dc2626);
}

.action-button.delete:hover {
  background: var(--error-50, #fef2f2);
  border-color: var(--error-300, #fca5a5);
}

@media (max-width: 768px) {
  .document-card {
    flex-direction: column;
  }

  .document-icon {
    width: 100%;
    height: 120px;
  }

  .document-actions {
    flex-direction: row;
    justify-content: center;
  }
}
</style>
