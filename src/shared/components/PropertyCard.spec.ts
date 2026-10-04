import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors, type Theme } from '@/test/themeColors';

describe('PropertyCard theme colours', () => {
  const resolve = themeColors('src/shared/components/PropertyCard.vue');
  const surface = (theme: Theme) => resolve('background', ['.property-card'], theme);
  const price = (theme: Theme) => resolve('color', ['.stat', '.stat-price'], theme);

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it.each(['.property-name', '.property-address', '.stat'])(
      'keeps %s readable on the card',
      selector => {
        expect(
          contrastRatio(resolve('color', [selector], theme), surface(theme))
        ).toBeGreaterThanOrEqual(4.5);
      }
    );

    it('keeps the monthly rent readable on the card', () => {
      expect(contrastRatio(price(theme), surface(theme))).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('follows the theme surface: white in light mode, neutral-900 in dark mode', () => {
    expect(surface('light')).toBe('#ffffff');
    expect(surface('dark')).toBe('#171717');
  });

  it('keeps the light rent colour unchanged', () => {
    expect(price('light')).toBe('#4f46e5');
  });
});
