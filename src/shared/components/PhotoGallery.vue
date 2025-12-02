<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePropertyPhotos } from '@/shared/composables/usePropertyPhotos';
import Button from './Button.vue';
import type { Document } from '@/db/types';

interface Props {
  propertyId: number;
  editable?: boolean;
  maxPhotos?: number;
}

const props = withDefaults(defineProps<Props>(), {
  editable: true,
  maxPhotos: 10,
});

const emit = defineEmits<{
  update: [];
}>();

const {
  isLoading,
  error,
  getPropertyPhotos,
  addPropertyPhoto,
  removePropertyPhoto,
  setPrimaryPhoto,
  createPhotoUrl,
  revokePhotoUrl,
} = usePropertyPhotos();

const photos = ref<Document[]>([]);
const photoUrls = ref<Map<number, string>>(new Map());
const fileInput = ref<HTMLInputElement | null>(null);
const selectedPhotoIndex = ref<number>(0);
const showLightbox = ref(false);

const canAddMore = computed(() => photos.value.length < props.maxPhotos);

async function loadPhotos() {
  photos.value = await getPropertyPhotos(props.propertyId);

  // Créer les URLs pour toutes les photos
  photoUrls.value.clear();
  photos.value.forEach(photo => {
    if (photo.id) {
      const url = createPhotoUrl(photo.data);
      photoUrls.value.set(photo.id, url);
    }
  });
}

function getPhotoUrl(photoId: number | undefined): string | null {
  if (!photoId) return null;
  return photoUrls.value.get(photoId) || null;
}

function triggerFileInput() {
  fileInput.value?.click();
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;

  if (!files?.length) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    if (!canAddMore.value) {
      alert(`Vous ne pouvez ajouter que ${props.maxPhotos} photos maximum`);
      break;
    }

    const result = await addPropertyPhoto(props.propertyId, file);
    if (result) {
      await loadPhotos();
      emit('update');
    }
  }

  // Reset input
  if (target) {
    target.value = '';
  }
}

async function handleRemove(photoId: number) {
  if (!confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) {
    return;
  }

  await removePropertyPhoto(props.propertyId, photoId);

  // Révoquer l'URL
  const url = photoUrls.value.get(photoId);
  if (url) {
    revokePhotoUrl(url);
    photoUrls.value.delete(photoId);
  }

  await loadPhotos();
  emit('update');
}

async function handleSetPrimary(photoId: number) {
  await setPrimaryPhoto(props.propertyId, photoId);
  await loadPhotos();
  emit('update');
}

function openLightbox(index: number) {
  selectedPhotoIndex.value = index;
  showLightbox.value = true;
}

function closeLightbox() {
  showLightbox.value = false;
}

function nextPhoto() {
  selectedPhotoIndex.value = (selectedPhotoIndex.value + 1) % photos.value.length;
}

function prevPhoto() {
  selectedPhotoIndex.value =
    (selectedPhotoIndex.value - 1 + photos.value.length) % photos.value.length;
}

function handleKeydown(event: KeyboardEvent) {
  if (!showLightbox.value) return;

  if (event.key === 'Escape') {
    closeLightbox();
  } else if (event.key === 'ArrowRight') {
    nextPhoto();
  } else if (event.key === 'ArrowLeft') {
    prevPhoto();
  }
}

