import { test, expect } from '@playwright/test';

test.describe('Propriétés - e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('[data-testid="mobile-menu-toggle"]');
    if ((await toggle.count()) > 0) {
      // Ensure toggle is visible before clicking (avoid desktop layouts where it's hidden)
      if (await toggle.first().isVisible()) {
        await toggle.first().click();
        await page
          .locator('.sidebar.open')
          .waitFor({ state: 'visible', timeout: 2000 })
          .catch(() => {});
      }
    } else {
      // If no toggle but sidebar exists and is open, ensure it's closed to avoid overlays
      const sidebarOpen = page.locator('.sidebar.open');
      if ((await sidebarOpen.count()) > 0) {
        await sidebarOpen.evaluate(el => (el as HTMLElement).classList.remove('open'));
        await page.waitForTimeout(50);
      }
    }
    const link = page.getByRole('link', { name: /Propriétés/ });
    await link.waitFor({ state: 'visible', timeout: 5000 });
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(/.*\/properties/, { timeout: 5000 });
  });

  test('Créer, éditer et supprimer une propriété', async ({ page }) => {
    // Ouvrir le formulaire de création via data-testid (support mobile/desktop)
    const newBtn = await page.locator('[data-testid="new-property-button"]').first();
    await newBtn.waitFor({ state: 'visible', timeout: 3000 });
    // Click via DOM to avoid Playwright viewport/overlay issues on mobile
    await page.evaluate(el => (el as HTMLElement).click(), await newBtn.elementHandle());
    await page.waitForSelector(
      '[data-testid="modal"], [data-testid="modal-overlay"], [role="dialog"]',
      {
        timeout: 9000,
      }
    );

    const name = `E2E Test Bien ${Date.now()}`;

    // Remplir le formulaire en utilisant les data-testid exposés
    await page.locator('[data-testid="property-name"]').fill(name);
    await page.locator('[data-testid="property-address"]').fill('1 rue de Test, 75000 Paris');
    await page.locator('[data-testid="property-surface"]').fill('42');
    await page.locator('[data-testid="property-rooms"]').fill('2');
    await page.locator('[data-testid="property-rent"]').fill('850');

    // Créer via bouton présent dans le footer du modal (texte du bouton)
    const modalFooter = page.locator('[data-testid="modal-footer"]');
    await modalFooter.waitFor({ state: 'visible', timeout: 5000 });
    await modalFooter.getByRole('button', { name: /Créer|Enregistrer/ }).click();

    // Vérifier présence dans la liste: chercher une card contenant le nom
    await expect(page.locator('.property-card', { hasText: name })).toBeVisible({ timeout: 5000 });

    // Ouvrir la fiche détail / édition (cliquer sur l'élément)
    await page.click(`text=${name}`);
    await page
      .waitForSelector('h3:has-text("Détails du bien") , h3:has-text("Fiche")', { timeout: 2000 })
      .catch(() => {});

    // Cliquer sur bouton édition si présent
    // Cliquer sur éditer via data-testid si disponible sur la card trouvée
    const card = page.locator('.property-card', { hasText: name }).first();
    const editBtn = card.locator('[data-testid="edit-property-button"]');
    if ((await editBtn.count()) > 0) {
      await editBtn.first().click();
      await page.locator('[data-testid="property-name"]').fill(`${name} - modifié`);
      await page.locator('[data-testid="property-form-submit"]').click();
      await expect(page.locator('.property-card', { hasText: `${name} - modifié` })).toBeVisible();
    }

    // Supprimer la propriété
    // Supprimer la propriété en cliquant sur le bouton delete présent sur la card
    const delBtn = card.locator('[data-testid="delete-property-button"]');
    if ((await delBtn.count()) > 0) {
      // Set dialog handler before clicking
      page.on('dialog', async dialog => {
        await dialog.accept();
      });
      await delBtn.first().click();
    }

    // Vérifier la suppression (attendre disparition)
    // Vérifier la disparition du nom dans la liste
    await expect(page.locator('.property-card', { hasText: name })).toHaveCount(0);
  });
});
