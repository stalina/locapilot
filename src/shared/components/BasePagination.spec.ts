import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors, themeToken, type Theme } from '@/test/themeColors';

describe('BasePagination theme colours', () => {
  const resolve = themeColors('src/shared/components/BasePagination.vue');
  const hover = '.page-btn:hover:not(:disabled):not(.dots)';
  const control = (property: string, selector: string, theme: Theme) =>
    resolve(property, [selector], theme);

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it('keeps the page summary readable on the page surface', () => {
      expect(
        contrastRatio(
          resolve('color', ['.pagination-info'], theme),
          themeToken('--bg-primary', theme)
        )
      ).toBeGreaterThanOrEqual(4.5);
    });

    it.each(['.items-select', '.page-btn'])('keeps %s readable', selector => {
      expect(
        contrastRatio(
          control('color', selector, theme),
          control('background-color', selector, theme)
        )
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps a hovered page button readable and visibly hovered', () => {
      const hovered = resolve('background-color', ['.page-btn', hover], theme);

      expect(contrastRatio(control('color', '.page-btn', theme), hovered)).toBeGreaterThanOrEqual(
        4.5
      );
      expect(hovered).not.toBe(control('background-color', '.page-btn', theme));
    });
  });

  it('follows the theme surface: white in light mode, neutral-900 in dark mode', () => {
    expect(control('background-color', '.page-btn', 'light')).toBe('#ffffff');
    expect(control('background-color', '.page-btn', 'dark')).toBe('#171717');
    expect(control('background-color', '.items-select', 'dark')).toBe('#171717');
  });

  it('keeps the light text colours unchanged', () => {
    expect([
      resolve('color', ['.pagination-info'], 'light'),
      control('color', '.items-select', 'light'),
      control('color', '.page-btn', 'light'),
      resolve('background-color', ['.page-btn', hover], 'light'),
    ]).toEqual(['#6b7280', '#374151', '#374151', '#f3f4f6']);
  });
});
