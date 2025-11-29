<script setup lang="ts">
import { computed } from 'vue';
import DOMPurify from 'dompurify';

interface Props {
  content: string;
}

const props = defineProps<Props>();

// Configuration stricte de DOMPurify
const sanitizeConfig = {
  ALLOWED_TAGS: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 's', 'a', 'br'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

const sanitizedContent = computed(() => {
  if (!props.content) return '';
  return DOMPurify.sanitize(props.content, sanitizeConfig);
});

const isEmpty = computed(() => {
  // Vérifier si le contenu est vide après suppression des balises
  const textOnly = sanitizedContent.value.replace(/<[^>]*>/g, '').trim();
  return !textOnly;
});
</script>

<template>
  <div v-if="!isEmpty" class="rich-text-display" v-html="sanitizedContent"></div>
  <div v-else class="rich-text-display-empty">Aucune description</div>
</template>

<style scoped>
.rich-text-display {
  font-family: var(--font-family);
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-primary);
}

.rich-text-display-empty {
  font-family: var(--font-family);
  font-size: 14px;
  color: var(--color-text-secondary);
  font-style: italic;
}

/* Typography Styles */
:deep(h2) {
  font-size: 24px;
  font-weight: 600;
  margin: 24px 0 12px;
  color: var(--color-text-primary);
  line-height: 1.3;
}

:deep(h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 20px 0 10px;
  color: var(--color-text-primary);
  line-height: 1.4;
}

:deep(h2:first-child),
:deep(h3:first-child) {
  margin-top: 0;
}

:deep(p) {
  margin: 0 0 12px;
}

:deep(p:last-child) {
  margin-bottom: 0;
}

:deep(strong) {
  font-weight: 600;
  color: var(--color-text-primary);
}

:deep(em) {
  font-style: italic;
}

:deep(s) {
  text-decoration: line-through;
  color: var(--color-text-secondary);
}

/* Lists */
:deep(ul),
:deep(ol) {
  margin: 12px 0;
  padding-left: 24px;
}

:deep(li) {
  margin: 4px 0;
}

:deep(ul) {
  list-style-type: disc;
}

:deep(ol) {
  list-style-type: decimal;
}

/* Links */
:deep(a) {
  color: var(--color-primary);
  text-decoration: underline;
  transition: color 0.2s;
}

:deep(a:hover) {
  color: var(--color-primary-dark);
}

:deep(a:visited) {
  color: var(--color-primary);
}
</style>
