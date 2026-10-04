import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors } from '@/test/themeColors';

describe('SearchBox theme colours', () => {
  const resolve = themeColors('src/shared/components/SearchBox.vue');

  it.each(['light', 'dark'] as const)('keeps the typed search readable in %s mode', theme => {
    expect(
      contrastRatio(
        resolve('color', ['.search-input'], theme),
        resolve('background', ['.search-input'], theme)
      )
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('follows the theme surface: white in light mode, neutral-900 in dark mode', () => {
    expect(resolve('background', ['.search-input'], 'light')).toBe('#ffffff');
    expect(resolve('background', ['.search-input'], 'dark')).toBe('#171717');
  });
});
