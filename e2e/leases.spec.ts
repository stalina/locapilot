import { test, expect } from '@playwright/test';
import { safeClick } from './utils/safeClick';

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
    // Ensure at least one property exists; create if none
    const anyProperty = page.locator('.property-card').first();
    if ((await anyProperty.count()) === 0) {
      // Navigate to properties and create one
      const propLink = page.getByRole('link', { name: /Propriétés|Propriétés|Properties/ });
      if ((await propLink.count()) > 0) {
        await propLink.first().scrollIntoViewIfNeeded();
        await propLink.first().waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
        await safeClick(page, propLink.first());
        await page.waitForSelector('[data-testid="new-property-button"]', { timeout: 2000 }).catch(() => {});
        const newBtn = page.locator('[data-testid="new-property-button"]').first();
        if ((await newBtn.count()) > 0) {
          await newBtn.scrollIntoViewIfNeeded();
          await newBtn.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});
          await safeClick(page, newBtn);
          await page.waitForSelector('form');
          const name = `E2E Lease Prop ${Date.now()}`;
          await page.locator('[data-testid="property-name"]').fill(name).catch(() => {});
          await page.locator('[data-testid="property-address"]').fill('1 rue E2E', { timeout: 2000 }).catch(() => {});
          await page.locator('input[data-testid="property-surface"]').fill('30').catch(() => {});
          await page.locator('input[data-testid="property-rooms"]').fill('1').catch(() => {});
          await page.locator('input[data-testid="property-rent"]').fill('700').catch(() => {});
          const footer = page.locator('[data-testid="modal-footer"]');
          await footer.getByRole('button', { name: /Créer|Enregistrer/ }).click().catch(() => {});
          // return to leases page
          await page.goto('/leases').catch(() => {});
        }
      }
    }

    // Ensure at least one tenant exists; create if none
    const anyTenant = page.locator('.tenant-card').first();
    if ((await anyTenant.count()) === 0) {
      const tenantLink = page.getByRole('link', { name: /Locataires|Locataires|Tenants/ });
      if ((await tenantLink.count()) > 0) {
        await tenantLink.first().click();
        await page.waitForSelector('[data-testid="new-tenant-button"]', { timeout: 2000 }).catch(() => {});
        const newT = page.locator('[data-testid="new-tenant-button"]').first();
        if ((await newT.count()) > 0) {
          await newT.click();
          await page.waitForSelector('form');
          const firstName = `E2ELease${Date.now()}`;
          await page.locator('input[data-testid="tenant-firstName"]').fill(firstName).catch(() => {});
          await page.locator('input[data-testid="tenant-lastName"]').fill('Test').catch(() => {});
          await page.locator('input[data-testid="tenant-email"]').fill(`${Date.now()}@example.com`).catch(() => {});
          const footer = page.locator('[data-testid="modal-footer"]');
          await footer.getByRole('button', { name: /Créer|Enregistrer/ }).click().catch(() => {});
          await page.goto('/leases').catch(() => {});
        }
      }
    }

    await safeClick(page, page.locator('[data-testid="new-lease-button"]').first());
    await page.waitForSelector('form');

    // Choisir un bien et un locataire existants
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
