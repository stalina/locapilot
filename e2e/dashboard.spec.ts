import { test, expect } from '@playwright/test';

test('Dashboard shows recent activities and upcoming events', async ({ page }) => {
  await page.goto('http://localhost:5174/');
  await expect(page.locator('h1')).toHaveText('Tableau de bord');

  const recentHeader = page.locator('.section-title', { hasText: 'Activité récente' });
  await expect(recentHeader).toBeVisible();

  const activityCount = await page.locator('.activity-item').count();
  expect(activityCount).toBeGreaterThanOrEqual(1);

  const upcomingHeader = page.locator('.section-title', { hasText: 'À venir' });
  await expect(upcomingHeader).toBeVisible();

  const eventCount = await page.locator('.event-item').count();
  expect(eventCount).toBeGreaterThanOrEqual(1);
});
