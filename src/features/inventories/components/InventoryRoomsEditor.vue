<script setup lang="ts">
import { computed } from 'vue';
import Button from '@/shared/components/Button.vue';
import type { InventoryRoom, InventoryCondition } from '@/db/types';
import {
  STANDARD_ROOM_TEMPLATES,
  buildTemplateRooms,
  buildRoomItems,
} from '@/features/inventories/constants/roomTemplates';
import { CONDITION_LABEL } from '@/features/inventories/services/inventoryComparison';

const props = defineProps<{ modelValue: InventoryRoom[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: InventoryRoom[]] }>();

const rooms = computed(() => props.modelValue ?? []);

const CONDITIONS = Object.keys(CONDITION_LABEL) as InventoryCondition[];
const STANDARD_ROOM_NAMES = Object.keys(STANDARD_ROOM_TEMPLATES);

function update(next: InventoryRoom[]) {
  emit('update:modelValue', next);
}

function applyTemplate() {
  if (
    rooms.value.length > 0 &&
    !confirm('Remplacer les pièces actuelles par le modèle standard ?')
  ) {
    return;
  }
  update(buildTemplateRooms());
}

function addRoom(name?: string) {
  const roomName = (name ?? '').trim() || `Pièce ${rooms.value.length + 1}`;
  update([...rooms.value, { name: roomName, items: name ? buildRoomItems(roomName) : [] }]);
}

function removeRoom(index: number) {
  update(rooms.value.filter((_, i) => i !== index));
}

function renameRoom(index: number, name: string) {
  update(rooms.value.map((room, i) => (i === index ? { ...room, name } : room)));
}

function addItem(roomIndex: number) {
  update(
    rooms.value.map((room, i) =>
      i === roomIndex
        ? { ...room, items: [...room.items, { label: '', condition: 'good' as const }] }
        : room
    )
  );
}

function removeItem(roomIndex: number, itemIndex: number) {
  update(
    rooms.value.map((room, i) =>
      i === roomIndex ? { ...room, items: room.items.filter((_, j) => j !== itemIndex) } : room
    )
  );
}

function updateItem(
  roomIndex: number,
  itemIndex: number,
  patch: Partial<InventoryRoom['items'][number]>
) {
  update(
    rooms.value.map((room, i) =>
      i === roomIndex
        ? {
            ...room,
            items: room.items.map((item, j) => (j === itemIndex ? { ...item, ...patch } : item)),
          }
        : room
    )
  );
}
</script>

<template>
  <div class="rooms-editor" data-testid="inventory-rooms-editor">
    <div class="rooms-toolbar">
      <Button
        type="button"
        variant="default"
        size="sm"
        icon="auto-fix"
        @click="applyTemplate"
        data-testid="apply-template-button"
      >
        Modèle standard
      </Button>
      <div class="quick-add">
        <span class="quick-add-label">Ajouter une pièce :</span>
        <button
          v-for="name in STANDARD_ROOM_NAMES"
          :key="name"
          type="button"
          class="chip"
          @click="addRoom(name)"
        >
          + {{ name }}
        </button>
        <button type="button" class="chip chip-custom" @click="addRoom()">+ Autre</button>
      </div>
    </div>

    <p v-if="rooms.length === 0" class="empty-hint">
      Aucune pièce. Appliquez le modèle standard ou ajoutez une pièce.
    </p>

    <div v-for="(room, roomIndex) in rooms" :key="roomIndex" class="room-block">
      <div class="room-header">
        <input
          class="room-name-input"
          :value="room.name"
          placeholder="Nom de la pièce"
          @input="renameRoom(roomIndex, ($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          class="icon-button danger"
          title="Supprimer la pièce"
          @click="removeRoom(roomIndex)"
        >
          <i class="mdi mdi-delete"></i>
        </button>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Élément</th>
            <th>État</th>
            <th>Remarques</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, itemIndex) in room.items" :key="itemIndex">
            <td>
              <input
                class="cell-input"
                :value="item.label"
                placeholder="Élément"
                @input="
                  updateItem(roomIndex, itemIndex, {
                    label: ($event.target as HTMLInputElement).value,
                  })
                "
              />
            </td>
            <td>
              <select
                class="cell-input"
                :value="item.condition"
                @change="
                  updateItem(roomIndex, itemIndex, {
                    condition: ($event.target as HTMLSelectElement).value as InventoryCondition,
                  })
                "
              >
                <option v-for="c in CONDITIONS" :key="c" :value="c">
                  {{ CONDITION_LABEL[c] }}
                </option>
              </select>
            </td>
            <td>
              <input
                class="cell-input"
                :value="item.notes ?? ''"
                placeholder="Remarques"
                @input="
                  updateItem(roomIndex, itemIndex, {
                    notes: ($event.target as HTMLInputElement).value,
                  })
                "
              />
            </td>
            <td>
              <button
                type="button"
                class="icon-button danger"
                title="Supprimer l'élément"
                @click="removeItem(roomIndex, itemIndex)"
              >
                <i class="mdi mdi-close"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <Button type="button" variant="default" size="sm" icon="plus" @click="addItem(roomIndex)">
        Ajouter un élément
      </Button>
    </div>
  </div>
</template>

<style scoped>
.rooms-editor {
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 1rem);
}

.rooms-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3, 0.75rem);
}

.quick-add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.quick-add-label {
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-secondary, #64748b);
}

.chip {
  padding: 0.25rem 0.625rem;
  font-size: var(--text-sm, 0.875rem);
  color: var(--primary-700, #4338ca);
  background: var(--primary-50, #eef2ff);
  border: 1px solid var(--primary-200, #c7d2fe);
  border-radius: var(--radius-full, 9999px);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.chip:hover {
  background: var(--primary-100, #e0e7ff);
}

.chip-custom {
  color: var(--text-secondary, #64748b);
  background: var(--neutral-50, #f9fafb);
  border-color: var(--border-color, #e2e8f0);
}

.empty-hint {
  margin: 0;
  font-size: var(--text-sm, 0.875rem);
  color: var(--text-tertiary, #94a3b8);
}

.room-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-4, 1rem);
  background: var(--neutral-50, #f9fafb);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
}

.room-header {
  display: flex;
  align-items: center;
  gap: var(--space-2, 0.5rem);
}

.room-name-input {
  flex: 1;
  padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
  font-size: var(--text-base, 1rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-primary, #0f172a);
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  outline: none;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th {
  text-align: left;
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary, #64748b);
  padding: 0 0.25rem 0.25rem;
}

.items-table td {
  padding: 0.125rem 0.25rem;
  vertical-align: middle;
}

.cell-input {
  width: 100%;
  padding: var(--space-2, 0.5rem);
  font-size: var(--text-sm, 0.875rem);
  font-family: inherit;
  color: var(--text-primary, #0f172a);
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-md, 0.5rem);
  outline: none;
}

.cell-input:focus {
  border-color: var(--primary-500, #6366f1);
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  border-radius: var(--radius-md, 0.5rem);
  cursor: pointer;
  color: var(--text-tertiary, #94a3b8);
  transition: all var(--transition-base, 0.2s ease);
}

.icon-button.danger:hover {
  color: var(--error-500, #ef4444);
  background: var(--error-50, #fef2f2);
}
</style>