onMounted(async () => {
  await loadPhotos();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  // Libérer toutes les URLs
  photoUrls.value.forEach(url => revokePhotoUrl(url));
  photoUrls.value.clear();
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="photo-gallery">
    <!-- Error message -->
    <div v-if="error" class="error-message">
      <i class="mdi mdi-alert-circle"></i>
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-if="!photos.length && !isLoading" class="empty-state">
      <i class="mdi mdi-image-off-outline"></i>
      <p>Aucune photo</p>
      <Button v-if="editable" variant="primary" icon="plus" @click="triggerFileInput">
        Ajouter une photo
      </Button>
    </div>

    <!-- Photos grid -->
    <div v-else class="photos-grid">
      <div
        v-for="(photo, index) in photos"
        :key="photo.id"
        class="photo-item"
        :class="{ 'is-primary': index === 0 }"
      >
        <img
          v-if="getPhotoUrl(photo.id)"
          :src="getPhotoUrl(photo.id)"
          :alt="photo.name"
          class="photo-image"
          @click="openLightbox(index)"
        />

        <div v-if="index === 0" class="primary-badge">
          <i class="mdi mdi-star"></i>
          Principale
        </div>

        <div v-if="editable" class="photo-actions">
          <button
            v-if="index !== 0"
            class="action-btn"
            title="Définir comme photo principale"
            @click.stop="photo.id && handleSetPrimary(photo.id)"
          >
            <i class="mdi mdi-star-outline"></i>
          </button>
          <button
            class="action-btn danger"
            title="Supprimer"
            @click.stop="photo.id && handleRemove(photo.id)"
          >
            <i class="mdi mdi-delete"></i>
          </button>
        </div>
      </div>

      <!-- Add photo button -->
      <div v-if="editable && canAddMore" class="add-photo-btn" @click="triggerFileInput">
        <i class="mdi mdi-plus"></i>
        <span>Ajouter</span>
      </div>
    </div>

    <!-- File input (hidden) -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      multiple
      style="display: none"
      @change="handleFileSelect"
    />

    <!-- Lightbox -->
    <Teleport to="body">
      <div v-if="showLightbox" class="lightbox" @click="closeLightbox">
        <button class="lightbox-close" @click.stop="closeLightbox">
          <i class="mdi mdi-close"></i>
        </button>

        <button class="lightbox-nav prev" @click.stop="prevPhoto">
          <i class="mdi mdi-chevron-left"></i>
        </button>

        <button class="lightbox-nav next" @click.stop="nextPhoto">
          <i class="mdi mdi-chevron-right"></i>
        </button>

        <div class="lightbox-content" @click.stop>
          <img
            v-if="photos[selectedPhotoIndex] && getPhotoUrl(photos[selectedPhotoIndex]?.id)"
            :src="getPhotoUrl(photos[selectedPhotoIndex]?.id)"
            :alt="photos[selectedPhotoIndex]?.name || 'Photo'"
          />
          <div class="lightbox-info">{{ selectedPhotoIndex + 1 }} / {{ photos.length }}</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.photo-gallery {
  width: 100%;
}

.error-message {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
  padding: var(--space-3, 0.75rem);
  background: var(--error-50, #fef2f2);
  color: var(--error-700, #b91c1c);
  border-radius: var(--radius-md, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12, 3rem);
  text-align: center;
  color: var(--text-tertiary, #94a3b8);
}

.empty-state i {
  font-size: 4rem;
  margin-bottom: var(--space-4, 1rem);
  opacity: 0.5;
}

.empty-state p {
  margin-bottom: var(--space-4, 1rem);
  font-size: var(--text-base, 1rem);
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4, 1rem);
}

.photo-item {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-lg, 0.75rem);
  overflow: hidden;
  cursor: pointer;
  transition: transform var(--transition-base, 0.2s ease);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
}

.photo-item.is-primary {
  border: 2px solid var(--primary-500, #6366f1);
}

.photo-item:hover {
  transform: scale(1.02);
}

.photo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.primary-badge {
  position: absolute;
  top: var(--space-2, 0.5rem);
  left: var(--space-2, 0.5rem);
  display: flex;
  align-items: center;
  gap: var(--space-1, 0.25rem);
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  background: var(--primary-500, #6366f1);
  color: white;
  border-radius: var(--radius-sm, 0.25rem);
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-weight-medium, 500);
}

.photo-actions {
  position: absolute;
  top: var(--space-2, 0.5rem);
  right: var(--space-2, 0.5rem);
  display: flex;
  gap: var(--space-2, 0.5rem);
  opacity: 0;
  transition: opacity var(--transition-base, 0.2s ease);
}

.photo-item:hover .photo-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  border-radius: var(--radius-md, 0.5rem);
  cursor: pointer;
  transition: background var(--transition-base, 0.2s ease);
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

.action-btn.danger:hover {
  background: var(--error-600, #dc2626);
}

.add-photo-btn {
  aspect-ratio: 4 / 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2, 0.5rem);
  border: 2px dashed var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  color: var(--text-tertiary, #94a3b8);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.add-photo-btn:hover {
  border-color: var(--primary-500, #6366f1);
  color: var(--primary-600, #4f46e5);
  background: var(--primary-50, #eef2ff);
}

.add-photo-btn i {
  font-size: 2rem;
}

/* Lightbox */
.lightbox {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.lightbox-close {
  position: absolute;
  top: var(--space-4, 1rem);
  right: var(--space-4, 1rem);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
  border-radius: var(--radius-full, 9999px);
  cursor: pointer;
  font-size: 1.5rem;
  z-index: 10002;
  transition: background var(--transition-base, 0.2s ease);
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.lightbox-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: none;
  border-radius: var(--radius-full, 9999px);
  cursor: pointer;
  font-size: 1.5rem;
  z-index: 10002;
  transition: background var(--transition-base, 0.2s ease);
}

.lightbox-nav:hover {
  background: rgba(255, 255, 255, 0.2);
}

.lightbox-nav.prev {
  left: var(--space-4, 1rem);
}

.lightbox-nav.next {
  right: var(--space-4, 1rem);
}

.lightbox-content {
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.lightbox-content img {
  max-width: 100%;
  max-height: calc(90vh - 4rem);
  object-fit: contain;
  border-radius: var(--radius-lg, 0.75rem);
}

.lightbox-info {
  text-align: center;
  color: white;
  font-size: var(--text-sm, 0.875rem);
}
</style>
