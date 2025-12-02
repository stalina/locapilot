<template>
  <div class="tenant-documents-uploader">
    <input type="file" ref="fileInput" @change="onFileChange" />
    <button @click="triggerFile">Choisir un fichier</button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useTenantsStore } from '../stores/tenantsStore';

const props = defineProps<{ tenantId: number }>();

const fileInput = ref<HTMLInputElement | null>(null);
const store = useTenantsStore();

function triggerFile() {
  fileInput.value?.click();
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files && input.files[0];
  if (!file) return;

  try {
    await store.addTenantDocument(props.tenantId, {
      name: file.name,
      mimeType: file.type,
      size: file.size,
      data: file,
    });
    // Optionally emit event or refresh list
  } catch (err) {
    console.error('Upload failed', err);
  } finally {
    if (fileInput.value) fileInput.value.value = '';
  }
}
</script>

<style scoped>
.tenant-documents-uploader {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style>

<script lang="ts">
export default {};
</script>
