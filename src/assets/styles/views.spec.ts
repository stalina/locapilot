import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors, themeToken, type Theme } from '@/test/themeColors';

// The shared view panels hold --text-* text, which turns near-white in dark
// mode, so their surfaces must follow the theme too.
describe('views.css theme colours', () => {
  const resolve = themeColors('src/assets/styles/views.css');
  const PANELS = ['.section-card', '.card', '.filters', '.sort-select', '.progress-wrapper'];
  const panel = (selector: string, theme: Theme) => resolve('background', [selector], theme);

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it.each([
      ['.section-title', '.section-card'],
      ['.card-title', '.card'],
      ['.activity-title', '.section-card'],
      ['.activity-meta', '.section-card'],
      ['.filter-label', '.filters'],
      ['.sort-select', '.sort-select'],
    ])('keeps %s readable on %s', (text, surface) => {
      expect(
        contrastRatio(resolve('color', [text], theme), panel(surface, theme))
      ).toBeGreaterThanOrEqual(4.5);
    });

    it.each(['.section-link', '.progress-text', '.error-state'])(
      'keeps the coloured %s text readable on the theme surface',
      selector => {
        expect(
          contrastRatio(resolve('color', [selector], theme), themeToken('--bg-primary', theme))
        ).toBeGreaterThanOrEqual(4.5);
      }
    );

    it('keeps a hovered section link readable', () => {
      expect(
        contrastRatio(
          resolve('color', ['.section-link', '.section-link:hover'], theme),
          themeToken('--bg-primary', theme)
        )
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps event dates readable on their event', () => {
      expect(
        contrastRatio(
          resolve('color', ['.event-date'], theme),
          resolve('background', ['.event-item'], theme)
        )
      ).toBeGreaterThanOrEqual(4.5);
    });
  });

  it.each(PANELS)('makes %s follow the theme surface', selector => {
    expect(panel(selector, 'light')).toBe('#ffffff');
    expect(panel(selector, 'dark')).toBe('#171717');
  });

  it('keeps the light coloured text unchanged', () => {
    expect({
      sectionLink: resolve('color', ['.section-link'], 'light'),
      sectionLinkHover: resolve('color', ['.section-link', '.section-link:hover'], 'light'),
      eventDate: resolve('color', ['.event-date'], 'light'),
      progressText: resolve('color', ['.progress-text'], 'light'),
      errorState: resolve('color', ['.error-state'], 'light'),
    }).toEqual({
      sectionLink: '#4f46e5',
      sectionLinkHover: '#4338ca',
      eventDate: '#4f46e5',
      progressText: '#4f46e5',
      errorState: '#dc2626',
    });
  });

  it('renders the sort select option list for a dark background in dark mode only', () => {
    expect(resolve('color-scheme', ['.sort-select'], 'dark')).toBe('dark');
    expect(() => resolve('color-scheme', ['.sort-select'], 'light')).toThrow();
  });
});
