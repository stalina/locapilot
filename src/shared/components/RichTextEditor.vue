<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';

interface Props {
  modelValue: string;
  placeholder?: string;
  maxSize?: number; // en bytes
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Saisissez la description...',
  maxSize: 50 * 1024, // 50KB par défaut
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const showLinkDialog = ref(false);
const linkUrl = ref('');
const linkText = ref('');

const buildExtensions = () => {
  // Base extensions (StarterKit + Placeholder)
  const base = [
    StarterKit.configure({ heading: { levels: [2, 3] } }),
    Placeholder.configure({ placeholder: props.placeholder }),
  ];

  // Collect names exposed by base extensions to avoid duplicates
  const collectNames = (ext: any, out: string[] = []) => {
    if (!ext) return out;
    if (ext.name) out.push(ext.name);
    if (Array.isArray(ext.extensions)) ext.extensions.forEach((c: any) => collectNames(c, out));
    return out;
  };

  const seen = new Set<string>();
  base.forEach(e => collectNames(e).forEach((n: string) => n && seen.add(n)));

  const extras: any[] = [];
  if (!seen.has('link')) {
    extras.push(
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      })
    );
  }
  if (!seen.has('underline')) extras.push(Underline);

  return [...base, ...extras];
};

const editor = useEditor({
  content: props.modelValue,
  extensions: buildExtensions(),
  editorProps: {
    attributes: {
      class: 'rich-text-editor-content',
    },
  },
  onUpdate: () => {
    const html = editor.value?.getHTML() || '';
    emit('update:modelValue', html);
  },
});

// Sync external changes to editor
watch(
  () => props.modelValue,
  value => {
    const isSame = editor.value?.getHTML() === value;
    if (!isSame && editor.value) {
      editor.value.commands.setContent(value || '', { emitUpdate: false });
    }
  }
);

// Toolbar actions
const toggleBold = () => editor.value?.chain().focus().toggleBold().run();
const toggleItalic = () => editor.value?.chain().focus().toggleItalic().run();
const toggleStrike = () => editor.value?.chain().focus().toggleStrike().run();
const toggleUnderline = () => editor.value?.chain().focus().toggleUnderline().run();
const toggleHeading2 = () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run();
const toggleHeading3 = () => editor.value?.chain().focus().toggleHeading({ level: 3 }).run();
const toggleBulletList = () => editor.value?.chain().focus().toggleBulletList().run();
const toggleOrderedList = () => editor.value?.chain().focus().toggleOrderedList().run();
const clearFormatting = () => editor.value?.chain().focus().clearNodes().unsetAllMarks().run();

const openLinkDialog = () => {
  const previousUrl = editor.value?.getAttributes('link').href || '';
  linkUrl.value = previousUrl;
  linkText.value =
    editor.value?.state.doc.textBetween(
      editor.value?.state.selection.from,
      editor.value?.state.selection.to,
      ''
    ) || '';
  showLinkDialog.value = true;
};

const closeLinkDialog = () => {
  showLinkDialog.value = false;
  linkUrl.value = '';
  linkText.value = '';
};

const setLink = () => {
  if (!linkUrl.value) {
    showLinkDialog.value = false;
    return;
  }

  // Validation basique d'URL
  const urlPattern = /^https?:\/\/.+/i;
  if (!urlPattern.test(linkUrl.value)) {
    alert('URL invalide. Veuillez saisir une URL complète (http:// ou https://)');
    return;
  }

  // Si du texte est sélectionné, on ajoute le lien
  // Sinon on insère le texte avec le lien
  if (editor.value?.state.selection.empty) {
    editor.value
      ?.chain()
      .focus()
      .insertContent(`<a href="${linkUrl.value}">${linkText.value || linkUrl.value}</a> `)
      .run();
  } else {
    editor.value?.chain().focus().setLink({ href: linkUrl.value }).run();
  }

  showLinkDialog.value = false;
  linkUrl.value = '';
  linkText.value = '';
};

const removeLink = () => {
  editor.value?.chain().focus().unsetLink().run();
  showLinkDialog.value = false;
};

// Check if format is active
const isActive = (name: string, attrs = {}) => {
  return editor.value?.isActive(name, attrs) || false;
};

