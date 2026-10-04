import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors, themeToken, type Theme } from '@/test/themeColors';

// The tenant's cards are views.css cards, which follow the theme.
describe('TenantDetailView theme colours', () => {
  const resolve = themeColors('src/features/tenants/views/TenantDetailView.vue');
  const propertyHover = (theme: Theme) =>
    resolve('background', ['.property-item', '.property-item.clickable:hover'], theme);

  describe.each(['light', 'dark'] as const)('in %s mode', theme => {
    it('keeps the monthly rent of a lease readable on the card', () => {
      expect(
        contrastRatio(resolve('color', ['.lease-amount'], theme), themeToken('--bg-primary', theme))
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the current property readable when hovered', () => {
      expect(
        contrastRatio(themeToken('--text-primary', theme), propertyHover(theme))
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(
          resolve('color', ['.property-item > i:first-child'], theme),
          propertyHover(theme)
        )
      ).toBeGreaterThanOrEqual(3);
    });
  });

  it('keeps the light colours unchanged', () => {
    expect({
      leaseAmount: resolve('color', ['.lease-amount'], 'light'),
      propertyIcon: resolve('color', ['.property-item > i:first-child'], 'light'),
      propertyHover: propertyHover('light'),
    }).toEqual({
      leaseAmount: '#4f46e5',
      propertyIcon: '#4f46e5',
      propertyHover: '#f0f4ff',
    });
  });
});
