import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar } from './utils/app';

test.describe('Communications - Journal', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Communications/i, /\/communications/);
  });

  test('Cas principal : enregistrer une communication manuelle et la voir dans le journal', async ({
    page,
  }) => {
    // Ouvrir le formulaire de saisie
    await page.locator('[data-testid="log-communication-btn"]').click();
    await expect(page.locator('[data-testid="communication-form"]')).toBeVisible();

    // Cibler un locataire (les données de démo en fournissent au moins un)
    await page.locator('[data-testid="form-entity-type"]').selectOption('tenant');
    const tenantOption = page
      .locator('[data-testid="form-entity-id"] option:not([disabled])')
      .first();
    await expect(tenantOption).toBeAttached();
    const tenantId = await tenantOption.getAttribute('value');
    await page.locator('[data-testid="form-entity-id"]').selectOption(String(tenantId));

    await page.locator('[data-testid="form-type"]').selectOption('phone');
    await page.locator('[data-testid="form-direction"]').selectOption('inbound');

    // Une date passée (aujourd'hui) et un contenu distinctif
    const today = new Date().toISOString().slice(0, 10);
    await page.locator('[data-testid="form-date"]').fill(today);
    await page.locator('[data-testid="form-subject"]').fill('Appel chaudière E2E');
    await page
      .locator('[data-testid="form-content"]')
      .fill('Le locataire a signalé une panne de chaudière');

    await page.locator('[data-testid="form-submit"]').click();

    // Le formulaire se ferme et l'entrée apparaît dans le journal
    await expect(page.locator('[data-testid="communication-form"]')).toBeHidden();

    // On isole l'entrée créée via la recherche plein-texte : elle doit être en tête
    await page.locator('[data-testid="filter-search"]').fill('chaudière E2E');
    const rows = page.locator('[data-testid="journal-row"]');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Appel chaudière E2E');
    await expect(rows.first()).toContainText('Le locataire a signalé une panne de chaudière');

    // Une entrée manuelle expose les actions modifier/supprimer
    await expect(rows.first().locator('[data-testid="edit-btn"]')).toBeVisible();
    await expect(rows.first().locator('[data-testid="delete-btn"]')).toBeVisible();
  });
});
