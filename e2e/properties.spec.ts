import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar, withinModal } from './utils/app';

test.describe('Propriétés - e2e', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Propri[ée]t[ée]s|Properties/i, /\/properties/);
  });

  test('Créer, éditer et supprimer une propriété', async ({ page }) => {
    const name = `E2E Test Bien ${Date.now()}`;

    // Créer
    await page.locator('[data-testid="new-property-button"]').first().click();
    const createModal = withinModal(page, /Propri[ée]t[ée]|Bien|property/i);
    await createModal.waitFor({ state: 'visible', timeout: 10_000 });

    await createModal.locator('[data-testid="property-name"]').fill(name);
    await createModal
      .locator('[data-testid="property-address"]')
      .fill('1 rue de Test, 75000 Paris');
    await createModal.locator('input[data-testid="property-surface"]').fill('42');
    await createModal.locator('input[data-testid="property-rooms"]').fill('2');
    await createModal.locator('input[data-testid="property-rent"]').fill('850');

    await createModal.locator('[data-testid="property-form-submit"]').click();

    // Vérifier présence dans la liste: chercher une card contenant le nom
    const card = page.locator('.property-card', { hasText: name }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Éditer
    const editBtn = card.locator('[data-testid="edit-property-button"]');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const editModal = withinModal(page, /Propri[ée]t[ée]|Bien|property/i);
    await editModal.waitFor({ state: 'visible', timeout: 10_000 });
    const updatedName = `${name} - modifié`;
    await editModal.locator('[data-testid="property-name"]').fill(updatedName);
    await editModal.locator('[data-testid="property-form-submit"]').click();
    await expect(page.locator('.property-card', { hasText: updatedName })).toBeVisible({
      timeout: 10_000,
    });

    // Supprimer
    const delCard = page.locator('.property-card', { hasText: updatedName }).first();
    const delBtn = delCard.locator('[data-testid="delete-property-button"]');
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    await delBtn.click();

    // Si une confirmation custom apparaît, l'accepter
    const confirmBtn = page.getByRole('button', { name: /Supprimer/i }).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }

    // Vérifier la suppression (attendre disparition)
    await expect(page.locator('.property-card', { hasText: updatedName })).toHaveCount(0);
  });
});
