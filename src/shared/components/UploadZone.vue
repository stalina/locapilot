<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  accept: '*/*',
  multiple: true,
  maxSize: 10 * 1024 * 1024, // 10MB default
  disabled: false,
});

const emit = defineEmits<{
  upload: [files: File[]];
}>();

const isDragging = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

function handleDragEnter(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  if (!props.disabled) {
    isDragging.value = true;
  }
}

function handleDragLeave(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;
}

function handleDragOver(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function handleDrop(e: DragEvent) {
  e.preventDefault();
  e.stopPropagation();
  isDragging.value = false;

  if (props.disabled) return;

  const files = Array.from(e.dataTransfer?.files || []);
  processFiles(files);
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  processFiles(files);
  // Reset input pour permettre de sélectionner le même fichier
  input.value = '';
}

function processFiles(files: File[]) {
  // Filter files by size
  const validFiles = files.filter(file => {
    if (file.size > props.maxSize) {
      console.warn(`File ${file.name} exceeds max size of ${formatFileSize(props.maxSize)}`);
      return false;
    }
    return true;
  });

  if (validFiles.length > 0) {
    emit('upload', validFiles);
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function openFilePicker() {
  if (!props.disabled && fileInputRef.value) {
    fileInputRef.value.click();
  }
}
</script>

<template>
  <div
    class="upload-zone"
    :class="{ 'is-dragging': isDragging, 'is-disabled': disabled }"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
    @click="openFilePicker"
  >
    <input
      ref="fileInputRef"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      class="file-input"
      @change="handleFileSelect"
    />

    <div class="upload-content">
      <i class="mdi mdi-cloud-upload upload-icon"></i>
      <h3 class="upload-title">
        Glissez-déposez vos fichiers ici
      </h3>
      <p class="upload-subtitle">
        ou cliquez pour sélectionner
      </p>
      <p class="upload-hint">
        Taille maximale : {{ formatFileSize(maxSize) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.upload-zone {
  position: relative;
  padding: var(--space-12, 3rem);
  background: linear-gradient(135deg, var(--primary-50, #eef2ff), var(--primary-100, #e0e7ff));
  border: 2px dashed var(--primary-300, #a5b4fc);
  border-radius: var(--radius-2xl, 1.5rem);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.upload-zone:hover:not(.is-disabled) {
  background: linear-gradient(135deg, var(--primary-100, #e0e7ff), var(--primary-200, #c7d2fe));
  border-color: var(--primary-500, #6366f1);
  transform: scale(1.02);
}

.upload-zone.is-dragging {
  background: linear-gradient(135deg, var(--primary-200, #c7d2fe), var(--primary-300, #a5b4fc));
  border-color: var(--primary-600, #4f46e5);
  transform: scale(1.05);
  box-shadow: var(--shadow-xl, 0 20px 25px rgba(0, 0, 0, 0.15));
}

.upload-zone.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3, 0.75rem);
  text-align: center;
  pointer-events: none;
}

.upload-icon {
  font-size: 4rem;
  color: var(--primary-500, #6366f1);
  transition: transform var(--transition-base, 0.2s ease);
}

.upload-zone.is-dragging .upload-icon {
  transform: scale(1.2);
}

.upload-title {
  margin: 0;
  font-size: var(--text-xl, 1.25rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
}

.upload-subtitle {
  margin: 0;
  font-size: var(--text-base, 1rem);
  color: var(--text-secondary, #64748b);
}

.upload-hint {
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-tertiary, #94a3b8);
}

@media (max-width: 768px) {
  .upload-zone {
    padding: var(--space-8, 2rem);
  }

  .upload-icon {
    font-size: 3rem;
  }

  .upload-title {
    font-size: var(--text-lg, 1.125rem);
  }
}
</style>
