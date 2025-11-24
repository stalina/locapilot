<script setup lang="ts">
import { ref, computed } from 'vue';

interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  status: 'paid' | 'pending' | 'overdue';
  amount: number;
}

interface Props {
  events?: CalendarEvent[];
  selectedDate?: Date;
}

const props = withDefaults(defineProps<Props>(), {
  events: () => [],
  selectedDate: () => new Date(),
});

const emit = defineEmits<{
  dateClick: [date: Date];
  eventClick: [event: CalendarEvent];
  monthChange: [date: Date];
}>();

const currentDate = ref(new Date(props.selectedDate));

// Computed
const year = computed(() => currentDate.value.getFullYear());
const month = computed(() => currentDate.value.getMonth());

const monthName = computed(() => {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentDate.value);
});

const daysInMonth = computed(() => {
  return new Date(year.value, month.value + 1, 0).getDate();
});

const firstDayOfMonth = computed(() => {
  const day = new Date(year.value, month.value, 1).getDay();
  return day === 0 ? 6 : day - 1; // Lundi = 0
});

const days = computed(() => {
  const result: Array<{ date: Date | null; isCurrentMonth: boolean; events: CalendarEvent[] }> = [];

  // Jours du mois précédent
  for (let i = 0; i < firstDayOfMonth.value; i++) {
    result.push({ date: null, isCurrentMonth: false, events: [] });
  }

  // Jours du mois actuel
  for (let day = 1; day <= daysInMonth.value; day++) {
    const date = new Date(year.value, month.value, day);
    const dayEvents = getEventsForDate(date);
    result.push({ date, isCurrentMonth: true, events: dayEvents });
  }

  return result;
});

// Methods
function getEventsForDate(date: Date): CalendarEvent[] {
  return props.events.filter(event => {
    const eventDate = new Date(event.date);
    return (
      eventDate.getDate() === date.getDate() &&
      eventDate.getMonth() === date.getMonth() &&
      eventDate.getFullYear() === date.getFullYear()
    );
  });
}

function previousMonth() {
  currentDate.value = new Date(year.value, month.value - 1, 1);
  emit('monthChange', currentDate.value);
}

function nextMonth() {
  currentDate.value = new Date(year.value, month.value + 1, 1);
  emit('monthChange', currentDate.value);
}

function today() {
  currentDate.value = new Date();
  emit('monthChange', currentDate.value);
}

function handleDateClick(date: Date | null) {
  if (date) {
    emit('dateClick', date);
  }
}

function handleEventClick(event: CalendarEvent, e: Event) {
  e.stopPropagation();
  emit('eventClick', event);
}

function getEventStatusClass(status: CalendarEvent['status']) {
  switch (status) {
    case 'paid':
      return 'event-paid';
    case 'pending':
      return 'event-pending';
    case 'overdue':
      return 'event-overdue';
    default:
      return '';
  }
}

function isToday(date: Date | null): boolean {
  if (!date) return false;
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}
</script>

<template>
  <div class="calendar">
    <!-- Header -->
    <div class="calendar-header">
      <button class="nav-button" @click="previousMonth">
        <i class="mdi mdi-chevron-left"></i>
      </button>
      <h2 class="month-name">{{ monthName }}</h2>
      <button class="nav-button" @click="nextMonth">
        <i class="mdi mdi-chevron-right"></i>
      </button>
      <button class="today-button" @click="today">
        Aujourd'hui
      </button>
    </div>

    <!-- Weekday Headers -->
    <div class="calendar-grid">
      <div class="weekday-header">Lun</div>
      <div class="weekday-header">Mar</div>
      <div class="weekday-header">Mer</div>
      <div class="weekday-header">Jeu</div>
      <div class="weekday-header">Ven</div>
      <div class="weekday-header">Sam</div>
      <div class="weekday-header">Dim</div>

      <!-- Days -->
      <div
        v-for="(day, index) in days"
        :key="index"
        class="calendar-day"
        :class="{
          'is-today': isToday(day.date),
          'is-other-month': !day.isCurrentMonth,
          'has-events': day.events.length > 0,
        }"
        @click="handleDateClick(day.date)"
      >
        <span v-if="day.date" class="day-number">
          {{ day.date.getDate() }}
        </span>

        <!-- Events -->
        <div v-if="day.events.length > 0" class="events-container">
          <div
            v-for="event in day.events.slice(0, 2)"
            :key="event.id"
            class="calendar-event"
            :class="getEventStatusClass(event.status)"
            @click="handleEventClick(event, $event)"
          >
            <span class="event-title">{{ event.title }}</span>
            <span class="event-amount">{{ event.amount }}€</span>
          </div>
          <div v-if="day.events.length > 2" class="more-events">
            +{{ day.events.length - 2 }} autres
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar {
  background: white;
  border-radius: var(--radius-xl, 1rem);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
  padding: var(--space-6, 1.5rem);
}