// Cleanup
onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<template>
  <div class="rich-text-editor">
    <!-- Toolbar -->
    <div v-if="editor" class="editor-toolbar">
      <div class="toolbar-group">
        <Button
          label="B"
          text
          rounded
          :severity="isActive('bold') ? 'primary' : 'secondary'"
          @click="toggleBold"
          title="Gras (Ctrl+B)"
          aria-label="Gras"
        />
        <Button
          label="I"
          text
          rounded
          :severity="isActive('italic') ? 'primary' : 'secondary'"
          @click="toggleItalic"
          title="Italique (Ctrl+I)"
          aria-label="Italique"
        />
        <Button
          label="U"
          text
          rounded
          :severity="isActive('underline') ? 'primary' : 'secondary'"
          @click="toggleUnderline"
          title="Souligné"
        />
        <Button
          icon="pi pi-minus"
          text
          rounded
          :severity="isActive('strike') ? 'primary' : 'secondary'"
          @click="toggleStrike"
          title="Barré"
        />
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <Button
          label="H2"
          text
          rounded
          :severity="isActive('heading', { level: 2 }) ? 'primary' : 'secondary'"
          @click="toggleHeading2"
          title="Titre 2"
        />
        <Button
          label="H3"
          text
          rounded
          :severity="isActive('heading', { level: 3 }) ? 'primary' : 'secondary'"
          @click="toggleHeading3"
          title="Titre 3"
        />
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <Button
          icon="pi pi-list"
          text
          rounded
          :severity="isActive('bulletList') ? 'primary' : 'secondary'"
          @click="toggleBulletList"
          title="Liste à puces"
        />
        <Button
          icon="pi pi-bars"
          text
          rounded
          :severity="isActive('orderedList') ? 'primary' : 'secondary'"
          @click="toggleOrderedList"
          title="Liste numérotée"
        />
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group" style="position: relative" ref="toolbarRef">
        <Button
          icon="pi pi-link"
          text
          rounded
          :severity="isActive('link') ? 'primary' : 'secondary'"
          @click="openLinkDialog"
          title="Ajouter un lien"
        />
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <Button
          icon="pi pi-times"
          text
          rounded
          severity="secondary"
          @click="clearFormatting"
          title="Effacer le formatage"
        />
      </div>
    </div>

    <!-- Editor Content -->
    <EditorContent :editor="editor" />

    <!-- Dialog PrimeVue pour l'insertion de lien -->
    <Dialog
      v-model:visible="showLinkDialog"
      modal
      header="Ajouter un lien"
      :style="{ width: '450px' }"
      :dismissableMask="true"
    >
      <div class="link-dialog">
        <div class="field">
          <label for="link-url" class="field-label">URL</label>
          <input
            id="link-url"
            v-model="linkUrl"
            type="url"
            class="text-input"
            placeholder="https://exemple.com"
            @keyup.enter="setLink"
            autofocus
          />
        </div>
        <div class="field">
          <label for="link-text" class="field-label">Texte du lien (optionnel)</label>
          <input
            id="link-text"
            v-model="linkText"
            type="text"
            class="text-input"
            placeholder="Cliquez ici"
            @keyup.enter="setLink"
          />
        </div>
      </div>

      <template #footer>
        <Button label="Annuler" severity="secondary" @click="closeLinkDialog" />
        <Button
          v-if="isActive('link')"
          label="Supprimer le lien"
          severity="danger"
          @click="removeLink"
        />
        <Button label="Insérer" @click="setLink" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.rich-text-editor {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: visible;
  background: var(--color-background);
  position: relative;
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.toolbar-group {
  display: flex;
  gap: 4px;
}

.toolbar-divider {
  width: 1px;
  background: var(--color-border);
  margin: 0 4px;
}

/* Editor Content Styles */
:deep(.rich-text-editor-content) {
  min-height: 200px;
  padding: 16px;
  outline: none;
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 1.6;
}

:deep(.rich-text-editor-content p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--color-text-secondary);
  pointer-events: none;
  height: 0;
  float: left;
}

/* Rich Text Styles */
:deep(.rich-text-editor-content h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 24px 0 12px;
  color: var(--color-text-primary);
  line-height: 1.3;
}

:deep(.rich-text-editor-content h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 20px 0 10px;
  color: var(--color-text-primary);
  line-height: 1.4;
}

:deep(.rich-text-editor-content h2:first-child),
:deep(.rich-text-editor-content h3:first-child) {
  margin-top: 0;
}

:deep(.rich-text-editor-content p) {
  margin: 0 0 12px;
}

:deep(.rich-text-editor-content strong) {
  font-weight: 600;
}

:deep(.rich-text-editor-content em) {
  font-style: italic;
}

:deep(.rich-text-editor-content s) {
  text-decoration: line-through;
}

:deep(.rich-text-editor-content ul),
:deep(.rich-text-editor-content ol) {
  margin: 12px 0;
  padding-left: 24px;
}

:deep(.rich-text-editor-content li) {
  margin: 4px 0;
}

:deep(.rich-text-editor-content a) {
  color: var(--color-primary);
  text-decoration: underline;
  cursor: pointer;
}

:deep(.rich-text-editor-content a:hover) {
  color: var(--color-primary-dark);
}

/* Underline style in editor */
:deep(.rich-text-editor-content u) {
  text-decoration: underline;
}

/* Link Dialog Styles */
.link-dialog {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.text-input {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 14px;
  font-family: var(--font-family);
  background: var(--color-background);
  color: var(--color-text-primary);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  width: 100%;
  box-sizing: border-box;
}

.text-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1);
}

.text-input::placeholder {
  color: var(--color-text-secondary);
}
</style>
