<script setup lang="ts">
import { ref, watch } from 'vue';
import Editor from 'primevue/editor';

interface Props {
  modelValue: string;
  placeholder?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Saisissez la description...',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const content = ref(props.modelValue || '');

// Sync external changes
watch(
  () => props.modelValue,
  newValue => {
    if (newValue !== content.value) {
      content.value = newValue || '';
    }
  }
);

// Emit changes
watch(content, newValue => {
  emit('update:modelValue', newValue);
});

// Quill modules configuration
const modules = {
  toolbar: [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link'],
    ['clean'],
  ],
};
</script>

<template>
  <div class="rich-text-editor">
    <Editor
      v-model="content"
      :placeholder="placeholder"
      :modules="modules"
      editorStyle="min-height: 200px"
    />
  </div>
</template>

<style scoped>
.rich-text-editor {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-background);
}

/* Override PrimeVue Editor styles */
.rich-text-editor :deep(.p-editor-container) {
  border: none;
}

.rich-text-editor :deep(.p-editor-toolbar) {
  display: none !important; /* Hide PrimeVue default toolbar */
}

.rich-text-editor :deep(.p-editor-content) {
  background: var(--color-background);
}

/* Quill toolbar styles */
.rich-text-editor :deep(.ql-toolbar) {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 8px;
}

.rich-text-editor :deep(.ql-editor) {
  min-height: 200px;
  padding: 16px;
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-primary);
}

.rich-text-editor :deep(.ql-editor.ql-blank::before) {
  color: var(--color-text-secondary);
  font-style: normal;
}

/* Rich Text Styles */
.rich-text-editor :deep(.ql-editor h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 24px 0 12px;
  color: var(--color-text-primary);
  line-height: 1.3;
}

.rich-text-editor :deep(.ql-editor h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 20px 0 10px;
  color: var(--color-text-primary);
  line-height: 1.4;
}

.rich-text-editor :deep(.ql-editor h2:first-child),
.rich-text-editor :deep(.ql-editor h3:first-child) {
  margin-top: 0;
}

.rich-text-editor :deep(.ql-editor p) {
  margin: 0 0 12px;
}

.rich-text-editor :deep(.ql-editor strong) {
  font-weight: 600;
}

.rich-text-editor :deep(.ql-editor em) {
  font-style: italic;
}

.rich-text-editor :deep(.ql-editor s) {
  text-decoration: line-through;
}

.rich-text-editor :deep(.ql-editor u) {
  text-decoration: underline;
}

.rich-text-editor :deep(.ql-editor ul),
.rich-text-editor :deep(.ql-editor ol) {
  margin: 12px 0;
  padding-left: 24px;
}

.rich-text-editor :deep(.ql-editor li) {
  margin: 4px 0;
}

.rich-text-editor :deep(.ql-editor a) {
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

.rich-text-editor :deep(.ql-editor a:hover) {
  color: var(--color-primary-dark);
}

/* Toolbar button styles */
.rich-text-editor :deep(.ql-toolbar button) {
  color: var(--color-text-primary);
  border-radius: 4px;
  transition: background-color 0.2s;
}

.rich-text-editor :deep(.ql-toolbar button:hover) {
  background-color: var(--color-surface-2);
}

.rich-text-editor :deep(.ql-toolbar button.ql-active) {
  background-color: var(--color-primary-light);
  color: var(--color-primary);
}

.rich-text-editor :deep(.ql-toolbar .ql-stroke) {
  stroke: currentColor;
}

.rich-text-editor :deep(.ql-toolbar .ql-fill) {
  fill: currentColor;
}
</style>
