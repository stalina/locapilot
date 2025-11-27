import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BasePagination from './BasePagination.vue';

describe('BasePagination', () => {
  describe('Rendering', () => {
    it('should render pagination controls', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      expect(wrapper.find('.pagination').exists()).toBe(true);
      expect(wrapper.find('button[aria-label="Page précédente"]').exists()).toBe(true);
      expect(wrapper.find('button[aria-label="Page suivante"]').exists()).toBe(true);
    });

    it('should display correct page numbers', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 5,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const pageButtons = wrapper.findAll('button.page-number');
      expect(pageButtons.length).toBeGreaterThan(0);
      expect(wrapper.text()).toContain('5');
    });

    it('should show total items info', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      expect(wrapper.text()).toContain('1-10 sur 100');
    });

    it('should calculate correct range for last page', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 10,
          totalItems: 95,
          itemsPerPage: 10,
        },
      });

      expect(wrapper.text()).toContain('91-95 sur 95');
    });
  });

  describe('Navigation', () => {
    it('should emit page-change when clicking next button', async () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const nextButton = wrapper.find('button[aria-label="Page suivante"]');
      await nextButton.trigger('click');

      expect(wrapper.emitted('page-change')).toBeTruthy();
      expect(wrapper.emitted('page-change')?.[0]).toEqual([2]);
    });

    it('should emit page-change when clicking previous button', async () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 5,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const prevButton = wrapper.find('button[aria-label="Page précédente"]');
      await prevButton.trigger('click');

      expect(wrapper.emitted('page-change')).toBeTruthy();
      expect(wrapper.emitted('page-change')?.[0]).toEqual([4]);
    });

    it('should emit page-change when clicking page number', async () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const pageButtons = wrapper.findAll('button.page-number');
      // Click on page 3 (if visible)
      if (pageButtons.length > 2) {
        await pageButtons[2].trigger('click');
        expect(wrapper.emitted('page-change')).toBeTruthy();
      }
    });

    it('should disable previous button on first page', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const prevButton = wrapper.find('button[aria-label="Page précédente"]');
      expect(prevButton.attributes('disabled')).toBeDefined();
    });

    it('should disable next button on last page', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 10,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const nextButton = wrapper.find('button[aria-label="Page suivante"]');
      expect(nextButton.attributes('disabled')).toBeDefined();
    });

    it('should not emit page-change when clicking disabled button', async () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const prevButton = wrapper.find('button[aria-label="Page précédente"]');
      await prevButton.trigger('click');

      expect(wrapper.emitted('page-change')).toBeFalsy();
    });
  });

  describe('Items Per Page', () => {
    it('should render items per page selector', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      expect(wrapper.find('select').exists()).toBe(true);
    });

    it('should emit items-per-page-change when changing selection', async () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const select = wrapper.find('select');
      await select.setValue('20');

      expect(wrapper.emitted('items-per-page-change')).toBeTruthy();
      expect(wrapper.emitted('items-per-page-change')?.[0]).toEqual([20]);
    });

    it('should have default page size options', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const options = wrapper.findAll('select option');
      expect(options.length).toBeGreaterThan(0);
      expect(options.map(o => o.text())).toContain('10');
      expect(options.map(o => o.text())).toContain('20');
      expect(options.map(o => o.text())).toContain('50');
    });

    it('should use custom page size options when provided', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 25,
          pageSizeOptions: [25, 50, 100],
        },
      });

      const options = wrapper.findAll('select option');
      expect(options.map(o => o.text())).toContain('25');
      expect(options.map(o => o.text())).toContain('100');
    });
  });

  describe('Page Numbers Display', () => {
    it('should show ellipsis for many pages', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 10,
          totalItems: 500,
          itemsPerPage: 10,
        },
      });

      expect(wrapper.text()).toContain('...');
    });

    it('should limit visible page numbers', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 25,
          totalItems: 1000,
          itemsPerPage: 10,
        },
      });

      const pageButtons = wrapper.findAll('button.page-number');
      // Should not show all 100 pages
      expect(pageButtons.length).toBeLessThan(10);
    });

    it('should show current page as active', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 5,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const pageButtons = wrapper.findAll('button.page-number');
      const activeButton = pageButtons.find(btn => btn.text() === '5');
      expect(activeButton?.classes()).toContain('active');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single page', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 5,
          itemsPerPage: 10,
        },
      });

      const prevButton = wrapper.find('button[aria-label="Page précédente"]');
      const nextButton = wrapper.find('button[aria-label="Page suivante"]');

      expect(prevButton.attributes('disabled')).toBeDefined();
      expect(nextButton.attributes('disabled')).toBeDefined();
    });

    it('should handle zero items', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 0,
          itemsPerPage: 10,
        },
      });

      expect(wrapper.text()).toContain('0-0 sur 0');
    });

    it('should calculate total pages correctly', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 95,
          itemsPerPage: 10,
        },
      });

      // 95 items / 10 per page = 10 pages
      const pageButtons = wrapper.findAll('button.page-number');
      const hasPage10 = pageButtons.some(btn => btn.text() === '10');
      expect(hasPage10).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 5,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      expect(wrapper.find('[aria-label="Page précédente"]').exists()).toBe(true);
      expect(wrapper.find('[aria-label="Page suivante"]').exists()).toBe(true);
    });

    it('should have aria-current on current page', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 5,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      const pageButtons = wrapper.findAll('button.page-number');
      const currentButton = pageButtons.find(btn => btn.text() === '5');
      expect(currentButton?.attributes('aria-current')).toBe('page');
    });

    it('should have proper role for pagination nav', () => {
      const wrapper = mount(BasePagination, {
        props: {
          currentPage: 1,
          totalItems: 100,
          itemsPerPage: 10,
        },
      });

      expect(wrapper.find('nav').attributes('role')).toBe('navigation');
    });
  });
});
