<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick, onMounted } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Button from 'primevue/button';

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
const popinStyle = ref<Record<string, string>>({});
const popinRef = ref<HTMLElement | null>(null);
const toolbarRef = ref<HTMLElement | null>(null);
const popinFlip = ref(false);

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
  nextTick(() => positionPopin());
};

const positionPopin = () => {
  const popin = popinRef.value;
  const toolbar = toolbarRef.value;
  if (!popin || !toolbar) return;
  const rect = toolbar.getBoundingClientRect();
  const popinRect = popin.getBoundingClientRect();
  const viewportH = window.innerHeight;
  // default below toolbar
  let top = rect.bottom + 8;
  let flip = false;
  // detect if toolbar is inside a modal/dialog (common classes: .modal, .p-dialog)
  const isInModal = (() => {
    let el: HTMLElement | null = toolbar;
    while (el) {
      if (
        el.classList &&
        (el.classList.contains('modal') ||
          el.classList.contains('p-dialog') ||
          el.getAttribute('role') === 'dialog')
      )
        return true;
      el = el.parentElement;
    }
    return false;
  })();

  // Always prefer above placement when in modal to avoid overlap with form fields
  if (isInModal) {
    if (rect.top - 16 - popinRect.height > 0) {
      top = rect.top - 16 - popinRect.height; // larger offset when above
      flip = true;
    } else if (rect.bottom + 16 + popinRect.height < viewportH) {
      // Only use below if there's enough space
      top = rect.bottom + 16;
      flip = false;
    } else {
      // Force above even if tight
      top = Math.max(8, rect.top - 16 - popinRect.height);
      flip = true;
    }
  } else {
    if (rect.bottom + 8 + popinRect.height > viewportH && rect.top - 8 - popinRect.height > 0) {
      // place above
      top = rect.top - 8 - popinRect.height;
      flip = true;
    }
  }
  let left = rect.left + rect.width / 2 - popinRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - popinRect.width - 8));
  popinFlip.value = flip;
  popinStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    transform: 'none',
  };

  // autofocus the URL input when popin positioned
  nextTick(() => {
    const input = document.getElementById('link-url') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  });
};

const closeLinkDialog = () => {
  showLinkDialog.value = false;
  linkUrl.value = '';
  linkText.value = '';
};

const onDocumentMouseDown = (e: MouseEvent) => {
  const popinEl = popinRef.value;
  const toolbarEl = toolbarRef.value;
  if (!popinEl) return;
  const target = e.target as Node | null;
  if (target && (popinEl.contains(target) || (toolbarEl && toolbarEl.contains(target)))) return;
  showLinkDialog.value = false;
};

const onDocumentKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') closeLinkDialog();
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
onMounted(() => {
  document.addEventListener('mousedown', onDocumentMouseDown);
  document.addEventListener('keydown', onDocumentKeyDown);
  window.addEventListener('resize', positionPopin);
  // capture scroll to reposition when modal or page scrolls
  window.addEventListener('scroll', positionPopin, true);
});

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentMouseDown);
  document.removeEventListener('keydown', onDocumentKeyDown);
  window.removeEventListener('resize', positionPopin);
  window.removeEventListener('scroll', positionPopin, true);
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

    <!-- Teleported popin rendered in body to avoid modal stacking issues -->
    <teleport to="body">
      <div
        v-if="showLinkDialog"
        ref="popinRef"
        class="link-popin"
        role="dialog"
        aria-modal="true"
        :style="popinStyle"
        :data-flip="popinFlip"
      >
        <div class="link-popin-inner" role="document">
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

          <div class="link-popin-actions">
            <button class="btn btn-secondary" type="button" @click="closeLinkDialog">
              Annuler
            </button>
            <button
              v-if="isActive('link')"
              class="btn btn-danger"
              type="button"
              @click="removeLink"
            >
              Supprimer le lien
            </button>
            <button class="btn btn-primary" type="button" @click="setLink">Insérer</button>
          </div>
        </div>
        <div class="link-popin-caret" aria-hidden="true"></div>
      </div>
    </teleport>
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

/* Popin styles */
.link-popin {
  position: fixed;
  left: 0;
  top: 0;
  transform: none;
  display: block;
  z-index: 9999999; /* ensure above modal overlays and dialogs */
  pointer-events: auto;
}

.link-popin[data-flip='true'] .link-popin-caret {
  transform: rotate(180deg);
  top: 100%;
}

.link-popin-inner {
  background: var(--color-surface);
  padding: 14px;
  border-radius: 10px;
  width: 380px;
  max-width: calc(100% - 32px);
  box-shadow: 0 12px 34px rgba(2, 6, 23, 0.26);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.link-popin-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.btn {
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
}
.btn-secondary {
  background: var(--color-surface-2);
}
.btn-danger {
  background: var(--color-danger);
  color: #fff;
}
.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

/* Underline style in editor */
:deep(.rich-text-editor-content u) {
  text-decoration: underline;
}

/* Link Dialog */
.link-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.text-input {
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 6px;
  font-size: 13px;
  font-family: var(--font-family);
  background: #ffffff;
  color: var(--color-text-primary);
  transition:
    border-color 0.12s,
    box-shadow 0.12s;
  box-shadow: none;
}

.link-popin .text-input {
  width: 100%;
  box-sizing: border-box;
}

.link-popin .field-label {
  margin-bottom: 4px;
}

.text-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 4px 18px rgba(12, 60, 140, 0.06);
}

.text-input::placeholder {
  color: var(--color-text-secondary);
}

.link-popin-caret {
  width: 18px;
  height: 10px;
  position: absolute;
  left: 50%;
  top: -10px;
  transform: translateX(-50%);
  background: transparent;
  pointer-events: none;
}

.link-popin-caret::after {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: 18px;
  height: 10px;
  background: var(--color-surface);
  transform-origin: center;
  transform: rotate(45deg) translateY(-55%);
  box-shadow: 0 12px 24px rgba(2, 6, 23, 0.12);
}

.link-popin[data-flip='true'] .link-popin-caret {
  top: 100%;
}

.link-popin[data-flip='true'] .link-popin-caret::after {
  transform: rotate(225deg) translateY(55%);
}
</style>
