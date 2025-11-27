<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'primary' | 'white' | 'gray'
}

withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'primary',
})

const sizeClasses = {
  sm: 'spinner-sm',
  md: 'spinner-md',
  lg: 'spinner-lg',
  xl: 'spinner-xl',
}

const variantClasses = {
  primary: 'spinner-primary',
  white: 'spinner-white',
  gray: 'spinner-gray',
}
</script>

<template>
  <div :class="['spinner', sizeClasses[size], variantClasses[variant]]" role="status" aria-live="polite">
    <svg class="spinner-svg" viewBox="0 0 50 50">
      <circle
        class="spinner-circle"
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke-width="4"
      ></circle>
    </svg>
    <span class="sr-only">Chargement...</span>
  </div>
</template>

<style scoped>
.spinner {
  display: inline-block;
  animation: rotate 2s linear infinite;
}

.spinner-svg {
  display: block;
}

.spinner-circle {
  stroke: currentColor;
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

/* Sizes */
.spinner-sm {
  width: 1rem;
  height: 1rem;
}

.spinner-md {
  width: 1.5rem;
  height: 1.5rem;
}

.spinner-lg {
  width: 2.5rem;
  height: 2.5rem;
}

.spinner-xl {
  width: 4rem;
  height: 4rem;
}

/* Variants */
.spinner-primary {
  color: var(--primary-600, #4f46e5);
}

.spinner-white {
  color: white;
}

.spinner-gray {
  color: var(--neutral-400, #94a3b8);
}

/* Animations */
@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}

/* Screen reader only */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
