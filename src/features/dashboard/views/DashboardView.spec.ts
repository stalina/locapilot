import { describe, it, expect } from 'vitest';
import { contrastRatio, themeColors, themeToken } from '@/test/themeColors';

// The schedule sits on a views.css section card, which follows the theme.
describe('DashboardView theme colours', () => {
  const resolve = themeColors('src/features/dashboard/views/DashboardView.vue');

  it.each(['light', 'dark'] as const)(
    'keeps the schedule dates readable on the section card in %s mode',
    theme => {
      expect(
        contrastRatio(
          resolve('color', ['.schedule-date'], theme),
          themeToken('--bg-primary', theme)
        )
      ).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('keeps the light schedule date colour unchanged', () => {
    expect(resolve('color', ['.schedule-date'], 'light')).toBe('#4f46e5');
  });
});
