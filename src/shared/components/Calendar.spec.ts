import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors, type Theme } from '@/test/themeColors';

describe('Calendar theme colours', () => {
  const resolve = themeColors('src/shared/components/Calendar.vue');
  const surface = (theme: Theme) => resolve('background', ['.calendar'], theme);

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it.each(['.month-name', '.weekday-header'])('keeps %s readable on the calendar', selector => {
      expect(
        contrastRatio(resolve('color', [selector], theme), surface(theme))
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the day numbers readable on the day cells', () => {
      expect(
        contrastRatio(
          resolve('color', ['.day-number'], theme),
          resolve('background', ['.calendar-day'], theme)
        )
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('follows the theme surface: white in light mode, neutral-900 in dark mode', () => {
    expect(surface('light')).toBe('#ffffff');
    expect(surface('dark')).toBe('#171717');
  });
});
