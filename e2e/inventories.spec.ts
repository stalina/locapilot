import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar, withinModal } from './utils/app';
import { createLease, createProperty, createTenant } from './utils/flows';

test.describe('Inventories - e2e', () => {
  test('Créer, filtrer, rechercher et supprimer un état des lieux', async ({ page }) => {
    await resetApp(page);

    const { name: propertyName } = await createProperty(page);
    const { fullName: tenantFullName } = await createTenant(page);
    await createLease(page, {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      propertyName,
      tenantFullName,
    });

    await navigateFromSidebar(page, /Inventaires|[ÉE]tats des lieux|Inventories/i, /\/inventories/);

    await page.locator('[data-testid="new-inventory-button"]').click();
    const modal = withinModal(page, /Nouvel [ée]tat des lieux/i);
    await modal.waitFor({ state: 'visible', timeout: 10_000 });

    await modal
      .locator('select[data-testid="inventory-lease"]')
      .selectOption({ label: propertyName });
    await modal.locator('select[data-testid="inventory-type"]').selectOption('checkin');
    await modal.locator('input[data-testid="inventory-date"]').fill('2026-01-02');
    await modal.locator('textarea[data-testid="inventory-observations"]').fill('Observations E2E');
    await modal
      .locator('[data-testid="modal-footer"]')
      .getByRole('button', { name: /Cr[ée]er/i })
      .click();

    const card = page.locator('.inventory-card', { hasText: propertyName }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText("État d'entrée");

    // Filtre type + recherche
    await page.locator('.filter-button', { hasText: 'Entrées' }).click();
    await page
      .locator('input.search-input[placeholder="Rechercher par propriété..."]')
      .fill(propertyName);
    await expect(page.locator('.inventory-card')).toHaveCount(1);

    // Suppression
    page.on('dialog', async d => {
      await d.accept();
    });
    await card.locator('[data-testid="delete-inventory-button"]').click();
    await expect(page.locator('.inventory-card', { hasText: propertyName })).toHaveCount(0);
  });
});
