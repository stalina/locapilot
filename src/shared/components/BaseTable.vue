<template>
  <div class="base-table">
    <div v-if="loading" class="table-loading">
      <Spinner />
    </div>

    <div v-else-if="data.length === 0" class="table-empty">
      <EmptyState :icon="emptyIcon" :message="emptyMessage" :description="emptyDescription">
        <template v-if="$slots.emptyAction" #action>
          <slot name="emptyAction" />
        </template>
      </EmptyState>
    </div>

    <div v-else class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="[
                'table-header',
                { sortable: column.sortable },
                { sorted: sortBy === column.key },
              ]"
              :style="{ width: column.width }"
              @click="column.sortable ? handleSort(column.key) : null"
            >
              <div class="header-content">
                <span>{{ column.label }}</span>
                <span v-if="column.sortable && sortBy === column.key" class="sort-icon">
                  {{ sortOrder === 'asc' ? '↑' : '↓' }}
                </span>
              </div>
            </th>
            <th v-if="$slots.actions" class="table-header actions-header">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in sortedData"
            :key="getRowKey(item, index)"
            class="table-row"
            :class="{ clickable: clickable }"
            @click="clickable ? $emit('row-click', item) : null"
          >
            <td v-for="column in columns" :key="column.key" class="table-cell">
              <slot
                :name="`cell-${column.key}`"
                :item="item"
                :value="getNestedValue(item, column.key)"
              >
                {{ formatCellValue(item, column) }}
              </slot>
            </td>
            <td v-if="$slots.actions" class="table-cell actions-cell">
              <slot name="actions" :item="item" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends object">
import { computed, ref } from 'vue';
import Spinner from './Spinner.vue';
import EmptyState from './EmptyState.vue';

export interface TableColumn<Row = unknown> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  formatter?: (value: unknown, item: Row) => string;
}

interface Props {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  clickable?: boolean;
  rowKey?: string;
  emptyIcon?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  defaultSort?: string;
  defaultSortOrder?: 'asc' | 'desc';
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  clickable: false,
  rowKey: 'id',
  emptyIcon: '📋',
  emptyMessage: 'Aucune donnée',
  emptyDescription: "Il n'y a aucune donnée à afficher pour le moment.",
  defaultSortOrder: 'asc',
});

defineEmits<{
  (e: 'row-click', item: T): void;
}>();

const sortBy = ref<string>(props.defaultSort || '');
const sortOrder = ref<'asc' | 'desc'>(props.defaultSortOrder);

const handleSort = (columnKey: string) => {
  if (sortBy.value === columnKey) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = columnKey;
    sortOrder.value = 'asc';
  }
};

const getNestedValue = (obj: unknown, path: string): unknown => {
  return path
    .split('.')
    .reduce<unknown>(
      (value, key) => (value as Record<string, unknown> | null | undefined)?.[key],
      obj
    );
};

const sortedData = computed(() => {
  if (!sortBy.value) {
    return props.data;
  }

  return [...props.data].sort((a, b) => {
    // Cell values are heterogeneous (strings, numbers, dates…); `>` relies on
    // JS's native relational comparison, exactly as before typing.
    const aValue = getNestedValue(a, sortBy.value) as string | number;
    const bValue = getNestedValue(b, sortBy.value) as string | number;

    if (aValue === bValue) return 0;

    const comparison = aValue > bValue ? 1 : -1;
    return sortOrder.value === 'asc' ? comparison : -comparison;
  });
});

const getRowKey = (item: T, index: number): string | number => {
  return (getNestedValue(item, props.rowKey) as string | number | null | undefined) ?? index;
};

const formatCellValue = (item: T, column: TableColumn<T>): string => {
  const value = getNestedValue(item, column.key);

  if (column.formatter) {
    return column.formatter(value, item);
  }

  if (value === null || value === undefined) {
    return '-';
  }

  return String(value);
};
</script>

<style scoped>
.base-table {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.table-loading,
.table-empty {
  padding: 3rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.table-wrapper {
  overflow-x: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table-header {
  background-color: #f9fafb;
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e5e7eb;
}

.table-header.sortable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s;
}

.table-header.sortable:hover {
  background-color: #f3f4f6;
}

.table-header.sorted {
  color: #3b82f6;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sort-icon {
  font-size: 0.875rem;
  color: #3b82f6;
}

.actions-header {
  text-align: right;
}

.table-row {
  border-bottom: 1px solid #e5e7eb;
  transition: background-color 0.15s;
}

.table-row:hover {
  background-color: #f9fafb;
}

.table-row.clickable {
  cursor: pointer;
}

.table-row:last-child {
  border-bottom: none;
}

.table-cell {
  padding: 1rem;
  color: #374151;
  font-size: 0.875rem;
}

.actions-cell {
  text-align: right;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .table-header,
  .table-cell {
    padding: 0.75rem 0.5rem;
    font-size: 0.8125rem;
  }
}
</style>
