import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors, type Theme } from '@/test/themeColors';

describe('TenantCard theme colours', () => {
  const resolve = themeColors('src/shared/components/TenantCard.vue');
  const surface = (theme: Theme) => resolve('background', ['.tenant-card'], theme);

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it.each(['.tenant-name', '.info-row'])('keeps %s readable on the card', selector => {
      expect(
        contrastRatio(resolve('color', [selector], theme), surface(theme))
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('follows the theme surface: white in light mode, neutral-900 in dark mode', () => {
    expect(surface('light')).toBe('#ffffff');
    expect(surface('dark')).toBe('#171717');
  });
});
