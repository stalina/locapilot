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

  test("Comparer entrée/sortie avec modèle standard et rapport d'usure", async ({ page }) => {
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

    // --- État d'entrée avec modèle standard ---
    const createInventory = async (type: 'checkin' | 'checkout', date: string) => {
      await page.locator('[data-testid="new-inventory-button"]').click();
      const modal = withinModal(page, /Nouvel [ée]tat des lieux/i);
      await modal.waitFor({ state: 'visible', timeout: 10_000 });
      await modal
        .locator('select[data-testid="inventory-lease"]')
        .selectOption({ label: propertyName });
      await modal.locator('select[data-testid="inventory-type"]').selectOption(type);
      await modal.locator('input[data-testid="inventory-date"]').fill(date);
      // Applique le modèle standard de pièces
      await modal.locator('[data-testid="apply-template-button"]').click();
      await expect(
        modal.locator('[data-testid="inventory-rooms-editor"] .room-block')
      ).not.toHaveCount(0);
      // Acceptation horodatée
      await modal.locator('[data-testid="signature-landlord"]').check();
      await expect(modal.locator('[data-testid="signature-timestamp"]')).toBeVisible();
      await modal
        .locator('[data-testid="modal-footer"]')
        .getByRole('button', { name: /Cr[ée]er/i })
        .click();
      await modal.waitFor({ state: 'hidden', timeout: 10_000 });
    };

    await createInventory('checkin', '2026-01-02');
    await createInventory('checkout', '2026-12-31');

    // Ouvre le détail d'un état des lieux puis lance la comparaison
    await page
      .locator('.inventory-card', { hasText: propertyName })
      .first()
      .getByRole('button', {
        name: /Voir/i,
      })
      .click();
    await page.locator('[data-testid="compare-inventory-button"]').click();
    await expect(page).toHaveURL(/\/inventories\/compare\//);

    // La table de comparaison et la synthèse sont affichées
    await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Rapport d'usure anormale/i })).toBeVisible();
  });
});
