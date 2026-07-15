import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';

/**
 * Number of items above which viewport virtualization kicks in.
 * Below this threshold, the caller renders every item as before (no overhead).
 */
export const VIRTUAL_SCROLL_THRESHOLD = 100;

export interface UseVirtualScrollOptions<T> {
  /** The already-filtered / sorted list to render. */
  items: Ref<T[]> | ComputedRef<T[]>;
  /** Estimated height of a single item (row/card) in pixels. */
  itemHeight: number;
  /** Height of the scroll viewport in pixels (fixed container height). */
  viewportHeight: number;
  /** Items above the threshold activate virtualization. Defaults to {@link VIRTUAL_SCROLL_THRESHOLD}. */
  threshold?: number;
  /** Extra items rendered above and below the viewport to avoid blank flashes. */
  overscan?: number;
  /**
   * Function returning a reactive key; whenever its value changes the scroll
   * position is reset to the top (used on filter / search / sort changes).
   */
  resetKey?: () => unknown;
  /**
   * Optional externally-owned scroll container ref (e.g. from `useTemplateRef`).
   * When provided, it is used for DOM-level scroll resets and the caller binds
   * it to the container element; otherwise the composable creates its own.
   */
  containerRef?: Readonly<Ref<HTMLElement | null>>;
}

export interface VirtualItem<T> {
  item: T;
  index: number;
}

export interface UseVirtualScrollReturn<T> {
  /** Element ref used for the scroll container (own or the caller-provided one). */
  containerRef: Readonly<Ref<HTMLElement | null>>;
  /** True when the list exceeds the threshold and virtualization is active. */
  isVirtual: ComputedRef<boolean>;
  /** The subset of items to actually render (all items when not virtual). */
  visibleItems: ComputedRef<VirtualItem<T>[]>;
  /** Spacer height (px) that stands in for items above the rendered window. */
  topSpacerHeight: ComputedRef<number>;
  /** Spacer height (px) that stands in for items below the rendered window. */
  bottomSpacerHeight: ComputedRef<number>;
  /** Current scroll offset, exposed mainly for testing. */
  scrollTop: Ref<number>;
  /** Scroll event handler to bind on the container. */
  onScroll: (event: Event) => void;
  /** Resets scroll position to the top (state + DOM). */
  resetScroll: () => void;
}

/**
 * Lightweight windowing composable. Renders only the items visible in the
 * viewport (plus an overscan margin) once the list grows past a threshold,
 * keeping the caller's own markup/CSS intact via top/bottom spacers.
 *
 * Below the threshold it is a transparent pass-through: every item is returned,
 * spacers are zero and no scroll container behaviour is required.
 */
export function useVirtualScroll<T>(
  options: UseVirtualScrollOptions<T>
): UseVirtualScrollReturn<T> {
  const { items, itemHeight, viewportHeight } = options;
  const threshold = options.threshold ?? VIRTUAL_SCROLL_THRESHOLD;
  const overscan = options.overscan ?? 5;

  const containerRef: Readonly<Ref<HTMLElement | null>> =
    options.containerRef ?? ref<HTMLElement | null>(null);
  const scrollTop = ref(0);

  const isVirtual = computed(() => items.value.length > threshold);

  const startIndex = computed(() => {
    if (!isVirtual.value) return 0;
    const first = Math.floor(scrollTop.value / itemHeight) - overscan;
    return Math.max(0, first);
  });

  const endIndex = computed(() => {
    const total = items.value.length;
    if (!isVirtual.value) return total;
    const visibleCount = Math.ceil(viewportHeight / itemHeight) + overscan * 2;
    return Math.min(total, startIndex.value + visibleCount);
  });

  const visibleItems = computed<VirtualItem<T>[]>(() => {
    if (!isVirtual.value) {
      return items.value.map((item, index) => ({ item, index }));
    }
    const result: VirtualItem<T>[] = [];
    for (let index = startIndex.value; index < endIndex.value; index++) {
      result.push({ item: items.value[index] as T, index });
    }
    return result;
  });

  const topSpacerHeight = computed(() => (isVirtual.value ? startIndex.value * itemHeight : 0));

  const bottomSpacerHeight = computed(() =>
    isVirtual.value ? (items.value.length - endIndex.value) * itemHeight : 0
  );

  function onScroll(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target) scrollTop.value = target.scrollTop;
  }

  function resetScroll(): void {
    scrollTop.value = 0;
    if (containerRef.value) containerRef.value.scrollTop = 0;
  }

  if (options.resetKey) {
    watch(options.resetKey, () => resetScroll());
  }

  return {
    containerRef,
    isVirtual,
    visibleItems,
    topSpacerHeight,
    bottomSpacerHeight,
    scrollTop,
    onScroll,
    resetScroll,
  };
}
