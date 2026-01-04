import { test, expect } from '@playwright/test';

test.describe('Documents - e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-testid="mobile-menu-toggle"]');
    if ((await toggle.count()) > 0) {
      if (await toggle.first().isVisible()) {
        await toggle.first().click();
        await page
          .locator('.sidebar.open')
          .waitFor({ state: 'visible', timeout: 2000 })
          .catch(() => {});
      }
    } else {
      const sidebarOpen = page.locator('.sidebar.open');
      if ((await sidebarOpen.count()) > 0) {
        await sidebarOpen.evaluate(el => (el as HTMLElement).classList.remove('open'));
        await page.waitForTimeout(50);
      }
    }
    const link = page.getByRole('link', { name: /Documents|Docs/ });
    if ((await link.count()) === 0) test.skip();
    await link.waitFor({ state: 'visible', timeout: 5000 });
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(/.*\/documents/, { timeout: 5000 });
  });

  test('Upload, preview et suppression', async ({ page }) => {
    // Ouvrir modal upload
    const newBtn = page.locator('[data-testid="new-document-button"]').first();
    if ((await newBtn.count()) === 0) test.skip();
    await newBtn.click();
    await page.waitForSelector('form');

    // Préparer un fichier temporaire minimal
    const filePath = 'test-output/tenants_modal.html';
    const input = page.locator('input[type=file]');
    if ((await input.count()) === 0) test.skip();

    await input.setInputFiles(filePath);
    const footer = page.locator('[data-testid="modal-footer"]');
    await footer.getByRole('button', { name: /Uploader|Enregistrer/ }).click();

    // Vérifier la présence dans la liste
    const docItem = page.locator('.document-item', { hasText: 'tenants_modal' }).first();
    await expect(docItem).toBeVisible({ timeout: 5000 });

    // Ouvrir preview si disponible
    const preview = docItem.locator('[data-testid="preview-document-button"]');
    if ((await preview.count()) > 0) {
      await preview.first().click();
      await page.waitForSelector('.document-preview', { timeout: 3000 }).catch(() => {});
    }

    // Supprimer
    const del = docItem.locator('[data-testid="delete-document-button"]');
    if ((await del.count()) > 0) {
      page.on('dialog', async d => await d.accept());
      await del.first().click();
    }

    await expect(page.locator('.document-item', { hasText: 'tenants_modal' })).toHaveCount(0);
  });
});
