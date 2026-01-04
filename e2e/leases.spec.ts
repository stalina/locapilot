import { test, expect } from '@playwright/test';
import { resetApp } from './utils/app';
import { createProperty, createTenant, createLease } from './utils/flows';

test.describe('Baux - e2e', () => {
  test('Créer puis terminer un bail', async ({ page }) => {
    await resetApp(page);

    const { name: propertyName } = await createProperty(page);
    const { fullName: tenantFullName } = await createTenant(page);
    await createLease(page, {
      startDate: '2025-12-01',
      endDate: '2026-12-31',
      propertyName,
      tenantFullName,
    });

    // Ouvrir le détail du bail
    const leaseCard = page.locator('.lease-card', { hasText: propertyName }).first();
    await expect(leaseCard).toBeVisible({ timeout: 10_000 });
    await leaseCard.click();
    await expect(page).toHaveURL(/\/leases\/\d+/, { timeout: 10_000 });

    // Terminer via confirmation
    await page
      .locator('.view-header .header-actions')
      .getByRole('button', { name: /Terminer/ })
      .click();

    const confirmDialog = page.locator('.confirm-dialog', { hasText: 'Terminer le bail' }).first();
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await confirmDialog.getByRole('button', { name: /Terminer/ }).click();

    // Retour liste et vérifier qu'on a un bail terminé
    await page.getByRole('button', { name: /Retour/ }).click();
    await expect(page).toHaveURL(/\/leases/, { timeout: 10_000 });
    await page.locator('.filter-button', { hasText: 'Terminés' }).click();
    await page
      .getByPlaceholder(/Rechercher par propri[ée]t[ée], locataire\.\.\./i)
      .fill(propertyName);
    await expect(page.locator('.lease-card', { hasText: propertyName })).toHaveCount(1, {
      timeout: 10_000,
    });
  });
});
