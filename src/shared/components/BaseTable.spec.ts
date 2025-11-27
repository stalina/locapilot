import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import BaseTable from './BaseTable.vue';
import type { TableColumn } from './BaseTable.vue';

describe('BaseTable', () => {
  const mockColumns: TableColumn[] = [
    { key: 'name', label: 'Nom', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'status', label: 'Statut', sortable: false },
  ];

  const mockData = [
    { id: 1, name: 'Alice', email: 'alice@test.com', status: 'active' },
    { id: 2, name: 'Bob', email: 'bob@test.com', status: 'inactive' },
    { id: 3, name: 'Charlie', email: 'charlie@test.com', status: 'active' },
  ];

  describe('Rendering', () => {
    it('should render table with columns', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
      });

      expect(wrapper.find('table').exists()).toBe(true);
      expect(wrapper.findAll('th')).toHaveLength(mockColumns.length);
      expect(wrapper.text()).toContain('Nom');
      expect(wrapper.text()).toContain('Email');
      expect(wrapper.text()).toContain('Statut');
    });

    it('should render table rows with data', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
      });

      const rows = wrapper.findAll('tbody tr');
      expect(rows).toHaveLength(mockData.length);
      expect(wrapper.text()).toContain('Alice');
      expect(wrapper.text()).toContain('Bob');
      expect(wrapper.text()).toContain('Charlie');
    });

    it('should show empty state when no data', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: [],
        },
      });

      expect(wrapper.findComponent({ name: 'EmptyState' }).exists()).toBe(true);
    });

    it('should show custom empty message', () => {
      const customMessage = 'Aucun résultat trouvé';
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: [],
          emptyMessage: customMessage,
        },
      });

      expect(wrapper.text()).toContain(customMessage);
    });
  });

  describe('Sorting', () => {
    it('should display sort icons on sortable columns', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
      });

      const headers = wrapper.findAll('th');
      // First two columns are sortable
      expect(headers[0].classes()).toContain('cursor-pointer');
      expect(headers[1].classes()).toContain('cursor-pointer');
      // Third column is not sortable
      expect(headers[2].classes()).not.toContain('cursor-pointer');
    });

    it('should emit sort event when clicking sortable column', async () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
      });

      const firstHeader = wrapper.findAll('th')[0];
      await firstHeader.trigger('click');

      expect(wrapper.emitted('sort')).toBeTruthy();
      expect(wrapper.emitted('sort')?.[0]).toEqual([{ key: 'name', order: 'asc' }]);
    });

    it('should toggle sort order on consecutive clicks', async () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
      });

      const firstHeader = wrapper.findAll('th')[0];

      // First click: ascending
      await firstHeader.trigger('click');
      expect(wrapper.emitted('sort')?.[0]).toEqual([{ key: 'name', order: 'asc' }]);

      // Second click: descending
      await firstHeader.trigger('click');
      expect(wrapper.emitted('sort')?.[1]).toEqual([{ key: 'name', order: 'desc' }]);

      // Third click: back to ascending
      await firstHeader.trigger('click');
      expect(wrapper.emitted('sort')?.[2]).toEqual([{ key: 'name', order: 'asc' }]);
    });

    it('should not emit sort event on non-sortable column', async () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
      });

      const statusHeader = wrapper.findAll('th')[2];
      await statusHeader.trigger('click');

      expect(wrapper.emitted('sort')).toBeFalsy();
    });
  });

  describe('Row Selection', () => {
    it('should emit row-click event when row is clicked', async () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
      });

      const firstRow = wrapper.findAll('tbody tr')[0];
      await firstRow.trigger('click');

      expect(wrapper.emitted('row-click')).toBeTruthy();
      expect(wrapper.emitted('row-click')?.[0]).toEqual([mockData[0]]);
    });

    it('should apply hover class on row hover', async () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
      });

      const firstRow = wrapper.findAll('tbody tr')[0];
      expect(firstRow.classes()).toContain('hover:bg-gray-50');
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when loading', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
          loading: true,
        },
      });

      expect(wrapper.findComponent({ name: 'Spinner' }).exists()).toBe(true);
    });

    it('should not show data when loading', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
          loading: true,
        },
      });

      const rows = wrapper.findAll('tbody tr');
      expect(rows).toHaveLength(0);
    });
  });

  describe('Custom Slots', () => {
    it('should render custom cell content via slot', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
        slots: {
          'cell-name': '<span class="custom-name">{{ props.row.name }}</span>',
        },
      });

      expect(wrapper.find('.custom-name').exists()).toBe(true);
    });

    it('should render actions slot for each row', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
        slots: {
          actions: '<button class="action-btn">Edit</button>',
        },
      });

      const actionButtons = wrapper.findAll('.action-btn');
      expect(actionButtons).toHaveLength(mockData.length);
    });
  });

  describe('Column Formatting', () => {
    it('should apply custom formatter to cell values', () => {
      const columnsWithFormatter: TableColumn[] = [
        {
          key: 'name',
          label: 'Nom',
          sortable: true,
          formatter: (value: string) => value.toUpperCase(),
        },
      ];

      const wrapper = mount(BaseTable, {
        props: {
          columns: columnsWithFormatter,
          data: [{ name: 'alice' }],
        },
      });

      expect(wrapper.text()).toContain('ALICE');
    });
  });

  describe('Striped Rows', () => {
    it('should apply striped class when striped prop is true', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
          striped: true,
        },
      });

      const rows = wrapper.findAll('tbody tr');
      expect(rows[1].classes()).toContain('bg-gray-50');
    });

    it('should not apply striped class when striped prop is false', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
          striped: false,
        },
      });

      const rows = wrapper.findAll('tbody tr');
      expect(rows[1].classes()).not.toContain('bg-gray-50');
    });
  });

  describe('Accessibility', () => {
    it('should have proper table role', () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
      });

      expect(wrapper.find('table').attributes('role')).toBe('table');
    });

    it('should have sortable column aria-sort attributes', async () => {
      const wrapper = mount(BaseTable, {
        props: {
          columns: mockColumns,
          data: mockData,
        },
      });

      const firstHeader = wrapper.findAll('th')[0];
      await firstHeader.trigger('click');

      expect(firstHeader.attributes('aria-sort')).toBe('ascending');
    });
  });
});
