import { describe, it, expect } from 'vitest';
import { ref, nextTick } from 'vue';
import { useVirtualScroll, VIRTUAL_SCROLL_THRESHOLD } from './useVirtualScroll';

function makeItems(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

describe('useVirtualScroll', () => {
  it('exposes a default threshold of 100', () => {
    expect(VIRTUAL_SCROLL_THRESHOLD).toBe(100);
  });

  describe('below the threshold (fallback)', () => {
    it('renders every item and disables virtualization', () => {
      const items = ref(makeItems(50));
      const { isVirtual, visibleItems, topSpacerHeight, bottomSpacerHeight } = useVirtualScroll({
        items,
        itemHeight: 40,
        viewportHeight: 400,
        threshold: 100,
      });

      expect(isVirtual.value).toBe(false);
      expect(visibleItems.value).toHaveLength(50);
      expect(visibleItems.value[0]).toEqual({ item: 0, index: 0 });
      expect(visibleItems.value[49]).toEqual({ item: 49, index: 49 });
      expect(topSpacerHeight.value).toBe(0);
      expect(bottomSpacerHeight.value).toBe(0);
    });

    it('renders all items exactly at the threshold (boundary is exclusive)', () => {
      const items = ref(makeItems(100));
      const { isVirtual, visibleItems } = useVirtualScroll({
        items,
        itemHeight: 40,
        viewportHeight: 400,
        threshold: 100,
      });

      expect(isVirtual.value).toBe(false);
      expect(visibleItems.value).toHaveLength(100);
    });
  });

  describe('above the threshold (virtualized)', () => {
    it('mounts only a subset of items sized to the viewport plus overscan', () => {
      const items = ref(makeItems(500));
      const { isVirtual, visibleItems } = useVirtualScroll({
        items,
        itemHeight: 40,
        viewportHeight: 400, // 10 rows fit, + overscan 5*2 = 20 max
        threshold: 100,
        overscan: 5,
      });

      expect(isVirtual.value).toBe(true);
      // ceil(400/40) + 5*2 = 10 + 10 = 20 rows
      expect(visibleItems.value.length).toBeLessThan(500);
      expect(visibleItems.value).toHaveLength(20);
      // At scrollTop 0 the window starts at index 0
      expect(visibleItems.value[0]).toEqual({ item: 0, index: 0 });
    });

    it('spacers account for the non-rendered items and sum to the full height', () => {
      const items = ref(makeItems(500));
      const { visibleItems, topSpacerHeight, bottomSpacerHeight } = useVirtualScroll({
        items,
        itemHeight: 40,
        viewportHeight: 400,
        threshold: 100,
        overscan: 5,
      });

      const renderedHeight = visibleItems.value.length * 40;
      expect(topSpacerHeight.value + renderedHeight + bottomSpacerHeight.value).toBe(500 * 40);
      expect(topSpacerHeight.value).toBe(0); // at top
    });

    it('shifts the rendered window as the container scrolls', async () => {
      const items = ref(makeItems(500));
      const { visibleItems, topSpacerHeight, onScroll, scrollTop } = useVirtualScroll({
        items,
        itemHeight: 40,
        viewportHeight: 400,
        threshold: 100,
        overscan: 5,
      });

      const firstBefore = visibleItems.value[0]?.index;
      onScroll({ target: { scrollTop: 4000 } } as unknown as Event);
      await nextTick();

      expect(scrollTop.value).toBe(4000);
      // floor(4000/40) - overscan 5 = 100 - 5 = 95
      expect(visibleItems.value[0]?.index).toBe(95);
      expect(visibleItems.value[0]?.index).not.toBe(firstBefore);
      expect(topSpacerHeight.value).toBe(95 * 40);
    });

    it('never renders indices beyond the list length near the bottom', () => {
      const items = ref(makeItems(120));
      const { visibleItems, onScroll, bottomSpacerHeight } = useVirtualScroll({
        items,
        itemHeight: 40,
        viewportHeight: 400,
        threshold: 100,
        overscan: 5,
      });

      onScroll({ target: { scrollTop: 120 * 40 } } as unknown as Event);
      const indices = visibleItems.value.map(v => v.index);
      expect(Math.max(...indices)).toBeLessThanOrEqual(119);
      expect(visibleItems.value.at(-1)?.index).toBe(119);
      expect(bottomSpacerHeight.value).toBe(0);
    });
  });

  describe('filter reset', () => {
    it('resets scroll to the top when the reset key changes', async () => {
      const items = ref(makeItems(500));
      const filter = ref('all');
      const { onScroll, scrollTop, visibleItems, topSpacerHeight } = useVirtualScroll({
        items,
        itemHeight: 40,
        viewportHeight: 400,
        threshold: 100,
        resetKey: () => filter.value,
      });

      onScroll({ target: { scrollTop: 4000 } } as unknown as Event);
      await nextTick();
      expect(scrollTop.value).toBe(4000);

      filter.value = 'paid';
      await nextTick();

      expect(scrollTop.value).toBe(0);
      expect(topSpacerHeight.value).toBe(0);
      expect(visibleItems.value[0]?.index).toBe(0);
    });

    it('re-renders the correct subset after the underlying list shrinks below the threshold', async () => {
      const items = ref(makeItems(500));
      const filter = ref('all');
      const { isVirtual, visibleItems, resetScroll } = useVirtualScroll({
        items,
        itemHeight: 40,
        viewportHeight: 400,
        threshold: 100,
        resetKey: () => filter.value,
      });

      expect(isVirtual.value).toBe(true);

      // Simulate a filter narrowing the list below the threshold.
      items.value = makeItems(20);
      filter.value = 'narrow';
      resetScroll();
      await nextTick();

      expect(isVirtual.value).toBe(false);
      expect(visibleItems.value).toHaveLength(20);
    });
  });
});
