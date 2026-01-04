import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar } from './utils/app';

test.describe('Documents - e2e', () => {
  test('Upload, recherche, filtre et suppression', async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Documents/i, /\/documents/);

    const filePath = 'test-output/tenants_modal.html';
    const fileInput = page.locator('.upload-zone input[type=file]').first();
    await fileInput.setInputFiles(filePath);

    const card = page.locator('.document-card', { hasText: 'tenants_modal.html' }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Recherche par nom
    const search = page.getByPlaceholder('Rechercher un document...');
    await search.fill('tenants_modal');
    await expect(page.locator('.document-card')).toHaveCount(1);

    // Filtrer "Autres" (le handler upload tag en type 'other')
    await page.locator('.filter-button', { hasText: 'Autres' }).click();
    await expect(page.locator('.document-card', { hasText: 'tenants_modal.html' })).toBeVisible();

    // Supprimer
    page.on('dialog', async d => {
      await d.accept();
    });

    await page
      .locator('.document-card', { hasText: 'tenants_modal.html' })
      .first()
      .getByTitle('Supprimer')
      .click();
    await expect(page.locator('.document-card', { hasText: 'tenants_modal.html' })).toHaveCount(0);
  });
});
