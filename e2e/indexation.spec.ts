import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar } from './utils/app';

test.describe('Indexation IRL - e2e', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Indexation IRL/i, /\/indexation/);
  });

  test('Saisir un indice IRL trimestriel et le voir apparaître dans le tableau', async ({
    page,
  }) => {
    // Au départ, aucun indice
    await expect(page.locator('[data-testid="irl-empty"]')).toBeVisible({ timeout: 10_000 });

    // Ouvrir le formulaire d'ajout
    await page.locator('[data-testid="add-irl"]').click();

    const modal = page.locator('[data-testid="modal"]');
    await expect(modal).toBeVisible();

    // Saisir l'année, le trimestre et la valeur
    await modal.locator('#irl-year').fill('2026');
    await modal.locator('#irl-quarter').selectOption('1');
    await modal.locator('[data-testid="irl-value"]').fill('147.05');

    await modal.locator('[data-testid="save-irl"]').click();

    // L'indice apparaît dans le tableau
    const table = page.locator('[data-testid="irl-table"]');
    await expect(table).toBeVisible({ timeout: 10_000 });
    const row = table.locator('tbody tr', { hasText: '2026' }).first();
    await expect(row).toContainText('T1');
    await expect(row).toContainText('147,05');
  });
});
