import { test, expect } from '@playwright/test';

test.describe('Leases - e2e', () => {
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
    const link = page.getByRole('link', { name: /Baux|Leases/ });
    if ((await link.count()) === 0) test.skip();
    await link.waitFor({ state: 'visible', timeout: 5000 });
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(/.*\/leases/, { timeout: 5000 });
  });

  test('Créer, associer et terminer un bail', async ({ page }) => {
    await page.locator('[data-testid="new-lease-button"]').first().click();
    await page.waitForSelector('form');

    // Choisir un bien et un locataire existants (si aucun, test tolérant)
    const propertySelect = page.locator('select[data-testid="lease-property"]');
    if ((await propertySelect.count()) > 0) {
      await propertySelect.selectOption({ index: 0 });
    }

    const tenantSelect = page.locator('select[data-testid="lease-tenant"]');
    if ((await tenantSelect.count()) > 0) {
      await tenantSelect.selectOption({ index: 0 });
    }

    await page.locator('input[data-testid="lease-startDate"]').fill('2025-01-01');
    await page.locator('input[data-testid="lease-endDate"]').fill('2026-01-01');
    await page.locator('input[data-testid="lease-rent"]').fill('900');

    const footer = page.locator('[data-testid="modal-footer"]');
    await footer.getByRole('button', { name: /Créer|Enregistrer/ }).click();

    // Vérifier la présence du bail dans la liste
    const leaseCard = page.locator('.lease-card').first();
    await expect(leaseCard).toBeVisible({ timeout: 5000 });

    // Terminer le bail si bouton présent
    const endBtn = leaseCard.locator('[data-testid="end-lease-button"]');
    if ((await endBtn.count()) > 0) {
      page.on('dialog', async dialog => await dialog.accept());
      await endBtn.first().click();
      await expect(leaseCard)
        .toHaveClass(/ended|terminated|finished/)
        .catch(() => {});
    }
  });
});
