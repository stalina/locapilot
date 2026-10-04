import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors, type Theme } from '@/test/themeColors';

describe('ConfirmDialog theme colours', () => {
  const resolve = themeColors('src/shared/components/ConfirmDialog.vue');
  const surface = (theme: Theme) => resolve('background', ['.confirm-dialog'], theme);
  const cancel = (property: string, theme: Theme) =>
    resolve(property, ['.btn', '.btn--secondary'], theme);
  const cancelHover = (theme: Theme) =>
    resolve('background', ['.btn', '.btn--secondary', '.btn--secondary:hover'], theme);

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it.each(['.confirm-dialog__title', '.confirm-dialog__message'])(
      'keeps %s readable on the dialog surface',
      selector => {
        expect(
          contrastRatio(resolve('color', [selector], theme), surface(theme))
        ).toBeGreaterThanOrEqual(4.5);
      }
    );

    it('keeps the cancel button readable at rest and on hover', () => {
      expect(
        contrastRatio(cancel('color', theme), cancel('background', theme))
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(cancel('color', theme), cancelHover(theme))).toBeGreaterThanOrEqual(4.5);
    });

    it('gives the cancel button a visible hover', () => {
      expect(cancelHover(theme)).not.toBe(cancel('background', theme));
    });
  });

  it('follows the dark theme surfaces', () => {
    expect(surface('dark')).toBe('#171717');
    expect(resolve('background', ['.confirm-dialog__footer'], 'dark')).toBe('#262626');
  });

  it('keeps the light theme colours unchanged', () => {
    expect({
      surface: surface('light'),
      title: resolve('color', ['.confirm-dialog__title'], 'light'),
      message: resolve('color', ['.confirm-dialog__message'], 'light'),
      footer: resolve('background', ['.confirm-dialog__footer'], 'light'),
      cancel: [cancel('background', 'light'), cancel('color', 'light'), cancelHover('light')],
    }).toEqual({
      surface: '#ffffff',
      title: '#111827',
      message: '#4b5563',
      footer: '#f9fafb',
      cancel: ['#ffffff', '#374151', '#f9fafb'],
    });
  });
});