.calendar-header {
  display: flex;
  align-items: center;
  gap: var(--space-4, 1rem);
  margin-bottom: var(--space-6, 1.5rem);
}

.nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--bg-secondary, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
  font-size: 1.25rem;
  color: var(--text-primary, #0f172a);
}

.nav-button:hover {
  background: var(--bg-primary, #ffffff);
  border-color: var(--primary-300, #a5b4fc);
}

.month-name {
  flex: 1;
  margin: 0;
  font-size: var(--text-2xl, 1.5rem);
  font-weight: var(--font-weight-bold, 700);
  text-transform: capitalize;
  color: var(--text-primary, #0f172a);
}

.today-button {
  padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  font-family: inherit;
  color: var(--primary-600, #4f46e5);
  background: var(--primary-50, #eef2ff);
  border: 1px solid var(--primary-200, #c7d2fe);
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
}

.today-button:hover {
  background: var(--primary-100, #e0e7ff);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--space-2, 0.5rem);
}

.weekday-header {
  padding: var(--space-3, 0.75rem);
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-secondary, #64748b);
  text-align: center;
  text-transform: uppercase;
}

.calendar-day {
  min-height: 120px;
  padding: var(--space-2, 0.5rem);
  background: var(--bg-secondary, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: var(--radius-lg, 0.75rem);
  cursor: pointer;
  transition: all var(--transition-base, 0.2s ease);
  position: relative;
  overflow: hidden;
}

.calendar-day:hover {
  background: var(--bg-primary, #ffffff);
  border-color: var(--primary-300, #a5b4fc);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
}

.calendar-day.is-other-month {
  opacity: 0.3;
  pointer-events: none;
}

.calendar-day.is-today {
  background: linear-gradient(135deg, var(--primary-50, #eef2ff), var(--primary-100, #e0e7ff));
  border-color: var(--primary-300, #a5b4fc);
}

.calendar-day.is-today .day-number {
  color: var(--primary-600, #4f46e5);
  font-weight: var(--font-weight-bold, 700);
}

.day-number {
  display: block;
  font-size: var(--text-sm, 0.875rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #0f172a);
  margin-bottom: var(--space-2, 0.5rem);
}

.events-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-1, 0.25rem);
}

.calendar-event {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
  font-size: var(--text-xs, 0.75rem);
  border-radius: var(--radius-md, 0.5rem);
  cursor: pointer;
  transition: transform var(--transition-base, 0.2s ease);
}

.calendar-event:hover {
  transform: scale(1.02);
}

.event-paid {
  background: linear-gradient(135deg, #d1fae5, #a7f3d0);
  color: #065f46;
}

.event-pending {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #92400e;
}

.event-overdue {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  color: #991b1b;
}

.event-title {
  font-weight: var(--font-weight-medium, 500);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-amount {
  font-weight: var(--font-weight-semibold, 600);
  margin-left: var(--space-2, 0.5rem);
  flex-shrink: 0;
}

.more-events {
  padding: var(--space-1, 0.25rem);
  font-size: var(--text-xs, 0.75rem);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-secondary, #64748b);
  text-align: center;
}

@media (max-width: 768px) {
  .calendar-day {
    min-height: 80px;
  }

  .event-title {
    display: none;
  }

  .calendar-event {
    justify-content: center;
  }
}
</style>
