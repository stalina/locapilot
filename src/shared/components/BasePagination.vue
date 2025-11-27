<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  currentPage: number;
  totalItems: number;
  itemsPerPage?: number;
  maxVisiblePages?: number;
}

const props = withDefaults(defineProps<Props>(), {
  itemsPerPage: 10,
  maxVisiblePages: 7
});

const emit = defineEmits<{
  (e: 'update:currentPage', page: number): void;
  (e: 'update:itemsPerPage', itemsPerPage: number): void;
}>();

const totalPages = computed(() => Math.ceil(props.totalItems / props.itemsPerPage));

const visiblePages = computed(() => {
  const pages: (number | string)[] = [];
  const total = totalPages.value;
  const current = props.currentPage;
  const max = props.maxVisiblePages;

  if (total <= max) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    const leftSiblingIndex = Math.max(current - 1, 1);
    const rightSiblingIndex = Math.min(current + 1, total);

    const showLeftDots = leftSiblingIndex > 2;
    const showRightDots = rightSiblingIndex < total - 1;

    if (!showLeftDots && showRightDots) {
      const leftItemCount = 3;
      for (let i = 1; i <= leftItemCount; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    } else if (showLeftDots && !showRightDots) {
      pages.push(1);
      pages.push('...');
      const rightItemCount = 3;
      for (let i = total - rightItemCount + 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(total);
    }
  }

  return pages;
});

const startItem = computed(() => {
  if (props.totalItems === 0) return 0;
  return (props.currentPage - 1) * props.itemsPerPage + 1;
});

const endItem = computed(() => {
  const end = props.currentPage * props.itemsPerPage;
  return Math.min(end, props.totalItems);
});

const canGoPrevious = computed(() => props.currentPage > 1);
const canGoNext = computed(() => props.currentPage < totalPages.value);

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value && page !== props.currentPage) {
    emit('update:currentPage', page);
  }
};

const previousPage = () => {
  if (canGoPrevious.value) {
    goToPage(props.currentPage - 1);
  }
};

const nextPage = () => {
  if (canGoNext.value) {
    goToPage(props.currentPage + 1);
  }
};

const changeItemsPerPage = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  const newItemsPerPage = parseInt(target.value, 10);
  emit('update:itemsPerPage', newItemsPerPage);
  // Reset to page 1 when changing items per page
  if (props.currentPage > 1) {
    emit('update:currentPage', 1);
  }
};
</script>

<template>
  <div class="pagination">
    <div class="pagination-info">
      <span class="info-text">
        Affichage de {{ startItem }} à {{ endItem }} sur {{ totalItems }} résultats
      </span>
      <div class="items-per-page">
        <label for="items-per-page">Afficher :</label>
        <select
          id="items-per-page"
          :value="itemsPerPage"
          @change="changeItemsPerPage"
          class="items-select"
        >
          <option :value="10">10</option>
          <option :value="20">20</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>
    </div>

    <div class="pagination-controls">
      <button
        class="page-btn prev-btn"
        :disabled="!canGoPrevious"
        @click="previousPage"
        aria-label="Page précédente"
      >
        ‹
      </button>

      <button
        v-for="(page, index) in visiblePages"
        :key="index"
        class="page-btn"
        :class="{ 
          'active': page === currentPage,
          'dots': page === '...'
        }"
        :disabled="page === '...'"
        @click="typeof page === 'number' ? goToPage(page) : null"
      >
        {{ page }}
      </button>

      <button
        class="page-btn next-btn"
        :disabled="!canGoNext"
        @click="nextPage"
        aria-label="Page suivante"
      >
        ›
      </button>
    </div>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem 0;
}

.pagination-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: #6b7280;
}

.info-text {
  font-weight: 500;
}

.items-per-page {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.items-per-page label {
  font-weight: 500;
}

.items-select {
  padding: 0.375rem 2rem 0.375rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  color: #374151;
  background-color: white;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right 0.5rem center;
  background-repeat: no-repeat;
  background-size: 1.25em 1.25em;
  appearance: none;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.items-select:hover {
  border-color: #9ca3af;
}

.items-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.pagination-controls {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
}

.page-btn {
  min-width: 2.5rem;
  height: 2.5rem;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background-color: white;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-btn:hover:not(:disabled):not(.dots) {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.page-btn.active {
  background-color: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.page-btn.active:hover {
  background-color: #2563eb;
  border-color: #2563eb;
}

.page-btn.dots {
  border-color: transparent;
  cursor: default;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.prev-btn,
.next-btn {
  font-size: 1.25rem;
  font-weight: 600;
}

@media (max-width: 640px) {
  .pagination {
    gap: 0.75rem;
  }

  .pagination-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.8125rem;
  }

  .page-btn {
    min-width: 2rem;
    height: 2rem;
    font-size: 0.8125rem;
  }

  .prev-btn,
  .next-btn {
    font-size: 1rem;
  }
}
</style>
