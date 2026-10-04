import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors, type Theme } from '@/test/themeColors';

describe('NotificationContainer theme colours', () => {
  const resolve = themeColors('src/shared/components/NotificationContainer.vue');
  const surface = (theme: Theme) => resolve('background', ['.notification'], theme);
  const close = (theme: Theme) => resolve('color', ['.notification__close'], theme);
  const closeHover = (theme: Theme) =>
    resolve('color', ['.notification__close', '.notification__close:hover'], theme);

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it('keeps the message readable on the toast', () => {
      expect(
        contrastRatio(resolve('color', ['.notification__message'], theme), surface(theme))
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the close button readable at rest and on hover', () => {
      expect(contrastRatio(close(theme), surface(theme))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(closeHover(theme), surface(theme))).toBeGreaterThanOrEqual(4.5);
      expect(closeHover(theme)).not.toBe(close(theme));
    });
  });

  it('follows the theme surface: white in light mode, neutral-900 in dark mode', () => {
    expect(surface('light')).toBe('#ffffff');
    expect(surface('dark')).toBe('#171717');
  });

  it('keeps the light text colours unchanged', () => {
    expect([
      resolve('color', ['.notification__message'], 'light'),
      close('light'),
      closeHover('light'),
    ]).toEqual(['#1f2937', '#6b7280', '#111827']);
  });
});
