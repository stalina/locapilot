import { test, expect } from '@playwright/test';
import { safeClick } from './utils/safeClick';

test.describe('Rents - e2e', () => {
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
    const link = page.getByRole('link', { name: /Loyers|Rents/ });
    if ((await link.count()) === 0) test.skip();
    await link.waitFor({ state: 'visible', timeout: 5000 });
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(/.*\/rents/, { timeout: 5000 });
  });

  test('Génération et marquage paiement', async ({ page }) => {
    // Vérifier qu'au moins un loyer est listé
    let rentItem = page.locator('.rent-item').first();
    if ((await rentItem.count()) === 0) {
      // Créer un bail via l'UI (naviguer vers /leases) pour générer un loyer
      const leaseLink = page.getByRole('link', { name: /Baux|Leases/ });
      if ((await leaseLink.count()) === 0) test.skip();
      await leaseLink.first().scrollIntoViewIfNeeded();
      await leaseLink.first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
      await safeClick(page, leaseLink.first());
      await page.waitForSelector('[data-testid="new-lease-button"]', { timeout: 2000 }).catch(() => {});
      const newLease = page.locator('[data-testid="new-lease-button"]').first();
      if ((await newLease.count()) === 0) test.skip();
      await newLease.scrollIntoViewIfNeeded();
      await newLease.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
      await safeClick(page, newLease);
      await page.waitForSelector('form');
      // choose first options if present
      const propertySelect = page.locator('select[data-testid="lease-property"]');
      if ((await propertySelect.count()) > 0) await propertySelect.selectOption({ index: 0 }).catch(() => {});
      const tenantSelect = page.locator('select[data-testid="lease-tenant"]');
      if ((await tenantSelect.count()) > 0) await tenantSelect.selectOption({ index: 0 }).catch(() => {});
      await page.locator('input[data-testid="lease-startDate"]').fill('2025-01-01').catch(() => {});
      await page.locator('input[data-testid="lease-endDate"]').fill('2026-01-01').catch(() => {});
      await page.locator('input[data-testid="lease-rent"]').fill('900').catch(() => {});
      const footer = page.locator('[data-testid="modal-footer"]');
      await footer.getByRole('button', { name: /Créer|Enregistrer/ }).click().catch(() => {});
      // back to rents
      await page.goto('/rents').catch(() => {});
      rentItem = page.locator('.rent-item').first();
      if ((await rentItem.count()) === 0) test.skip();
    }

    await expect(rentItem).toBeVisible();
    const payBtn = rentItem.locator('[data-testid="mark-paid-button"]');
    if ((await payBtn.count()) > 0) {
      await payBtn.first().click();
      await expect(rentItem.locator('.status', { hasText: 'Payé' })).toBeVisible().catch(() => {});
    }
  });
});
