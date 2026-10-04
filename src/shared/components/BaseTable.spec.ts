import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors, type Theme } from '@/test/themeColors';

describe('BaseTable theme colours', () => {
  const resolve = themeColors('src/shared/components/BaseTable.vue');
  const header = (property: string, theme: Theme) => resolve(property, ['.table-header'], theme);
  const sortableHover = (theme: Theme) =>
    resolve('background-color', ['.table-header', '.table-header.sortable:hover'], theme);
  const sorted = (theme: Theme) =>
    resolve('color', ['.table-header', '.table-header.sorted'], theme);
  const cell = (theme: Theme) => resolve('color', ['.table-cell'], theme);

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it('keeps the column headers readable', () => {
      expect(
        contrastRatio(header('color', theme), header('background-color', theme))
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the cells readable on the table and on a hovered row', () => {
      expect(
        contrastRatio(cell(theme), resolve('background', ['.base-table'], theme))
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(cell(theme), resolve('background-color', ['.table-row:hover'], theme))
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  // In light mode these pairs are 4.4:1 and 3.5:1 already; the light theme is the
  // reference design and stays as is.
  it('keeps hovered and sorted column headers readable in dark mode', () => {
    expect(contrastRatio(header('color', 'dark'), sortableHover('dark'))).toBeGreaterThanOrEqual(
      4.5
    );
    expect(
      contrastRatio(sorted('dark'), header('background-color', 'dark'))
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('follows the dark theme surfaces', () => {
    expect(resolve('background', ['.base-table'], 'dark')).toBe('#171717');
    expect(header('background-color', 'dark')).toBe('#262626');
  });

  it('keeps the light theme colours unchanged', () => {
    expect({
      table: resolve('background', ['.base-table'], 'light'),
      header: [header('background-color', 'light'), header('color', 'light')],
      sortableHover: sortableHover('light'),
      sorted: sorted('light'),
      rowHover: resolve('background-color', ['.table-row:hover'], 'light'),
      cell: cell('light'),
    }).toEqual({
      table: '#ffffff',
      header: ['#f9fafb', '#6b7280'],
      sortableHover: '#f3f4f6',
      sorted: '#3b82f6',
      rowHover: '#f9fafb',
      cell: '#374151',
    });
  });
});
