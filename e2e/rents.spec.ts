import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar } from './utils/app';
import { createProperty, createTenant, createLease } from './utils/flows';

test.describe('Loyers - e2e', () => {
  test('Payer un loyer (virtual -> rent réel) puis vérifier statut', async ({ page }) => {
    await resetApp(page);

    const { name: propertyName } = await createProperty(page);
    const { fullName: tenantFullName } = await createTenant(page);
    await createLease(page, {
      startDate: '2025-12-01',
      endDate: '2026-12-31',
      propertyName,
      tenantFullName,
    });

    await navigateFromSidebar(page, /Loyers|Rents/i, /\/rents/);

    const row = page.locator('tr.rent-row', { hasText: propertyName }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    // Ouvrir le paiement
    await row.getByRole('button', { name: /Payer/ }).click();

    // Remplir le modal de paiement
    await expect(page.getByRole('heading', { name: /Enregistrer un paiement/i })).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('#payment-method').selectOption('transfer');
    await page.getByRole('button', { name: /Valider le paiement/i }).click();

    // Vérifier le statut payé (badge + action quittance)
    await expect(row.locator('.status-cell')).toContainText('Payé', { timeout: 10_000 });
    await expect(row.getByRole('button', { name: /Quittance/i })).toBeVisible({ timeout: 10_000 });
  });
});
