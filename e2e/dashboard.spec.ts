import { test, expect } from '@playwright/test';

test('Dashboard shows recent activities and upcoming events', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Tableau de bord');

  const recentHeader = page.locator('.section-title', { hasText: 'Activité récente' });
  await expect(recentHeader).toBeVisible();

  const activityCount = await page.locator('.activity-item').count();
  // Accept either populated list or the empty state message
  if (activityCount === 0) {
    await expect(page.locator('.empty-list', { hasText: 'Aucune activité récente' })).toBeVisible();
  } else {
    expect(activityCount).toBeGreaterThanOrEqual(1);
  }

  const upcomingHeader = page.locator('.section-title', { hasText: 'À venir' });
  await expect(upcomingHeader).toBeVisible();

  const eventCount = await page.locator('.event-item').count();
  if (eventCount === 0) {
    await expect(page.locator('.empty-list', { hasText: 'Aucun événement à venir' })).toBeVisible();
  } else {
    expect(eventCount).toBeGreaterThanOrEqual(1);
  }
});
