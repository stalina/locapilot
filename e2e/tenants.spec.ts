import { test, expect } from '@playwright/test';
import { resetApp, navigateFromSidebar, withinModal } from './utils/app';

test.describe('Locataires - e2e', () => {
  test.beforeEach(async ({ page }) => {
    await resetApp(page);
    await navigateFromSidebar(page, /Locataires|Tenants/i, /\/tenants/);
  });

  test('Créer, rechercher, éditer et supprimer un locataire', async ({ page }) => {
    const firstName = `E2E_${Date.now()}`;
    const lastName = `Locataire`;
    const email = `e2e.${Date.now()}@example.com`;
    const fullName = `${firstName} ${lastName}`;

    // Créer
    await page.locator('[data-testid="new-tenant-button"]').first().click();
    const createModal = withinModal(page, /Locataire|Tenant/i);
    await createModal.waitFor({ state: 'visible', timeout: 10_000 });

    await createModal.locator('input[data-testid="tenant-firstName"]').fill(firstName);
    await createModal.locator('input[data-testid="tenant-lastName"]').fill(lastName);
    await createModal.locator('input[data-testid="tenant-email"]').fill(email);
    await createModal.locator('input[data-testid="tenant-phone"]').fill('0612345678');
    await createModal.locator('input[data-testid="tenant-birthDate"]').fill('1990-01-01');
    await createModal.locator('select[data-testid="tenant-status"]').selectOption('active');
    await createModal
      .locator('[data-testid="modal-footer"]')
      .getByRole('button', { name: /Cr[ée]er|Enregistrer/i })
      .click();

    const card = page.locator('.tenant-card', { hasText: fullName }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });

    // Recherche
    const searchBox = page.getByPlaceholder('Rechercher un locataire...');
    await searchBox.fill(email.split('@')[0]!);
    await expect(page.locator('.tenant-card')).toHaveCount(1);
    await searchBox.fill('');

    // Filtre Actifs
    await page.locator('.filter-button', { hasText: 'Actifs' }).click();
    await expect(page.locator('.tenant-card', { hasText: fullName })).toBeVisible();
    await page.locator('.filter-button', { hasText: 'Tous' }).click();

    // Éditer
    await card.locator('[data-testid="edit-tenant-button"]').click();
    const editModal = withinModal(page, /Locataire|Tenant/i);
    await editModal.waitFor({ state: 'visible', timeout: 10_000 });
    const updatedFirst = `${firstName}-mod`;
    await editModal.locator('input[data-testid="tenant-firstName"]').fill(updatedFirst);
    await editModal
      .locator('[data-testid="modal-footer"]')
      .getByRole('button', { name: /Enregistrer|Cr[ée]er/i })
      .click();

    await expect(
      page.locator('.tenant-card', { hasText: `${updatedFirst} ${lastName}` })
    ).toBeVisible({ timeout: 10_000 });

    // Supprimer
    const updatedCard = page
      .locator('.tenant-card', { hasText: `${updatedFirst} ${lastName}` })
      .first();
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    await updatedCard.locator('[data-testid="delete-tenant-button"]').click();

    const confirmBtn = page.getByRole('button', { name: /Supprimer/i }).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
    }

    await expect(
      page.locator('.tenant-card', { hasText: `${updatedFirst} ${lastName}` })
    ).toHaveCount(0);
  });
});
