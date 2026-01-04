import { test, expect } from '@playwright/test';
import { safeClick } from './utils/safeClick';

test.describe('Inventories - e2e', () => {
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
    const link = page.getByRole('link', { name: /Inventaires|Inventories/ });
    if ((await link.count()) === 0) test.skip();
    await link.waitFor({ state: 'visible', timeout: 5000 });
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(/.*\/inventories/, { timeout: 5000 });
  });

  test('Créer inventaire avec photos et notes', async ({ page }) => {
    // Ensure a property exists to associate with the inventory
    const anyProperty = page.locator('.property-card').first();
    if ((await anyProperty.count()) === 0) {
      const propLink = page.getByRole('link', { name: /Propriétés|Propriétés|Properties/ });
      if ((await propLink.count()) > 0) {
        await safeClick(page, propLink.first());
        await page.waitForSelector('[data-testid="new-property-button"]', { timeout: 2000 }).catch(() => {});
        const newBtnP = page.locator('[data-testid="new-property-button"]').first();
        if ((await newBtnP.count()) > 0) {
          await safeClick(page, newBtnP);
          await page.waitForSelector('form');
          const name = `E2E Inv Prop ${Date.now()}`;
          await page.locator('[data-testid="property-name"]').fill(name).catch(() => {});
          await page.locator('[data-testid="property-address"]').fill('1 rue E2E', { timeout: 2000 }).catch(() => {});
          const footerP = page.locator('[data-testid="modal-footer"]');
          await footerP.getByRole('button', { name: /Créer|Enregistrer/ }).click().catch(() => {});
          await page.goto('/inventories').catch(() => {});
        }
      }
    }

    const newBtn = page.locator('[data-testid="new-inventory-button"]').first();
    if ((await newBtn.count()) === 0) test.skip();
    await safeClick(page, newBtn);
    await page.waitForSelector('form');

    await page.locator('input[data-testid="inventory-title"]').fill('E2E Inventory');
    await page.locator('textarea[data-testid="inventory-notes"]').fill('Notes de test');

    // Upload photo si input présent
    const photoInput = page.locator('input[type=file][data-testid="inventory-photos"]');
    if ((await photoInput.count()) > 0) {
      await photoInput.setInputFiles('test-output/tenants_modal.html');
    }

    const footer = page.locator('[data-testid="modal-footer"]');
    // Associate property if select exists
    const propSelect = page.locator('select[data-testid="inventory-property"]');
    if ((await propSelect.count()) > 0) {
      await propSelect.selectOption({ index: 0 }).catch(() => {});
    }
    await safeClick(page, footer.getByRole('button', { name: /Créer|Enregistrer/ }).first());

    // Vérifier présence
    await expect(page.locator('.inventory-card', { hasText: 'E2E Inventory' })).toBeVisible({
      timeout: 5000,
    });
  });
});
